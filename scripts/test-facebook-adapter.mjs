/**
 * Facebook Page Reels adapter — non-publishing end-to-end test.
 *
 * Spawns its own Next dev server (port 43124, throwaway data dir) pointed at a
 * local mock of graph.facebook.com + rupload.facebook.com. Nothing reaches Meta.
 *
 * Run: node --experimental-sqlite scripts/test-facebook-adapter.mjs
 */
import { spawn } from "child_process";
import { createServer } from "http";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { DatabaseSync } from "node:sqlite";

const APP_PORT = 43124;
const MOCK_PORT = 43999;
const APP = `http://127.0.0.1:${APP_PORT}`;
const MOCK = `http://127.0.0.1:${MOCK_PORT}`;
const DATA = mkdtempSync(path.join(tmpdir(), "ghostcut-fbtest-"));
const results = [];
const ok = (name, pass, detail = "") => {
  results.push(!!pass);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

// ---- mock Meta ---------------------------------------------------------
const calls = [];
let mode = "ok"; // "ok" | "processing_error"
const mock = createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  const url = new URL(req.url, MOCK);
  calls.push({ method: req.method, path: url.pathname, query: url.search, headers: req.headers, body });
  const send = (o, status = 200) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(o));
  };
  if (req.method === "POST" && url.pathname === "/v21.0/page1/video_reels") {
    const j = JSON.parse(body.toString() || "{}");
    if (j.upload_phase === "start") return send({ video_id: "vid123", upload_url: `${MOCK}/video-upload/v21.0/vid123` });
    if (j.upload_phase === "finish") return send({ success: true });
  }
  if (req.method === "POST" && url.pathname === "/video-upload/v21.0/vid123") return send({ success: true });
  if (req.method === "GET" && url.pathname === "/v21.0/vid123")
    return send({ status: { video_status: mode === "ok" ? "ready" : "error", processing_phase: { status: mode === "ok" ? "completed" : "error" } } });
  send({ error: { message: `mock: unexpected ${req.method} ${url.pathname}` } }, 404);
});
await new Promise((r) => mock.listen(MOCK_PORT, "127.0.0.1", r));

// ---- app ---------------------------------------------------------------
const app = spawn("npx", ["next", "dev", "--port", String(APP_PORT)], {
  env: {
    ...process.env,
    GHOSTCUT_DATA_DIR: DATA,
    GHOSTCUT_APP_URL: APP,
    GHOSTCUT_META_GRAPH_BASE: MOCK,
    GHOSTCUT_META_RUPLOAD_BASE: MOCK,
    GHOSTCUT_PASSWORD: "",
  },
  stdio: ["ignore", "pipe", "pipe"],
  detached: true, // own process group so cleanup also stops the Next child
});
let appLog = "";
app.stdout.on("data", (d) => (appLog += d));
app.stderr.on("data", (d) => (appLog += d));

async function waitUp() {
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(`${APP}/api/connections`);
      if (r.ok) return true;
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function seed() {
  const db = new DatabaseSync(path.join(DATA, "ghostcut.db"));
  db.prepare(`UPDATE secrets SET meta_app_id='1234567890', meta_app_secret='test-meta-secret' WHERE id=1`).run();
  db.prepare(
    `INSERT INTO connections (platform, status, account_label, connected_at, access_token, page_id)
     VALUES ('facebook','connected','Gentle Gentlemen (test Page)',?, 'EAA-test-page-token','page1')
     ON CONFLICT(platform) DO UPDATE SET status='connected', access_token=excluded.access_token, page_id='page1'`,
  ).run(new Date().toISOString());
  db.close();
}

const clip = {
  id: "kw-test-001",
  seriesId: "desk-chain",
  seriesName: "Test",
  hook: "test",
  durationSec: 20,
  beats: [],
  broll: [],
  sfx: [],
  loopNotes: "",
  thumbnailText: "",
  youtube: { title: "Test Short", caption: "yt caption", hashtags: ["marblemachine"] },
  instagram: { title: "Test Reel", caption: "ig caption", hashtags: ["marblemachine", "asmr"] },
  facebook: { title: "Brass Spiral (test)", caption: "fb caption", hashtags: ["kineticart"] },
};

async function queueItem(platforms, extra = {}) {
  const fd = new FormData();
  const fakeVideo = new Uint8Array(4096).map((_, i) => i % 251);
  fd.set("video", new Blob([fakeVideo], { type: "video/mp4" }), "test.mp4");
  fd.set("meta", JSON.stringify({ clip, channelName: "Gentle Gentlemen", platforms, ...extra }));
  const r = await fetch(`${APP}/api/queue`, { method: "POST", body: fd });
  return { status: r.status, body: await r.json() };
}

try {
  ok("dev server up", await waitUp(), APP);
  seed();

  const conns = await (await fetch(`${APP}/api/connections`)).json();
  ok("connections API exposes facebook", conns.facebook?.status === "connected", JSON.stringify(conns.facebook));
  ok("connections API never exposes tokens", !JSON.stringify(conns).includes("EAA-test"));

  const bad = await queueItem(["myspace"]);
  ok("queue rejects unknown platform", bad.status === 400, bad.body.error);

  const q = await queueItem(["facebook"], { youtubePrivacy: "unlisted" });
  ok("queue accepts facebook item", q.status === 200, q.body.item?.id);
  const listed = (await (await fetch(`${APP}/api/queue`)).json()).items.find((i) => i.id === q.body.item.id);
  ok("youtubePrivacy persisted (no schema change)", listed?.youtubePrivacy === "unlisted", listed?.youtubePrivacy);

  calls.length = 0;
  const ap = await (await fetch(`${APP}/api/queue/${q.body.item.id}/approve`, { method: "POST" })).json();
  const r = ap.item?.publishResults?.find((x) => x.platform === "facebook");
  ok("approve → posted", ap.item?.status === "posted", ap.item?.status);
  ok("facebook result live + video id", r?.ok && r.mode === "live" && r.externalId === "vid123", JSON.stringify(r));

  const start = calls.find((c) => c.path.endsWith("/video_reels") && JSON.parse(c.body).upload_phase === "start");
  const up = calls.find((c) => c.path === "/video-upload/v21.0/vid123");
  const fin = calls.find((c) => c.path.endsWith("/video_reels") && JSON.parse(c.body).upload_phase === "finish");
  ok("phase order start → upload → finish", start && up && fin && calls.indexOf(start) < calls.indexOf(up) && calls.indexOf(up) < calls.indexOf(fin));
  ok("upload uses Page token in OAuth header", up?.headers.authorization === "OAuth EAA-test-page-token");
  ok("upload sends whole file (file_size = body)", up && Number(up.headers.file_size) === up.body.length && up.body.length === 4096, `${up?.headers.file_size}/${up?.body.length}`);
  const fj = fin ? JSON.parse(fin.body) : {};
  ok("finish publishes with Facebook copy", fj.video_state === "PUBLISHED" && fj.title === "Brass Spiral (test)" && fj.description.includes("#kineticart"), fj.description);

  const again = await fetch(`${APP}/api/queue/${q.body.item.id}/approve`, { method: "POST" });
  ok("re-approve of posted item refused (no duplicate post)", again.status === 409);

  mode = "processing_error";
  const q2 = await queueItem(["facebook"]);
  const ap2 = await (await fetch(`${APP}/api/queue/${q2.body.item.id}/approve`, { method: "POST" })).json();
  ok("processing error → item failed, retryable", ap2.item?.status === "failed", ap2.item?.publishResults?.[0]?.error);

  // disconnect → skipped, not posted
  await fetch(`${APP}/api/connections`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "disconnect", platform: "facebook" }) });
  const q3 = await queueItem(["facebook"]);
  const ap3 = await (await fetch(`${APP}/api/queue/${q3.body.item.id}/approve`, { method: "POST" })).json();
  ok("disconnected → skipped, not posted", ap3.item?.publishResults?.[0]?.mode === "skipped" && ap3.item.status === "failed");
} catch (e) {
  ok("test run", false, e instanceof Error ? e.stack : String(e));
  console.log(appLog.slice(-3000));
} finally {
  try {
    process.kill(-app.pid, "SIGTERM");
  } catch {
    app.kill("SIGTERM");
  }
  mock.close();
  rmSync(DATA, { recursive: true, force: true });
}

const passed = results.filter(Boolean).length;
console.log(`\n=== Summary: ${passed}/${results.length} passed ===`);
process.exit(passed === results.length ? 0 : 1);
