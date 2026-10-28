import { getMetaOAuthClient } from "./secrets";
import {
  getAppUrl,
  getConnections,
  instagramLiveConfigured,
  saveConnection,
} from "./store";
import type { Clip } from "@/lib/clips";
import type { PlatformConnection, PublishResult } from "./types";

const GRAPH = "https://graph.facebook.com/v21.0";
const FB_AUTH = "https://www.facebook.com/v21.0/dialog/oauth";

const SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
].join(",");

export function instagramAuthUrl(state: string) {
  const { appId } = getMetaOAuthClient();
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: `${getAppUrl()}/api/oauth/instagram/callback`,
    scope: SCOPES,
    response_type: "code",
    state,
  });
  return `${FB_AUTH}?${params.toString()}`;
}

export async function exchangeInstagramCode(code: string): Promise<PlatformConnection> {
  const { appId, appSecret } = getMetaOAuthClient();
  const tokenUrl = new URL(`${GRAPH}/oauth/access_token`);
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set(
    "redirect_uri",
    `${getAppUrl()}/api/oauth/instagram/callback`,
  );
  tokenUrl.searchParams.set("code", code);

  const res = await fetch(tokenUrl);
  if (!res.ok) {
    throw new Error(`Instagram token exchange failed: ${await res.text()}`);
  }
  const short = (await res.json()) as {
    access_token: string;
    expires_in?: number;
  };

  // Long-lived user token
  const llUrl = new URL(`${GRAPH}/oauth/access_token`);
  llUrl.searchParams.set("grant_type", "fb_exchange_token");
  llUrl.searchParams.set("client_id", appId);
  llUrl.searchParams.set("client_secret", appSecret);
  llUrl.searchParams.set("fb_exchange_token", short.access_token);
  const llRes = await fetch(llUrl);
  if (!llRes.ok) {
    throw new Error(`Instagram long-lived token failed: ${await llRes.text()}`);
  }
  const longLived = (await llRes.json()) as {
    access_token: string;
    expires_in?: number;
  };

  // Find Page → linked IG business account
  const pagesRes = await fetch(
    `${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${longLived.access_token}`,
  );
  if (!pagesRes.ok) {
    throw new Error(`Could not list Facebook Pages: ${await pagesRes.text()}`);
  }
  const pages = (await pagesRes.json()) as {
    data?: {
      id: string;
      name: string;
      access_token: string;
      instagram_business_account?: { id: string; username?: string };
    }[];
  };

  const page = pages.data?.find((p) => p.instagram_business_account?.id);
  if (!page?.instagram_business_account) {
    throw new Error(
      "No Instagram Business/Creator account linked to a Facebook Page. Link IG in Meta Business Suite, then reconnect.",
    );
  }

  const conn: PlatformConnection = {
    platform: "instagram",
    status: "connected",
    accountLabel: `@${page.instagram_business_account.username || "instagram"}`,
    accountId: page.instagram_business_account.id,
    pageId: page.id,
    igUserId: page.instagram_business_account.id,
    connectedAt: new Date().toISOString(),
    accessToken: page.access_token,
    expiresAt: longLived.expires_in
      ? Date.now() + longLived.expires_in * 1000
      : undefined,
  };
  saveConnection(conn);
  return conn;
}

/**
 * Instagram Graph Reels publish needs a publicly reachable video URL.
 * When GHOSTCUT_PUBLIC_MEDIA_BASE is set, we point Meta at our queued video route.
 * Otherwise live publish returns a clear error (demo still works).
 */
export async function publishInstagramReel(opts: {
  clip: Clip;
  queueItemId: string;
  videoPublicUrl?: string;
}): Promise<PublishResult> {
  const at = new Date().toISOString();
  const conn = getConnections().instagram;

  if (!conn || conn.status === "disconnected") {
    return {
      platform: "instagram",
      ok: false,
      mode: "skipped",
      error: "Instagram not connected",
      at,
    };
  }

  if (conn.status === "demo" || !instagramLiveConfigured() || !conn.accessToken) {
    return {
      platform: "instagram",
      ok: true,
      mode: "demo",
      url: `https://instagram.com/gentle.gently.gentlish (demo — would publish Reel)`,
      externalId: `demo-ig-${opts.clip.id}`,
      at,
    };
  }

  const videoUrl =
    opts.videoPublicUrl ||
    (process.env.GHOSTCUT_PUBLIC_MEDIA_BASE
      ? `${process.env.GHOSTCUT_PUBLIC_MEDIA_BASE}/api/queue/${opts.queueItemId}/video`
      : null);

  if (!videoUrl || videoUrl.includes("127.0.0.1") || videoUrl.includes("localhost")) {
    return {
      platform: "instagram",
      ok: false,
      mode: "live",
      error:
        "Instagram needs a public HTTPS video URL. Set GHOSTCUT_PUBLIC_MEDIA_BASE to your deployed app URL, then approve again.",
      at,
    };
  }

  const caption = [
    opts.clip.instagram.caption,
    "",
    opts.clip.instagram.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" "),
  ].join("\n");

  const igUserId = conn.igUserId!;
  const createRes = await fetch(`${GRAPH}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_type: "REELS",
      video_url: videoUrl,
      caption,
      share_to_feed: true,
      access_token: conn.accessToken,
    }),
  });

  if (!createRes.ok) {
    return {
      platform: "instagram",
      ok: false,
      mode: "live",
      error: `IG container create failed: ${await createRes.text()}`,
      at,
    };
  }

  const created = (await createRes.json()) as { id: string };
  // Poll container status briefly
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const st = await fetch(
      `${GRAPH}/${created.id}?fields=status_code&access_token=${conn.accessToken}`,
    );
    if (st.ok) {
      const body = (await st.json()) as { status_code?: string };
      if (body.status_code === "FINISHED") break;
      if (body.status_code === "ERROR") {
        return {
          platform: "instagram",
          ok: false,
          mode: "live",
          error: "Instagram finished processing with ERROR",
          at,
        };
      }
    }
  }

  const pubRes = await fetch(`${GRAPH}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      creation_id: created.id,
      access_token: conn.accessToken,
    }),
  });

  if (!pubRes.ok) {
    return {
      platform: "instagram",
      ok: false,
      mode: "live",
      error: `IG publish failed: ${await pubRes.text()}`,
      at,
    };
  }

  const published = (await pubRes.json()) as { id?: string };
  return {
    platform: "instagram",
    ok: true,
    mode: "live",
    externalId: published.id,
    url: published.id
      ? `https://www.instagram.com/reel/${published.id}/`
      : undefined,
    at,
  };
}

export function connectInstagramDemo() {
  saveConnection({
    platform: "instagram",
    status: "demo",
    accountLabel: "@gentle.gently.gentlish (demo)",
    connectedAt: new Date().toISOString(),
  });
}
