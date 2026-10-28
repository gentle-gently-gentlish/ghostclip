import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Password gate for the deployed app.
 *
 * Set GHOSTCUT_PASSWORD (e.g. `fly secrets set GHOSTCUT_PASSWORD=...`) and the
 * whole studio sits behind a browser login prompt (any username, that password).
 * Unset = no gate (local dev).
 *
 * Left open on purpose:
 *  - /api/queue/<id>/video — Instagram's servers must fetch the MP4 to publish a
 *    Reel; ids are random UUIDs so they can't be guessed.
 *  - /api/oauth/<platform>/callback — Google/Meta redirect back here; protected
 *    by the OAuth `state` cookie check.
 */
const OPEN = [
  /^\/api\/queue\/[^/]+\/video$/,
  /^\/api\/oauth\/(youtube|instagram)\/callback$/,
];

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function proxy(request: NextRequest) {
  const password = process.env.GHOSTCUT_PASSWORD?.trim();
  if (!password) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (OPEN.some((re) => re.test(pathname))) return NextResponse.next();

  const header = request.headers.get("authorization") || "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const given = decoded.slice(decoded.indexOf(":") + 1);
      if (safeEqual(given, password)) return NextResponse.next();
    } catch {
      /* fall through */
    }
  }

  return new NextResponse("Login required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Ghostcut", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
