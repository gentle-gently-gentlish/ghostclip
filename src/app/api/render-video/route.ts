import { NextResponse } from "next/server";
import { createCanvas } from "canvas";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { spawn } from "child_process";
import { paintFrame, VIDEO } from "@/lib/video/scenes";
import type { SeriesId } from "@/lib/niches";
import { SERIES } from "@/lib/niches";

export const maxDuration = 120;

const SERIES_IDS = new Set(SERIES.map((s) => s.id));

function run(cmd: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("close", (code) => {
      if (code === 0) resolve(0);
      else reject(new Error(stderr.slice(-800) || `exit ${code}`));
    });
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      seriesId?: string;
      channelName?: string;
      clipId?: string;
    };

    const seriesId = body.seriesId as SeriesId | undefined;
    const channelName = body.channelName?.trim() || "Gentle Gentlemen";
    if (!seriesId || !SERIES_IDS.has(seriesId)) {
      return NextResponse.json({ error: "Invalid seriesId" }, { status: 400 });
    }

    const { width, height, fps, durationSec } = VIDEO;
    const totalFrames = fps * durationSec;
    const dir = await mkdtemp(join(tmpdir(), "ghostcut-frames-"));
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    try {
      for (let frame = 0; frame < totalFrames; frame++) {
        paintFrame(ctx as never, seriesId, frame, totalFrames, channelName);
        const file = join(dir, `frame-${String(frame).padStart(5, "0")}.png`);
        await writeFile(file, canvas.toBuffer("image/png"));
      }

      const output = join(dir, "loop.mp4");
      await run("ffmpeg", [
        "-y",
        "-framerate",
        String(fps),
        "-i",
        join(dir, "frame-%05d.png"),
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-an",
        output,
      ]);

      const mp4 = await readFile(output);
      const name = `${body.clipId || seriesId}-loop.mp4`;
      return new NextResponse(new Uint8Array(mp4), {
        headers: {
          "Content-Type": "video/mp4",
          "Content-Disposition": `attachment; filename="${name}"`,
          "X-Ghostcut-Frames": String(totalFrames),
        },
      });
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Render failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
