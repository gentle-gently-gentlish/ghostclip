import { connection } from "next/server";
import { NextResponse } from "next/server";
import { hasKlingKey } from "@/lib/video/kling";

export async function GET() {
  await connection();
  return NextResponse.json({
    kling: hasKlingKey(),
    local: true,
    defaultEngine: hasKlingKey() ? "kling" : "local",
  });
}
