import { NextResponse } from "next/server";
import { getKlingStatus, hasKlingKey } from "@/lib/video/kling";

export const maxDuration = 30;

export async function GET(request: Request) {
  if (!hasKlingKey()) {
    return NextResponse.json({ error: "FAL_KEY not set" }, { status: 400 });
  }

  const requestId = new URL(request.url).searchParams.get("requestId");
  if (!requestId) {
    return NextResponse.json({ error: "requestId required" }, { status: 400 });
  }

  try {
    const status = await getKlingStatus(requestId);
    return NextResponse.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Status failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
