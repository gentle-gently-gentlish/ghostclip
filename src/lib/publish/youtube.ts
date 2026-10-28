import { getGoogleOAuthClient } from "./secrets";
import {
  getAppUrl,
  getConnections,
  saveConnection,
  youtubeLiveConfigured,
} from "./store";
import type { Clip } from "@/lib/clips";
import type { PlatformConnection, PublishResult } from "./types";

const YT_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const YT_TOKEN = "https://oauth2.googleapis.com/token";
const YT_UPLOAD = "https://www.googleapis.com/upload/youtube/v3/videos";
const YT_CHANNELS = "https://www.googleapis.com/youtube/v3/channels";

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
].join(" ");

export function youtubeAuthUrl(state: string) {
  const { clientId } = getGoogleOAuthClient();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${getAppUrl()}/api/oauth/youtube/callback`,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${YT_AUTH}?${params.toString()}`;
}

export async function exchangeYoutubeCode(code: string): Promise<PlatformConnection> {
  const { clientId, clientSecret } = getGoogleOAuthClient();
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: `${getAppUrl()}/api/oauth/youtube/callback`,
    grant_type: "authorization_code",
  });

  const res = await fetch(YT_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`YouTube token exchange failed: ${await res.text()}`);
  }
  const tokens = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  };

  const chRes = await fetch(`${YT_CHANNELS}?part=snippet&mine=true`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  let label = "YouTube channel";
  let accountId: string | undefined;
  if (chRes.ok) {
    const data = (await chRes.json()) as {
      items?: { id: string; snippet?: { title?: string } }[];
    };
    const ch = data.items?.[0];
    if (ch) {
      accountId = ch.id;
      label = ch.snippet?.title || label;
    }
  }

  const conn: PlatformConnection = {
    platform: "youtube",
    status: "connected",
    accountLabel: label,
    accountId,
    connectedAt: new Date().toISOString(),
    scopes: tokens.scope?.split(" "),
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };
  saveConnection(conn);
  return conn;
}

async function refreshYoutubeToken(conn: PlatformConnection): Promise<PlatformConnection> {
  if (!conn.refreshToken) return conn;
  if (conn.expiresAt && conn.expiresAt > Date.now() + 60_000) return conn;

  const { clientId, clientSecret } = getGoogleOAuthClient();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: conn.refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(YT_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`YouTube refresh failed: ${await res.text()}`);
  }
  const tokens = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  const next = {
    ...conn,
    accessToken: tokens.access_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };
  saveConnection(next);
  return next;
}

export async function publishYoutubeShort(opts: {
  clip: Clip;
  video: Buffer;
  mimeType?: string;
}): Promise<PublishResult> {
  const at = new Date().toISOString();
  const conn = getConnections().youtube;

  if (!conn || conn.status === "disconnected") {
    return {
      platform: "youtube",
      ok: false,
      mode: "skipped",
      error: "YouTube not connected",
      at,
    };
  }

  if (conn.status === "demo" || !youtubeLiveConfigured() || !conn.accessToken) {
    return {
      platform: "youtube",
      ok: true,
      mode: "demo",
      url: `https://youtube.com/@gentle.gently.gentlish (demo — would upload Short)`,
      externalId: `demo-yt-${opts.clip.id}`,
      at,
    };
  }

  const live = await refreshYoutubeToken(conn);
  const title = opts.clip.youtube.title.slice(0, 95);
  const description = [
    opts.clip.youtube.description || opts.clip.youtube.caption,
    "",
    opts.clip.youtube.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" "),
    "",
    "#Shorts",
  ].join("\n");

  const metadata = {
    snippet: {
      title,
      description,
      categoryId: "22",
      tags: opts.clip.youtube.hashtags.map((h) => h.replace(/^#/, "")).slice(0, 15),
    },
    status: {
      privacyStatus: "public",
      selfDeclaredMadeForKids: false,
    },
  };

  const boundary = `ghostcut_${Date.now()}`;
  const metaPart = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
  );
  const mediaHeader = Buffer.from(
    `--${boundary}\r\nContent-Type: ${opts.mimeType || "video/mp4"}\r\n\r\n`,
  );
  const end = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([metaPart, mediaHeader, opts.video, end]);

  const res = await fetch(
    `${YT_UPLOAD}?uploadType=multipart&part=snippet,status`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${live.accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "Content-Length": String(body.length),
      },
      body,
    },
  );

  if (!res.ok) {
    return {
      platform: "youtube",
      ok: false,
      mode: "live",
      error: `YouTube upload failed: ${await res.text()}`,
      at,
    };
  }

  const data = (await res.json()) as { id?: string };
  const id = data.id;
  return {
    platform: "youtube",
    ok: true,
    mode: "live",
    externalId: id,
    url: id ? `https://youtube.com/shorts/${id}` : undefined,
    at,
  };
}

export function connectYoutubeDemo() {
  saveConnection({
    platform: "youtube",
    status: "demo",
    accountLabel: "Gentle Gentlemen (demo)",
    connectedAt: new Date().toISOString(),
  });
}
