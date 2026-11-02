/**
 * Facebook Page Reels publishing.
 *
 * Facebook rides on the same Meta login as Instagram (no second OAuth flow):
 * the Instagram callback also stores the linked Page's access token here when
 * the login granted `pages_manage_posts`. See saveFacebookPageFromMetaLogin().
 *
 * Publishing uses the Reels Publishing API (three phases):
 *   1. POST /{page-id}/video_reels  upload_phase=start      → video_id
 *   2. POST rupload.facebook.com/video-upload/{v}/{video_id} (binary body)
 *   3. POST /{page-id}/video_reels  upload_phase=finish, video_state=PUBLISHED
 * The binary is uploaded from the server, so no public media URL is needed.
 *
 * GHOSTCUT_META_GRAPH_BASE / GHOSTCUT_META_RUPLOAD_BASE override the hosts
 * (used only by the mocked test in scripts/test-facebook-adapter.mjs).
 */
import { getConnections, saveConnection } from "./store";
import { instagramLiveConfigured } from "./secrets";
import type { Clip, PlatformPack } from "@/lib/clips";
import type { PlatformConnection, PublishResult } from "./types";

export const META_GRAPH_VERSION = "v21.0";
const graphBase = () =>
  (process.env.GHOSTCUT_META_GRAPH_BASE || "https://graph.facebook.com").replace(/\/$/, "");
const ruploadBase = () =>
  (process.env.GHOSTCUT_META_RUPLOAD_BASE || "https://rupload.facebook.com").replace(/\/$/, "");

export const FACEBOOK_PAGE_PERMISSION = "pages_manage_posts";

type PageRow = { id: string; name: string; access_token?: string };

/**
 * Called from the Instagram (Meta) OAuth exchange. Never throws: a Facebook
 * problem must not break the Instagram connection.
 */
export async function saveFacebookPageFromMetaLogin(
  page: PageRow,
  userToken: string,
  expiresAt?: number,
): Promise<{ saved: boolean; reason?: string }> {
  try {
    if (!page.access_token) {
      return { saved: false, reason: "Meta returned no Page access token" };
    }
    const granted = await grantedPermissions(userToken);
    if (granted && !granted.includes(FACEBOOK_PAGE_PERMISSION)) {
      return {
        saved: false,
        reason: `Login did not grant ${FACEBOOK_PAGE_PERMISSION} — add it to the Meta login (or its Business Login configuration) and reconnect`,
      };
    }
    const conn: PlatformConnection = {
      platform: "facebook",
      status: "connected",
      accountLabel: page.name,
      accountId: page.id,
      pageId: page.id,
      connectedAt: new Date().toISOString(),
      accessToken: page.access_token,
      scopes: granted ?? undefined,
      expiresAt,
    };
    saveConnection(conn);
    return { saved: true };
  } catch (e) {
    return { saved: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

async function grantedPermissions(userToken: string): Promise<string[] | null> {
  const r = await fetch(
    `${graphBase()}/${META_GRAPH_VERSION}/me/permissions?access_token=${encodeURIComponent(userToken)}`,
  );
  if (!r.ok) return null; // unknown — business-login tokens may not expose this
  const j = (await r.json()) as { data?: { permission: string; status: string }[] };
  return (j.data ?? []).filter((p) => p.status === "granted").map((p) => p.permission);
}

export function connectFacebookDemo() {
  saveConnection({
    platform: "facebook",
    status: "demo",
    accountLabel: "Gentle Gentlemen Page (demo)",
    connectedAt: new Date().toISOString(),
  });
}

function facebookPack(clip: Clip): PlatformPack {
  return clip.facebook ?? clip.instagram;
}

export function facebookDescription(clip: Clip) {
  const pack = facebookPack(clip);
  const tags = pack.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ");
  return [pack.description || pack.caption, "", tags].join("\n").trim();
}

export async function publishFacebookReel(opts: {
  clip: Clip;
  video: Buffer;
  /** poll interval for processing status (tests use a small value) */
  pollMs?: number;
}): Promise<PublishResult> {
  const at = new Date().toISOString();
  const conn = getConnections().facebook;
  const fail = (error: string): PublishResult => ({
    platform: "facebook",
    ok: false,
    mode: "live",
    error,
    at,
  });

  if (!conn || conn.status === "disconnected") {
    return { platform: "facebook", ok: false, mode: "skipped", error: "Facebook Page not connected", at };
  }
  if (conn.status === "demo" || !instagramLiveConfigured() || !conn.accessToken || !conn.pageId) {
    return {
      platform: "facebook",
      ok: true,
      mode: "demo",
      url: "https://facebook.com/ (demo — would publish Page Reel)",
      externalId: `demo-fb-${opts.clip.id}`,
      at,
    };
  }

  const token = conn.accessToken;
  const pageUrl = `${graphBase()}/${META_GRAPH_VERSION}/${conn.pageId}/video_reels`;

  // 1. start
  const startRes = await fetch(pageUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ upload_phase: "start", access_token: token }),
  });
  if (!startRes.ok) return fail(`FB reel start failed: ${await startRes.text()}`);
  const { video_id: videoId } = (await startRes.json()) as { video_id?: string };
  if (!videoId) return fail("FB reel start returned no video_id");

  // 2. binary upload
  const upRes = await fetch(`${ruploadBase()}/video-upload/${META_GRAPH_VERSION}/${videoId}`, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${token}`,
      offset: "0",
      file_size: String(opts.video.length),
      "Content-Type": "application/octet-stream",
    },
    body: new Uint8Array(opts.video),
  });
  if (!upRes.ok) return fail(`FB reel upload failed: ${await upRes.text()}`);

  // 3. finish + publish
  const pack = facebookPack(opts.clip);
  const finRes = await fetch(pageUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      upload_phase: "finish",
      video_id: videoId,
      video_state: "PUBLISHED",
      title: pack.title?.slice(0, 255),
      description: facebookDescription(opts.clip),
      access_token: token,
    }),
  });
  if (!finRes.ok) return fail(`FB reel publish failed: ${await finRes.text()}`);

  // Processing is asynchronous: poll briefly and surface hard errors.
  const pollMs = opts.pollMs ?? 3000;
  for (let i = 0; i < 20; i++) {
    const st = await fetch(
      `${graphBase()}/${META_GRAPH_VERSION}/${videoId}?fields=status&access_token=${encodeURIComponent(token)}`,
    );
    if (st.ok) {
      const body = (await st.json()) as {
        status?: { video_status?: string; processing_phase?: { status?: string; error?: unknown } };
      };
      const vs = body.status?.video_status;
      if (vs === "ready") break;
      if (vs === "error" || vs === "upload_failed" || body.status?.processing_phase?.status === "error") {
        return { ...fail(`Facebook processing failed (${vs || "error"})`), externalId: videoId };
      }
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }

  return {
    platform: "facebook",
    ok: true,
    mode: "live",
    externalId: videoId,
    url: `https://www.facebook.com/reel/${videoId}`,
    at,
  };
}
