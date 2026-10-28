import { connection } from "next/server";
import { NextResponse } from "next/server";
import {
  clearConnection,
  getAppUrl,
  getConnections,
  getOAuthRedirectUris,
  instagramLiveConfigured,
  publicMediaBaseConfigured,
  youtubeLiveConfigured,
} from "@/lib/publish/store";
import { connectInstagramDemo } from "@/lib/publish/instagram";
import { connectYoutubeDemo } from "@/lib/publish/youtube";
import type { ConnectionsPublic, Platform } from "@/lib/publish/types";

export async function GET() {
  await connection();
  const all = getConnections();
  const payload: ConnectionsPublic = {
    youtube: {
      status: all.youtube?.status || "disconnected",
      accountLabel: all.youtube?.accountLabel,
      connectedAt: all.youtube?.connectedAt,
      liveConfigured: youtubeLiveConfigured(),
    },
    instagram: {
      status: all.instagram?.status || "disconnected",
      accountLabel: all.instagram?.accountLabel,
      connectedAt: all.instagram?.connectedAt,
      liveConfigured: instagramLiveConfigured(),
    },
    appUrl: getAppUrl(),
    redirectUris: getOAuthRedirectUris(),
    publicMediaConfigured: publicMediaBaseConfigured(),
  };
  return NextResponse.json(payload);
}

export async function POST(request: Request) {
  await connection();
  const body = (await request.json()) as {
    action?: "demo-connect" | "disconnect";
    platform?: Platform;
  };

  if (!body.platform || !["youtube", "instagram"].includes(body.platform)) {
    return NextResponse.json({ error: "platform required" }, { status: 400 });
  }

  if (body.action === "disconnect") {
    clearConnection(body.platform);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "demo-connect") {
    if (body.platform === "youtube") connectYoutubeDemo();
    else connectInstagramDemo();
    return NextResponse.json({ ok: true, mode: "demo" });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
