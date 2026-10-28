import { NextResponse } from "next/server";
import { generateClipBatch } from "@/lib/clips";
import type { SeriesId } from "@/lib/niches";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      channelName?: string;
      seriesIds?: SeriesId[];
      count?: number;
      notes?: string;
    };

    if (!body.channelName?.trim()) {
      return NextResponse.json(
        { error: "channelName is required." },
        { status: 400 },
      );
    }

    const result = await generateClipBatch({
      channelName: body.channelName,
      seriesIds: body.seriesIds,
      count: body.count,
      notes: body.notes,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
