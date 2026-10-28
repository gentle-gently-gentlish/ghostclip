import { getFalKey } from "@/lib/publish/secrets";
import { KLING_NEGATIVE, buildKlingPrompt } from "./kling-prompt";
import type { Clip } from "@/lib/clips";

const MODEL = "fal-ai/kling-video/v3/standard/text-to-video";
const QUEUE = "https://queue.fal.run";

export function hasKlingKey() {
  return Boolean(getFalKey());
}

function authHeaders() {
  const key = getFalKey();
  if (!key) throw new Error("FAL_KEY is not set");
  return {
    Authorization: `Key ${key}`,
    "Content-Type": "application/json",
  };
}

export type KlingStartResult = {
  requestId: string;
  statusUrl: string;
  responseUrl: string;
  prompt: string;
};

export async function startKlingRender(opts: {
  clip: Pick<Clip, "hook" | "beats" | "seriesName" | "seriesId" | "id">;
  channelName: string;
  durationSec?: "5" | "6" | "8" | "10";
}): Promise<KlingStartResult> {
  const prompt = buildKlingPrompt(opts.clip as Clip, opts.channelName);

  const res = await fetch(`${QUEUE}/${MODEL}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      prompt,
      negative_prompt: KLING_NEGATIVE,
      aspect_ratio: "9:16",
      duration: opts.durationSec || "5",
      generate_audio: false,
      cfg_scale: 0.55,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kling submit failed: ${text.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    request_id: string;
    status_url: string;
    response_url: string;
  };

  return {
    requestId: data.request_id,
    statusUrl: data.status_url,
    responseUrl: data.response_url,
    prompt,
  };
}

export type KlingStatus =
  | { status: "IN_QUEUE" | "IN_PROGRESS"; queuePosition?: number }
  | { status: "COMPLETED"; videoUrl: string }
  | { status: "FAILED"; error: string };

export async function getKlingStatus(requestId: string): Promise<KlingStatus> {
  const statusRes = await fetch(
    `${QUEUE}/${MODEL}/requests/${requestId}/status?logs=0`,
    { headers: authHeaders() },
  );

  if (!statusRes.ok) {
    const text = await statusRes.text();
    throw new Error(`Kling status failed: ${text.slice(0, 300)}`);
  }

  const statusData = (await statusRes.json()) as {
    status: string;
    queue_position?: number;
  };

  if (statusData.status === "IN_QUEUE" || statusData.status === "IN_PROGRESS") {
    return {
      status: statusData.status,
      queuePosition: statusData.queue_position,
    };
  }

  if (statusData.status !== "COMPLETED") {
    return {
      status: "FAILED",
      error: `Unexpected status: ${statusData.status}`,
    };
  }

  const resultRes = await fetch(`${QUEUE}/${MODEL}/requests/${requestId}`, {
    headers: authHeaders(),
  });
  if (!resultRes.ok) {
    const text = await resultRes.text();
    throw new Error(`Kling result failed: ${text.slice(0, 300)}`);
  }

  const result = (await resultRes.json()) as {
    video?: { url?: string };
    detail?: string;
  };

  if (!result.video?.url) {
    return { status: "FAILED", error: result.detail || "No video URL returned" };
  }

  return { status: "COMPLETED", videoUrl: result.video.url };
}
