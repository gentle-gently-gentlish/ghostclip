"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Copy, Download, Loader2, Sparkles } from "lucide-react";
import { SERIES, CHANNEL, type SeriesId } from "@/lib/niches";
import { batchToDownloadText, type ClipBatch, type Clip } from "@/lib/clips";
import { VideoForge } from "@/components/video-forge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "cn";

type Status = "idle" | "running" | "done" | "error";

function CopyButton({ text, id }: { text: string; id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-mist/70 hover:text-mist"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      }}
    >
      {copied ? (
        <>
          <Check /> Copied
        </>
      ) : (
        <>
          <Copy /> Copy
        </>
      )}
      <span className="sr-only">{id}</span>
    </Button>
  );
}

function ClipCard({
  clip,
  index,
  channelName,
}: {
  clip: Clip;
  index: number;
  channelName: string;
}) {
  const ytPack = [
    clip.youtube.title,
    "",
    clip.youtube.description || clip.youtube.caption,
    "",
    clip.youtube.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" "),
  ].join("\n");

  const igPack = [
    clip.instagram.caption,
    "",
    clip.instagram.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" "),
  ].join("\n");

  return (
    <article className="rounded-2xl border border-mist/10 bg-clay/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-display text-xs tracking-[0.2em] text-signal uppercase">
            Clip {index + 1} · {clip.seriesName}
          </p>
          <h3 className="mt-1 font-display text-lg text-mist">{clip.hook}</h3>
          <p className="mt-1 text-xs text-mist/45">~{clip.durationSec}s · 9:16</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-mist/10 bg-ink/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-mist/70">YouTube Shorts</span>
            <CopyButton text={ytPack} id={`yt-${clip.id}`} />
          </div>
          <p className="text-sm font-medium text-mist">{clip.youtube.title}</p>
          <p className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap text-xs text-mist/55">
            {clip.youtube.description || clip.youtube.caption}
          </p>
        </div>
        <div className="rounded-xl border border-mist/10 bg-ink/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-mist/70">Instagram Reels</span>
            <CopyButton text={igPack} id={`ig-${clip.id}`} />
          </div>
          <p className="max-h-28 overflow-auto whitespace-pre-wrap text-sm text-mist/80">
            {clip.instagram.caption}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-xs tracking-wide text-mist/40 uppercase">Shot directions</p>
        <ul className="space-y-2">
          {clip.beats.map((b) => (
            <li key={`${clip.id}-${b.atSec}`} className="text-sm text-mist/70">
              <span className="text-signal">{b.atSec}s</span> — {b.direction}
            </li>
          ))}
        </ul>
      </div>

      <VideoForge clip={clip} channelName={channelName} />
    </article>
  );
}

export function Studio() {
  const [channelName, setChannelName] = useState("Gentle Gentlemen");
  const [selected, setSelected] = useState<SeriesId[]>(SERIES.map((s) => s.id));
  const [count, setCount] = useState(7);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [batch, setBatch] = useState<ClipBatch | null>(null);
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (status !== "running") {
      setStep(0);
      return;
    }
    const id = window.setInterval(() => setStep((s) => (s + 1) % 5), 650);
    return () => window.clearInterval(id);
  }, [status]);

  function toggleSeries(id: SeriesId) {
    setSelected((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }

  async function runAgent() {
    setError(null);
    setStatus("running");
    setBatch(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelName,
          seriesIds: selected,
          count,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Agent failed.");
      startTransition(() => {
        setBatch(data as ClipBatch);
        setStatus("done");
      });
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  function downloadKit() {
    if (!batch) return;
    const text = batchToDownloadText(batch);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${batch.channelName.replace(/\s+/g, "-").toLowerCase()}-publish-kit.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const running = status === "running" || pending;

  return (
    <section
      id="studio"
      className="relative scroll-mt-8 border-t border-mist/10 bg-ink px-4 py-16 sm:px-6 lg:px-8"
    >
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
        <div className="space-y-8">
          <div className="space-y-3">
            <p className="font-display text-xs tracking-[0.28em] text-signal uppercase">
              Rube Goldberg loops
            </p>
            <h2 className="font-display text-3xl text-mist sm:text-4xl">
              Batch chain-reaction loops for Shorts & Reels.
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-mist/60">
              {CHANNEL.promise} Pick your series, run the agent, copy platform packs,
              animate, post the same cut to YouTube and Instagram.
            </p>
          </div>

          <div className="space-y-4 rounded-2xl border border-mist/10 bg-clay/30 p-5">
            <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
              <div className="space-y-2">
                <Label htmlFor="channel" className="text-mist/80">
                  Channel name
                </Label>
                <Input
                  id="channel"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  className="border-mist/15 bg-ink text-mist"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="count" className="text-mist/80">
                  Clips
                </Label>
                <Input
                  id="count"
                  type="number"
                  min={1}
                  max={21}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value) || 7)}
                  className="border-mist/15 bg-ink text-mist"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={runAgent}
              disabled={running || !channelName.trim()}
              style={{ backgroundColor: "#C4F082", color: "#14110F" }}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold shadow-[0_0_0_1px_rgba(196,240,130,0.35)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {running ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Agent cutting batch…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  Generate clip batch
                </>
              )}
            </button>
            {error && (
              <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </p>
            )}

            <div className="space-y-2">
              <Label className="text-mist/80">Series to rotate</Label>
              <div className="flex flex-wrap gap-2">
                {SERIES.map((s) => {
                  const on = selected.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      title={s.blurb}
                      onClick={() => toggleSeries(s.id)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-left text-sm transition duration-300",
                        on
                          ? "border-signal/50 bg-signal/15 text-signal"
                          : "border-mist/15 bg-ink/40 text-mist/75 hover:border-mist/30",
                      )}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-mist/40">
                {SERIES.filter((s) => selected.includes(s.id))
                  .map((s) => s.blurb)
                  .slice(0, 2)
                  .join(" · ")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="extra" className="text-mist/80">
                Extra direction (optional)
              </Label>
              <Textarea
                id="extra"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Soft pastels, everyday props, gentle physics…"
                className="min-h-16 border-mist/15 bg-ink text-mist placeholder:text-mist/35"
              />
            </div>
          </div>

          <ul className="space-y-2 text-sm text-mist/50">
            {CHANNEL.rules.map((r) => (
              <li key={r} className="flex gap-2">
                <span className="text-signal">·</span> {r}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative min-h-[28rem]">
          {status === "idle" && (
            <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-mist/10 bg-clay/25 p-6 sm:p-8">
              <div>
                <Badge className="border-0 bg-signal/15 text-signal">Ready</Badge>
                <h3 className="mt-4 font-display text-2xl text-mist">
                  Your Rube Goldberg desk
                </h3>
                <p className="mt-2 max-w-sm text-sm text-mist/55">
                  Best outcome: batch 7–21 loop prompts weekly, animate seamless
                  chains, post 3/day to Shorts + Reels, double down on replay winners.
                </p>
              </div>
              <ol className="mt-8 space-y-3 text-sm text-mist/70">
                <li>1. Generate a batch here</li>
                <li>2. Hit Generate MP4 on each clip (built-in)</li>
                <li>3. Copy YT + IG packs</li>
                <li>4. Upload the same MP4 to Shorts + Reels</li>
              </ol>
            </div>
          )}

          {status === "running" && (
            <div className="relative flex h-full flex-col justify-center rounded-2xl border border-signal/30 bg-clay/30 p-8">
              <div className="agent-pulse mb-6 size-14 rounded-full border border-signal/40 bg-signal/15" />
              <p className="font-display text-xl text-mist">Cutting soft loops…</p>
              <ul className="mt-6 space-y-2">
                {[
                  "Picking series mix",
                  "Writing hooks",
                  "Shot directions",
                  "YouTube Shorts packs",
                  "Instagram Reels packs",
                ].map((label, i) => (
                  <li
                    key={label}
                    className={cn(
                      "text-sm transition-colors duration-300",
                      i === step ? "text-signal" : "text-mist/35",
                    )}
                  >
                    {i === step ? "→ " : "  "}
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {status === "done" && batch && (
            <div className="relative space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="rounded-2xl border border-signal/25 bg-clay/35 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-0 bg-emerald-500/15 text-emerald-200">
                    {batch.mode === "live" ? "Live LLM" : "Local agent"}
                  </Badge>
                  <span className="text-xs text-mist/45">
                    {batch.channelName} · {batch.clips.length} clips
                  </span>
                </div>
                <ol className="mt-4 space-y-2">
                  {batch.postingPlan.map((a, i) => (
                    <li key={a} className="text-sm text-signal/90">
                      {i + 1}. {a}
                    </li>
                  ))}
                </ol>
                <button
                  type="button"
                  onClick={downloadKit}
                  style={{ backgroundColor: "#C4F082", color: "#14110F" }}
                  className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold hover:brightness-95"
                >
                  <Download className="size-4" /> Download publish kit
                </button>
              </div>

              {batch.clips.map((clip, i) => (
                <ClipCard
                  key={clip.id}
                  clip={clip}
                  index={i}
                  channelName={batch.channelName}
                />
              ))}

              <Button
                variant="outline"
                className="w-full border-mist/20 bg-transparent text-mist hover:bg-mist/5"
                onClick={() => {
                  setStatus("idle");
                  setBatch(null);
                }}
              >
                New batch
              </Button>
            </div>
          )}

          {status === "error" && (
            <div className="rounded-2xl border border-red-400/30 bg-clay/30 p-8">
              <p className="font-display text-xl text-mist">Agent stalled</p>
              <p className="mt-2 text-sm text-mist/60">{error}</p>
              <button
                type="button"
                onClick={runAgent}
                style={{ backgroundColor: "#C4F082", color: "#14110F" }}
                className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold hover:brightness-95"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
