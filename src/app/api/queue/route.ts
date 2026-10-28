import { connection } from "next/server";
import { NextResponse } from "next/server";
import type { Clip } from "@/lib/clips";
import {
  createQueueId,
  getQueue,
  saveVideoBuffer,
  toPublicQueueItem,
  upsertQueueItem,
} from "@/lib/publish/store";
import type { Platform, QueueItem } from "@/lib/publish/types";

export async function GET() {
  await connection();
  const items = getQueue().map(toPublicQueueItem);
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  await connection();
  const form = await request.formData();
  const video = form.get("video");
  const metaRaw = form.get("meta");

  if (!(video instanceof File)) {
    return NextResponse.json({ error: "video file required" }, { status: 400 });
  }
  if (typeof metaRaw !== "string") {
    return NextResponse.json({ error: "meta JSON required" }, { status: 400 });
  }

  let meta: {
    clip: Clip;
    channelName: string;
    filename?: string;
    engine?: string;
    platforms?: Platform[];
    note?: string;
  };
  try {
    meta = JSON.parse(metaRaw);
  } catch {
    return NextResponse.json({ error: "invalid meta JSON" }, { status: 400 });
  }

  if (!meta.clip?.id) {
    return NextResponse.json({ error: "clip required" }, { status: 400 });
  }

  const id = createQueueId();
  const filename = meta.filename || video.name || `${meta.clip.id}.mp4`;
  const buffer = Buffer.from(await video.arrayBuffer());
  const videoPath = saveVideoBuffer(id, buffer, filename);

  const now = new Date().toISOString();
  const item: QueueItem = {
    id,
    createdAt: now,
    updatedAt: now,
    status: "pending",
    channelName: meta.channelName || "Gentle Gentlemen",
    clip: meta.clip,
    filename,
    videoPath,
    engine: meta.engine,
    note: meta.note,
    platforms: meta.platforms?.length
      ? meta.platforms
      : ["youtube", "instagram"],
  };

  upsertQueueItem(item);
  return NextResponse.json({ item: toPublicQueueItem(item) });
}
