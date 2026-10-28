import { NextResponse } from "next/server";
import { hasKlingKey, startKlingRender } from "@/lib/video/kling";
import type { Clip } from "@/lib/clips";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!hasKlingKey()) {
    return NextResponse.json(
      {
        error:
          "Kling is not configured. Add FAL_KEY to the environment (fal.ai), then restart the app.",
      },
      { status: 400 },
    );
  }

  try {
    const body = (await request.json()) as {
      channelName?: string;
      durationSec?: "5" | "6" | "8" | "10";
      clip?: Pick<Clip, "id" | "hook" | "beats" | "seriesName" | "seriesId">;
    };

    if (!body.clip?.hook || !body.clip.seriesId) {
      return NextResponse.json({ error: "clip required" }, { status: 400 });
    }

    const started = await startKlingRender({
      clip: body.clip,
      channelName: body.channelName?.trim() || "Gentle Gentlemen",
      durationSec: body.durationSec || "5",
    });

    return NextResponse.json(started);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kling start failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
