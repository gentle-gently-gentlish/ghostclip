import { randomBytes } from "crypto";
import { connection } from "next/server";
import { NextResponse } from "next/server";
import { getAppUrl, youtubeLiveConfigured } from "@/lib/publish/store";
import { youtubeAuthUrl } from "@/lib/publish/youtube";

export async function GET() {
  await connection();
  if (!youtubeLiveConfigured()) {
    return NextResponse.redirect(
      `${getAppUrl()}/?oauth=youtube&error=missing_credentials#connect`,
    );
  }
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(youtubeAuthUrl(state));
  res.cookies.set("gc_oauth_yt", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
