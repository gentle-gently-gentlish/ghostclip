import { connection } from "next/server";
import { NextResponse } from "next/server";
import {
  absoluteVideoPath,
  getQueueItem,
  readVideoFile,
} from "@/lib/publish/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  await connection();
  const { id } = await ctx.params;
  const item = getQueueItem(id);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const buf = readVideoFile(absoluteVideoPath(item.videoPath));
  if (!buf) {
    return NextResponse.json({ error: "Video missing" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(buf.length),
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `inline; filename="${item.filename}"`,
    },
  });
}
