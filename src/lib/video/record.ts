import type { SeriesId } from "@/lib/niches";
import type { Clip } from "@/lib/clips";

export type RenderEngine = "kling" | "local";

export type RenderProgress = {
  phase: "queued" | "rendering" | "done" | "error";
  ratio: number;
  message: string;
};

export type RenderResult = {
  mp4: Blob;
  url: string;
  filename: string;
  engine: RenderEngine;
  prompt?: string;
};

export async function renderLoopVideo(opts: {
  engine: RenderEngine;
  seriesId: SeriesId;
  channelName: string;
  clipId: string;
  clip?: Pick<Clip, "id" | "hook" | "beats" | "seriesName" | "seriesId">;
  onProgress?: (p: RenderProgress) => void;
}): Promise<RenderResult> {
  if (opts.engine === "kling") {
    return renderWithKling(opts);
  }
  return renderLocal(opts);
}

async function renderLocal(opts: {
  seriesId: SeriesId;
  channelName: string;
  clipId: string;
  onProgress?: (p: RenderProgress) => void;
}): Promise<RenderResult> {
  opts.onProgress?.({
    phase: "rendering",
    ratio: 0.15,
    message: "Rendering local loop (canvas + ffmpeg)…",
  });

  let tick = 0.15;
  const timer = window.setInterval(() => {
    tick = Math.min(0.9, tick + 0.04);
    opts.onProgress?.({
      phase: "rendering",
      ratio: tick,
      message: "Drawing frames + encoding MP4…",
    });
  }, 400);

  try {
    const res = await fetch("/api/render-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seriesId: opts.seriesId,
        channelName: opts.channelName,
        clipId: opts.clipId,
      }),
    });

    if (!res.ok) {
      let message = "Local render failed";
      try {
        const data = (await res.json()) as { error?: string };
        message = data.error || message;
      } catch {
        /* ignore */
      }
      throw new Error(message);
    }

    const mp4 = await res.blob();
    const url = URL.createObjectURL(mp4);
    opts.onProgress?.({
      phase: "done",
      ratio: 1,
      message: "Local MP4 ready",
    });
    return {
      mp4,
      url,
      filename: `${opts.clipId || opts.seriesId}-local-loop.mp4`,
      engine: "local",
    };
  } finally {
    window.clearInterval(timer);
  }
}

async function renderWithKling(opts: {
  channelName: string;
  clipId: string;
  seriesId: SeriesId;
  clip?: Pick<Clip, "id" | "hook" | "beats" | "seriesName" | "seriesId">;
  onProgress?: (p: RenderProgress) => void;
}): Promise<RenderResult> {
  if (!opts.clip) throw new Error("Clip data required for Kling.");

  opts.onProgress?.({
    phase: "queued",
    ratio: 0.05,
    message: "Submitting to Kling (fal.ai)…",
  });

  const startRes = await fetch("/api/kling/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      channelName: opts.channelName,
      durationSec: "5",
      clip: opts.clip,
    }),
  });

  const startData = (await startRes.json()) as {
    requestId?: string;
    prompt?: string;
    error?: string;
  };

  if (!startRes.ok || !startData.requestId) {
    throw new Error(startData.error || "Could not start Kling job");
  }

  const prompt = startData.prompt;
  let attempts = 0;
  const maxAttempts = 90; // ~3 min at 2s

  while (attempts < maxAttempts) {
    attempts++;
    await new Promise((r) => setTimeout(r, 2000));

    const statusRes = await fetch(
      `/api/kling/status?requestId=${encodeURIComponent(startData.requestId)}`,
    );
    const status = (await statusRes.json()) as {
      status?: string;
      queuePosition?: number;
      videoUrl?: string;
      error?: string;
    };

    if (!statusRes.ok) {
      throw new Error(status.error || "Kling status error");
    }

    if (status.status === "IN_QUEUE") {
      opts.onProgress?.({
        phase: "queued",
        ratio: Math.min(0.25, 0.08 + attempts * 0.01),
        message: `Kling queued${status.queuePosition != null ? ` (#${status.queuePosition})` : ""}…`,
      });
      continue;
    }

    if (status.status === "IN_PROGRESS") {
      opts.onProgress?.({
        phase: "rendering",
        ratio: Math.min(0.85, 0.3 + attempts * 0.015),
        message: "Kling is rendering your loop…",
      });
      continue;
    }

    if (status.status === "FAILED") {
      throw new Error(status.error || "Kling failed");
    }

    if (status.status === "COMPLETED" && status.videoUrl) {
      opts.onProgress?.({
        phase: "rendering",
        ratio: 0.92,
        message: "Downloading Kling MP4…",
      });
      const videoRes = await fetch(status.videoUrl);
      if (!videoRes.ok) throw new Error("Could not download Kling video");
      const mp4 = await videoRes.blob();
      const url = URL.createObjectURL(mp4);
      opts.onProgress?.({
        phase: "done",
        ratio: 1,
        message: "Kling MP4 ready for Shorts & Reels",
      });
      return {
        mp4,
        url,
        filename: `${opts.clipId}-kling-loop.mp4`,
        engine: "kling",
        prompt,
      };
    }
  }

  throw new Error("Kling timed out — try again in a minute.");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
