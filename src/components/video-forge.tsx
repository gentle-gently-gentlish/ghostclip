"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Download, Film, Loader2, Send } from "lucide-react";
import type { Clip } from "@/lib/clips";
import { paintFrame, VIDEO } from "@/lib/video/scenes";
import {
  downloadBlob,
  renderLoopVideo,
  type RenderEngine,
} from "@/lib/video/record";
import { cn } from "cn";

type Props = {
  clip: Clip;
  channelName: string;
  onQueued?: () => void | Promise<void>;
};

export function VideoForge({ clip, channelName, onQueued }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [engine, setEngine] = useState<RenderEngine>("local");
  const [klingReady, setKlingReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [ratio, setRatio] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [filename, setFilename] = useState("loop.mp4");
  const [usedEngine, setUsedEngine] = useState<RenderEngine | null>(null);
  const [promptUsed, setPromptUsed] = useState<string | null>(null);
  const [queueBusy, setQueueBusy] = useState(false);
  const [queued, setQueued] = useState(false);

  useEffect(() => {
    fetch("/api/video-providers")
      .then((r) => r.json())
      .then((d: { kling?: boolean; defaultEngine?: RenderEngine }) => {
        setKlingReady(Boolean(d.kling));
        if (d.defaultEngine === "kling") setEngine("kling");
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let raf = 0;
    const total = VIDEO.fps * VIDEO.durationSec;
    const scale = 180 / VIDEO.width;
    canvas.width = VIDEO.width;
    canvas.height = VIDEO.height;
    canvas.style.width = `${VIDEO.width * scale}px`;
    canvas.style.height = `${VIDEO.height * scale}px`;

    const tick = () => {
      paintFrame(ctx as never, clip.seriesId, frame, total, channelName);
      frame = (frame + 1) % total;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clip.seriesId, channelName]);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  async function generate() {
    setBusy(true);
    setError(null);
    setProgress("Starting…");
    setRatio(0);
    setPromptUsed(null);
    setUsedEngine(null);
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setBlob(null);

    try {
      const result = await renderLoopVideo({
        engine,
        seriesId: clip.seriesId,
        channelName,
        clipId: clip.id,
        clip,
        onProgress: (p) => {
          setProgress(p.message);
          setRatio(p.ratio);
        },
      });
      setVideoUrl(result.url);
      setBlob(result.mp4);
      setFilename(result.filename);
      setUsedEngine(result.engine);
      setPromptUsed(result.prompt || null);
      setProgress("Ready — download or send to approval queue");
      setQueued(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Render failed");
      setProgress(null);
    } finally {
      setBusy(false);
    }
  }

  async function sendToApprovalQueue() {
    if (!blob) return;
    setQueueBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("video", blob, filename);
      form.append(
        "meta",
        JSON.stringify({
          clip,
          channelName,
          filename,
          engine: usedEngine || engine,
          platforms: ["youtube", "instagram"],
        }),
      );
      const res = await fetch("/api/queue", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not queue video");
      setQueued(true);
      setProgress("In approval queue — you still green-light before it posts");
      await onQueued?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Queue failed");
    } finally {
      setQueueBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-mist/10 bg-ink/60 p-4">
      <div className="flex flex-wrap items-start gap-4">
        <canvas
          ref={canvasRef}
          className="rounded-lg border border-mist/10 bg-ink"
          aria-label="Local motion preview"
        />
        <div className="min-w-[14rem] flex-1 space-y-3">
          <p className="font-display text-sm text-mist">In-app video</p>
          <p className="text-xs leading-relaxed text-mist/50">
            Prefer <strong className="text-mist/70">Kling</strong> for cinematic
            Rube Goldberg loops. Local is free/offline. Same MP4 goes to Shorts + Reels.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!klingReady}
              onClick={() => setEngine("kling")}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition",
                engine === "kling"
                  ? "border-signal/50 bg-signal/15 text-signal"
                  : "border-mist/15 text-mist/60",
                !klingReady && "opacity-40",
              )}
              title={
                klingReady
                  ? "Kling via fal.ai"
                  : "Set FAL_KEY in the environment to enable Kling"
              }
            >
              Kling {klingReady ? "" : "(needs FAL_KEY)"}
            </button>
            <button
              type="button"
              onClick={() => setEngine("local")}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition",
                engine === "local"
                  ? "border-signal/50 bg-signal/15 text-signal"
                  : "border-mist/15 text-mist/60",
              )}
            >
              Local canvas
            </button>
          </div>

          <button
            type="button"
            onClick={generate}
            disabled={busy || (engine === "kling" && !klingReady)}
            style={{ backgroundColor: "#C4F082", color: "#14110F" }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold hover:brightness-95 disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {engine === "kling" ? "Kling working…" : "Rendering…"}
              </>
            ) : (
              <>
                <Film className="size-4" />
                Generate MP4 ({engine === "kling" ? "Kling" : "Local"})
              </>
            )}
          </button>

          {!klingReady && (
            <p className="text-xs text-mist/40">
              Add <code className="text-mist/55">FAL_KEY</code> from{" "}
              <a
                className="underline hover:text-signal"
                href="https://fal.ai/dashboard/keys"
                target="_blank"
                rel="noreferrer"
              >
                fal.ai
              </a>{" "}
              to unlock Kling (recommended).
            </p>
          )}

          {busy && (
            <div className="space-y-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-mist/10">
                <div
                  className="h-full rounded-full bg-[#C4F082] transition-all"
                  style={{ width: `${Math.round(ratio * 100)}%` }}
                />
              </div>
              <p className="text-xs text-mist/45">{progress}</p>
            </div>
          )}
          {error && <p className="text-xs text-red-300">{error}</p>}
        </div>
      </div>

      {videoUrl && blob && (
        <div className="mt-4 space-y-3">
          {usedEngine && (
            <p className="text-xs text-mist/45">
              Engine: {usedEngine === "kling" ? "Kling (fal.ai)" : "Local canvas"}
            </p>
          )}
          <video
            src={videoUrl}
            controls
            loop
            playsInline
            className="max-h-80 w-full rounded-lg border border-mist/10 bg-black"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={sendToApprovalQueue}
              disabled={queueBusy || queued}
              style={{ backgroundColor: "#C4F082", color: "#14110F" }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold hover:brightness-95 disabled:opacity-60"
            >
              {queueBusy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Queuing…
                </>
              ) : queued ? (
                <>
                  <Check className="size-4" />
                  In approval queue
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  Send to approval queue
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => downloadBlob(blob, filename)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-mist/20 px-4 text-sm font-medium text-mist hover:bg-mist/5"
            >
              <Download className="size-4" />
              Download
            </button>
            {queued && (
              <a
                href="#publish"
                className="inline-flex h-10 items-center justify-center rounded-xl px-3 text-sm text-signal underline-offset-2 hover:underline"
              >
                Open Publish hub →
              </a>
            )}
          </div>
          {promptUsed && (
            <details className="text-xs text-mist/45">
              <summary className="cursor-pointer text-mist/60">Kling prompt used</summary>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-mist/50">
                {promptUsed}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
