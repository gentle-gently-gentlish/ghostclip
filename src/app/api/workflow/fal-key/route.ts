import { connection } from "next/server";
import { NextResponse } from "next/server";
import { clearFalKey, falKeySource, setFalKey } from "@/lib/publish/secrets";
import { hasKlingKey } from "@/lib/video/kling";

export async function GET() {
  await connection();
  return NextResponse.json({
    kling: hasKlingKey(),
    source: falKeySource(),
  });
}

export async function POST(request: Request) {
  await connection();
  const body = (await request.json()) as { key?: string; clear?: boolean };
  if (body.clear) {
    clearFalKey();
  } else if (typeof body.key === "string") {
    if (body.key.trim().length < 8) {
      return NextResponse.json({ error: "Key looks too short" }, { status: 400 });
    }
    setFalKey(body.key);
  } else {
    return NextResponse.json({ error: "key required" }, { status: 400 });
  }
  return NextResponse.json({
    kling: hasKlingKey(),
    source: falKeySource(),
  });
}
