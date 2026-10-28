import { randomBytes } from "crypto";
import { connection } from "next/server";
import { NextResponse } from "next/server";
import { getAppUrl, instagramLiveConfigured } from "@/lib/publish/store";
import { instagramAuthUrl } from "@/lib/publish/instagram";

export async function GET() {
  await connection();
  if (!instagramLiveConfigured()) {
    return NextResponse.redirect(
      `${getAppUrl()}/?oauth=instagram&error=missing_credentials#connect`,
    );
  }
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(instagramAuthUrl(state));
  res.cookies.set("gc_oauth_ig", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
