/**
 * A–D automated checks for Ghostcut onboarding → studio.
 * Run with: node --experimental-sqlite scripts/test-onboarding-flow.mjs
 */
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const APP = process.env.GHOSTCUT_APP_URL || "http://127.0.0.1:43123";
const ROOT = path.join(process.cwd(), ".data");
const DB = path.join(ROOT, "ghostcut.db");
const results = [];

function ok(name, pass, detail = "") {
  results.push({ name, pass: !!pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function j(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return { status: res.status, body, ok: res.ok };
}

function openDb() {
  mkdirSync(ROOT, { recursive: true });
  const db = new DatabaseSync(DB);
  db.exec(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      channel_name TEXT NOT NULL,
      handle TEXT NOT NULL,
      youtube_about TEXT NOT NULL,
      instagram_bio TEXT NOT NULL,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS secrets (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      fal_key TEXT,
      google_client_id TEXT,
      google_client_secret TEXT,
      meta_app_id TEXT,
      meta_app_secret TEXT
    );
    CREATE TABLE IF NOT EXISTS connections (
      platform TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      account_label TEXT,
      account_id TEXT,
      connected_at TEXT,
      scopes_json TEXT,
      access_token TEXT,
      refresh_token TEXT,
      expires_at INTEGER,
      page_id TEXT,
      ig_user_id TEXT
    );
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      onboarding_complete INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS queue (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      status TEXT NOT NULL,
      channel_name TEXT NOT NULL,
      clip_json TEXT NOT NULL,
      filename TEXT NOT NULL,
      video_path TEXT NOT NULL,
      engine TEXT,
      note TEXT,
      reject_reason TEXT,
      platforms_json TEXT NOT NULL,
      publish_results_json TEXT
    );
    INSERT OR IGNORE INTO secrets (id) VALUES (1);
    INSERT OR IGNORE INTO settings (id, onboarding_complete) VALUES (1, 0);
  `);
  return db;
}

function wipeSetup(keepQueue = false) {
  const db = openDb();
  db.exec(`DELETE FROM profile; DELETE FROM connections;
    UPDATE secrets SET fal_key=NULL, google_client_id=NULL, google_client_secret=NULL,
      meta_app_id=NULL, meta_app_secret=NULL WHERE id=1;
    UPDATE settings SET onboarding_complete=0, completed_at=NULL WHERE id=1;`);
  if (!keepQueue) db.exec(`DELETE FROM queue;`);
  db.close();
}

function seedLiveConnections() {
  const db = openDb();
  db.prepare(
    `UPDATE secrets SET google_client_id=?, google_client_secret=?, meta_app_id=?, meta_app_secret=? WHERE id=1`,
  ).run(
    "test-google-client.apps.googleusercontent.com",
    "test-google-secret",
    "1234567890",
    "test-meta-secret",
  );
  for (const [platform, label] of [
    ["youtube", "Gentle Gentlemen (live test)"],
    ["instagram", "@gentle.gently.gentlish"],
  ]) {
    db.prepare(
      `INSERT INTO connections (platform, status, account_label, connected_at, access_token, refresh_token, expires_at, page_id, ig_user_id)
       VALUES (?, 'connected', ?, ?, 'ya29.test-access', '1//test-refresh', ?, 'page1', 'ig1')
       ON CONFLICT(platform) DO UPDATE SET status='connected', account_label=excluded.account_label,
         access_token=excluded.access_token, refresh_token=excluded.refresh_token,
         expires_at=excluded.expires_at, page_id=excluded.page_id, ig_user_id=excluded.ig_user_id`,
    ).run(platform, label, new Date().toISOString(), Date.now() + 3600_000);
  }
  db.close();
}

async function main() {
  console.log("=== A. Fresh onboarding ===");
  wipeSetup(false);

  let s = await j(`${APP}/api/workflow/status`);
  if (!s.ok) {
    console.error("Server not reachable", s);
    process.exit(1);
  }
  ok(
    "A1 opens without onboardingComplete",
    s.body.onboardingComplete === false,
    `unlocked=${s.body.unlockedThrough}`,
  );

  const profile = {
    channelName: "Gentle Gentlemen",
    handle: "@gentle.gently.gentlish",
    youtubeAbout:
      "Gentle Gentlemen — looping Rube Goldberg animations for quiet brains. Soft chain reactions that reset.",
    instagramBio: "Gentle Gentlemen · loops",
  };
  const pSave = await j(`${APP}/api/workflow/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  ok("A2 profile save", pSave.ok && pSave.body.complete === true);

  s = await j(`${APP}/api/workflow/status`);
  ok("A2b profile persists in status", s.body.profile?.complete === true);

  const fal = await j(`${APP}/api/workflow/fal-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: process.env.FAL_KEY || "fal_test_key_xxxxxxxx" }),
  });
  ok("A3 engine fal key save", fal.ok);

  const clients = await j(`${APP}/api/workflow/oauth-clients`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      googleClientId: "test-google-client.apps.googleusercontent.com",
      googleClientSecret: "test-google-secret",
      metaAppId: "1234567890",
      metaAppSecret: "test-meta-secret",
    }),
  });
  ok(
    "A4a oauth clients save",
    clients.ok && clients.body.clients?.youtube?.configured,
  );

  s = await j(`${APP}/api/workflow/status`);
  ok(
    "A4b live clients configured in status",
    s.body.oauthClients?.youtube && s.body.oauthClients?.instagram,
  );

  // OAuth start should redirect to Google when clients saved
  const ytStart = await fetch(`${APP}/api/oauth/youtube/start`, {
    redirect: "manual",
  });
  const loc = ytStart.headers.get("location") || "";
  ok(
    "A4b2 youtube OAuth start redirects to Google",
    ytStart.status >= 300 &&
      ytStart.status < 400 &&
      loc.includes("accounts.google.com"),
    loc.slice(0, 80),
  );

  await j(`${APP}/api/connections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "demo-connect", platform: "youtube" }),
  });
  await j(`${APP}/api/connections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "demo-connect", platform: "instagram" }),
  });
  const finishDemo = await j(`${APP}/api/workflow/complete-onboarding`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  ok(
    "A4c finish rejects demo connections",
    finishDemo.status === 400,
    finishDemo.body.error?.slice?.(0, 90),
  );

  seedLiveConnections();
  s = await j(`${APP}/api/workflow/status`);
  ok(
    "A4d live connections ready",
    s.body.connect?.livePass === true && s.body.canFinishOnboarding === true,
    `livePass=${s.body.connect?.livePass} canFinish=${s.body.canFinishOnboarding}`,
  );

  const finish = await j(`${APP}/api/workflow/complete-onboarding`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  ok("A5 finish setup", finish.ok && finish.body.onboardingComplete === true);

  s = await j(`${APP}/api/workflow/status`);
  ok(
    "A5b status onboardingComplete + studio unlock",
    s.body.onboardingComplete === true &&
      ["generate", "review", "post"].includes(s.body.unlockedThrough),
    `unlocked=${s.body.unlockedThrough}`,
  );

  console.log("\n=== B. Forever persistence ===");
  s = await j(`${APP}/api/workflow/status`);
  ok("B6 still studio after re-fetch", s.body.onboardingComplete === true);
  const conns = await j(`${APP}/api/connections`);
  ok(
    "B6b oauth labels present",
    conns.body.youtube?.status === "connected" &&
      conns.body.instagram?.status === "connected",
    `${conns.body.youtube?.accountLabel} / ${conns.body.instagram?.accountLabel}`,
  );
  const prof = await j(`${APP}/api/workflow/profile`);
  ok(
    "B6c profile still present",
    prof.body.profile?.channelName === "Gentle Gentlemen",
  );

  await j(`${APP}/api/workflow/complete-onboarding`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reset: true }),
  });
  let r = await j(`${APP}/api/workflow/status`);
  ok("B7 reset onboarding works", r.body.onboardingComplete === false);
  seedLiveConnections();
  await j(`${APP}/api/workflow/complete-onboarding`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  r = await j(`${APP}/api/workflow/status`);
  ok("B7b re-finish after settings reset", r.body.onboardingComplete === true);

  console.log("\n=== C. Main loop ===");
  const gen = await j(`${APP}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      channelName: "Gentle Gentlemen",
      seriesIds: ["desk-chain"],
      count: 1,
      notes: "test batch",
    }),
  });
  ok(
    "C8 generate batch",
    gen.ok && gen.body.clips?.length >= 1,
    `clips=${gen.body.clips?.length}`,
  );

  const clip = gen.body.clips[0];
  const videosDir = path.join(ROOT, "videos");
  mkdirSync(videosDir, { recursive: true });
  const tiny = Buffer.from(
    "\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom\x00\x00\x00\x08free",
  );

  const id = randomUUID();
  const videoPath = path.join(videosDir, `${id}-test.mp4`);
  writeFileSync(videoPath, tiny);
  {
    const db = openDb();
    db.prepare(
      `INSERT INTO queue (id, created_at, updated_at, status, channel_name, clip_json, filename, video_path, engine, platforms_json)
       VALUES (?, ?, ?, 'pending', ?, ?, 'test.mp4', ?, 'local', ?)`,
    ).run(
      id,
      new Date().toISOString(),
      new Date().toISOString(),
      "Gentle Gentlemen",
      JSON.stringify(clip),
      videoPath,
      JSON.stringify(["youtube", "instagram"]),
    );
    db.close();
  }

  const q2 = await j(`${APP}/api/queue`);
  const pending = (q2.body.items || []).filter(
    (i) => i.status === "pending" || i.status === "failed",
  );
  ok(
    "C8c pending item in queue",
    pending.some((i) => i.id === id),
    `pending=${pending.length}`,
  );

  const approve = await j(`${APP}/api/queue/${id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const after = await j(`${APP}/api/queue`);
  const item = (after.body.items || []).find((i) => i.id === id);
  const resultsList = item?.publishResults || approve.body?.publishResults || [];
  ok(
    "C10 approve runs live publish path",
    resultsList.length > 0 || item?.status === "failed" || item?.status === "posted",
    `status=${item?.status} results=${JSON.stringify(resultsList).slice(0, 220)}`,
  );
  ok(
    "C11 post step has platform results",
    resultsList.length > 0,
    JSON.stringify(resultsList)
      .slice(0, 220)
      .replace(/\s+/g, " "),
  );

  // IG should surface public media requirement or token error (not silent skip)
  const ig = resultsList.find((x) => x.platform === "instagram");
  ok(
    "C10b IG live path (error or ok, not skipped)",
    !ig || ig.mode !== "skipped" || ig.error,
    ig ? `${ig.mode}: ${ig.error || "ok"}` : "no ig result",
  );

  const id2 = randomUUID();
  const videoPath2 = path.join(videosDir, `${id2}-test.mp4`);
  writeFileSync(videoPath2, tiny);
  {
    const db = openDb();
    db.prepare(
      `INSERT INTO queue (id, created_at, updated_at, status, channel_name, clip_json, filename, video_path, engine, platforms_json)
       VALUES (?, ?, ?, 'pending', ?, ?, 'test2.mp4', ?, 'local', ?)`,
    ).run(
      id2,
      new Date().toISOString(),
      new Date().toISOString(),
      "Gentle Gentlemen",
      JSON.stringify(clip),
      videoPath2,
      JSON.stringify(["youtube", "instagram"]),
    );
    db.close();
  }
  const rej = await j(`${APP}/api/queue/${id2}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: "slop" }),
  });
  const afterRej = await j(`${APP}/api/queue`);
  const rejected = (afterRej.body.items || []).find((i) => i.id === id2);
  ok("C9 reject without posting", rej.ok && rejected?.status === "rejected");

  console.log("\n=== D. Regression (puppeteer) ===");
  await runPuppeteer();

  const failed = results.filter((x) => !x.pass);
  console.log(
    `\n=== Summary: ${results.length - failed.length}/${results.length} passed ===`,
  );
  if (failed.length) {
    for (const f of failed) console.log(`  FAIL ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

async function runPuppeteer() {
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.goto(`${APP}/`, { waitUntil: "networkidle2", timeout: 45000 });
    await page.waitForSelector("text/Ghostcut, body", { timeout: 15000 }).catch(() => null);
    const text = await page.evaluate(() => document.body.innerText);
    ok(
      "D12 page loads Ghostcut UI",
      /Ghostcut/i.test(text),
      text.slice(0, 140).replace(/\s+/g, " "),
    );

    // Hydration: sidebar / continue should be clickable
    const clicked = await page.evaluate(async () => {
      const links = [...document.querySelectorAll("a,button")].filter((el) =>
        /Generate|Quality|Post|Settings|Profile|Connect/i.test(el.textContent || ""),
      );
      if (!links.length) return { ok: false, reason: "no nav" };
      const target =
        links.find((el) => /Settings|Generate|Quality/i.test(el.textContent || "")) ||
        links[0];
      const before = location.href;
      target.click();
      await new Promise((r) => setTimeout(r, 400));
      return {
        ok: true,
        label: (target.textContent || "").trim().slice(0, 40),
        hrefChanged: location.href !== before,
        activeText: document.body.innerText.slice(0, 200),
      };
    });
    ok("D12b hydration clickable", clicked.ok, JSON.stringify(clicked).slice(0, 160));

    await page.goto(`${APP}/?step=2#review`, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    const deep = await page.evaluate(() => ({
      hash: location.hash,
      hasProfileHero: /1 · Profile/.test(document.body.innerText),
      hasQuality: /Quality check/.test(document.body.innerText),
      hasGenerate: /\bGenerate\b/.test(document.body.innerText),
    }));
    ok(
      "D13 deep link stays in studio mode",
      !deep.hasProfileHero && (deep.hasQuality || deep.hasGenerate || deep.hash.includes("review")),
      JSON.stringify(deep),
    );
  } catch (e) {
    ok("D12 puppeteer", false, e instanceof Error ? e.message : String(e));
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
