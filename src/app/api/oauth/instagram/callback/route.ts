import { connection } from "next/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/publish/store";
import { exchangeInstagramCode } from "@/lib/publish/instagram";

export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  const jar = await cookies();
  const expected = jar.get("gc_oauth_ig")?.value;

  if (err) {
    return NextResponse.redirect(
      `${getAppUrl()}/?oauth=instagram&error=${encodeURIComponent(err)}#connect`,
    );
  }
  if (!code || !state || !expected || state !== expected) {
    return NextResponse.redirect(
      `${getAppUrl()}/?oauth=instagram&error=invalid_state#connect`,
    );
  }

  try {
    await exchangeInstagramCode(code);
    const res = NextResponse.redirect(
      `${getAppUrl()}/?oauth=instagram&ok=1#connect`,
    );
    res.cookies.set("gc_oauth_ig", "", { path: "/", maxAge: 0 });
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "oauth_failed";
    return NextResponse.redirect(
      `${getAppUrl()}/?oauth=instagram&error=${encodeURIComponent(msg)}#connect`,
    );
  }
}
