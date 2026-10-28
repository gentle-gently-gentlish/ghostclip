"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Link2,
  Loader2,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Unplug,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "cn";
import type {
  ConnectionsPublic,
  QueuePublic,
  QueueStatus,
} from "@/lib/publish/types";

function statusTone(status: QueueStatus) {
  switch (status) {
    case "pending":
      return "bg-amber-500/15 text-amber-100";
    case "posted":
      return "bg-emerald-500/15 text-emerald-200";
    case "failed":
      return "bg-red-500/15 text-red-200";
    case "rejected":
      return "bg-mist/10 text-mist/55";
    case "posting":
      return "bg-signal/15 text-signal";
    default:
      return "bg-mist/10 text-mist/70";
  }
}

export function PublishHub() {
  const [connections, setConnections] = useState<ConnectionsPublic | null>(null);
  const [queue, setQueue] = useState<QueuePublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const refresh = useCallback(async () => {
    const [cRes, qRes] = await Promise.all([
      fetch("/api/connections"),
      fetch("/api/queue"),
    ]);
    const c = (await cRes.json()) as ConnectionsPublic;
    const q = (await qRes.json()) as { items: QueuePublic[] };
    setConnections(c);
    setQueue(q.items || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh().catch(() => setLoading(false));
    const params = new URLSearchParams(window.location.search);
    if (params.get("oauth") && params.get("ok")) {
      setBanner(`${params.get("oauth")} connected.`);
    } else if (params.get("oauth") && params.get("error")) {
      setBanner(`OAuth error (${params.get("oauth")}): ${params.get("error")}`);
    }
  }, [refresh]);

  async function demoConnect(platform: "youtube" | "instagram") {
    await fetch("/api/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "demo-connect", platform }),
    });
    await refresh();
  }

  async function disconnect(platform: "youtube" | "instagram") {
    await fetch("/api/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "disconnect", platform }),
    });
    await refresh();
  }

  async function approve(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/queue/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approve failed");
      await refresh();
    } catch (e) {
      setBanner(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    const reason =
      window.prompt(
        "Why reject? (shown in queue — regenerate with this note in mind)",
        "Looks like slop — regenerate with stronger loop / softer physics",
      ) || undefined;
    setBusyId(id);
    try {
      await fetch(`/api/queue/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  const visible = queue.filter((i) =>
    filter === "pending" ? i.status === "pending" || i.status === "failed" : true,
  );

  return (
    <section
      id="publish"
      className="scroll-mt-8 border-t border-mist/10 bg-ink px-5 py-16 sm:px-8 lg:px-12"
    >
      <div className="mx-auto max-w-5xl space-y-10">
        <div className="space-y-3">
          <p className="font-display text-xs tracking-[0.28em] text-signal uppercase">
            Publish hub
          </p>
          <h2 className="font-display text-3xl text-mist sm:text-4xl">
            OAuth in. You approve. Then it posts.
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-mist/60">
            Steps 5–8 on your{" "}
            <a href="#setup" className="text-signal hover:underline">
              human to-do list
            </a>
            : connect OAuth (or demo), queue MP4s from the studio, then Approve
            or Reject. Nothing posts without you.
          </p>
          {banner && (
            <p className="rounded-lg border border-signal/25 bg-signal/10 px-3 py-2 text-sm text-signal">
              {banner}
            </p>
          )}
        </div>

        {/* Pipeline */}
        <ol className="grid gap-4 sm:grid-cols-4">
          {[
            { n: "1", t: "Connect", d: "OAuth once per platform" },
            { n: "2", t: "Generate", d: "Batch + MP4 in studio" },
            { n: "3", t: "Approve", d: "You watch & green-light" },
            { n: "4", t: "Post", d: "Ghostcut uploads Short + Reel" },
          ].map((s) => (
            <li
              key={s.n}
              className="rounded-xl border border-mist/10 bg-clay/40 px-4 py-3"
            >
              <p className="font-display text-xs text-signal">{s.n}</p>
              <p className="mt-1 font-display text-mist">{s.t}</p>
              <p className="mt-1 text-xs text-mist/50">{s.d}</p>
            </li>
          ))}
        </ol>

        {/* Connections */}
        <div className="grid gap-4 md:grid-cols-2">
          {(["youtube", "instagram"] as const).map((platform) => {
            const c = connections?.[platform];
            const live = c?.liveConfigured;
            const connected = c?.status === "connected" || c?.status === "demo";
            return (
              <div
                key={platform}
                className="rounded-2xl border border-mist/10 bg-clay/50 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {platform === "youtube" ? (
                      <Video className="size-5 text-signal" />
                    ) : (
                      <Link2 className="size-5 text-signal" />
                    )}
                    <div>
                      <p className="font-display text-mist capitalize">
                        {platform === "youtube" ? "YouTube Shorts" : "Instagram Reels"}
                      </p>
                      <p className="text-xs text-mist/45">
                        {connected
                          ? c?.accountLabel || "Connected"
                          : "Not connected"}
                      </p>
                    </div>
                  </div>
                  <Badge className={cn("border-0", connected ? "bg-emerald-500/15 text-emerald-200" : "bg-mist/10 text-mist/55")}>
                    {c?.status || "disconnected"}
                  </Badge>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {live ? (
                    <a
                      href={`/api/oauth/${platform}/start`}
                      className="inline-flex h-9 items-center gap-2 rounded-lg bg-signal px-3 text-sm font-medium text-ink hover:bg-signal/90"
                    >
                      <ShieldCheck className="size-4" />
                      {connected ? "Reconnect" : "Connect with OAuth"}
                    </a>
                  ) : (
                    <Button
                      size="sm"
                      className="bg-signal text-ink hover:bg-signal/90"
                      onClick={() => demoConnect(platform)}
                    >
                      <ShieldCheck className="size-4" />
                      Connect demo
                    </Button>
                  )}
                  {connected && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-mist/60"
                      onClick={() => disconnect(platform)}
                    >
                      <Unplug className="size-4" />
                      Disconnect
                    </Button>
                  )}
                </div>

                <p className="mt-3 text-xs leading-relaxed text-mist/40">
                  {live
                    ? "Live OAuth credentials detected."
                    : platform === "youtube"
                      ? "Add GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET for live YouTube. Demo simulates connect + post."
                      : "Add META_APP_ID + META_APP_SECRET for live Instagram. Demo simulates connect + post."}
                </p>
              </div>
            );
          })}
        </div>

        {/* Approval queue */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-display text-xl text-mist">Approval queue</h3>
              <p className="text-sm text-mist/50">
                Pending items wait for you. Reject = never posts.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFilter("pending")}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  filter === "pending"
                    ? "border-signal/40 bg-signal/10 text-signal"
                    : "border-mist/15 text-mist/50",
                )}
              >
                Needs you
              </button>
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  filter === "all"
                    ? "border-signal/40 bg-signal/10 text-signal"
                    : "border-mist/15 text-mist/50",
                )}
              >
                All
              </button>
            </div>
          </div>

          {loading && (
            <p className="flex items-center gap-2 text-sm text-mist/45">
              <Loader2 className="size-4 animate-spin" /> Loading queue…
            </p>
          )}

          {!loading && visible.length === 0 && (
            <div className="rounded-2xl border border-dashed border-mist/15 bg-clay/30 px-5 py-10 text-center">
              <p className="font-display text-mist">Queue empty</p>
              <p className="mt-2 text-sm text-mist/50">
                Generate an MP4 in the studio, then hit{" "}
                <span className="text-signal">Send to approval queue</span>.
              </p>
            </div>
          )}

          <div className="space-y-4">
            {visible.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-mist/10 bg-clay/40 p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={cn("border-0", statusTone(item.status))}>
                        {item.status}
                      </Badge>
                      <span className="text-xs text-mist/40">
                        {item.platforms.join(" + ")}
                        {item.engine ? ` · ${item.engine}` : ""}
                      </span>
                    </div>
                    <h4 className="mt-2 font-display text-lg text-mist">
                      {item.clip.hook}
                    </h4>
                    <p className="text-xs text-mist/45">
                      {item.clip.seriesName} · {item.clip.youtube.title}
                    </p>
                  </div>
                  {(item.status === "pending" || item.status === "failed") && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="bg-signal text-ink hover:bg-signal/90"
                        disabled={busyId === item.id}
                        onClick={() => approve(item.id)}
                      >
                        {busyId === item.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <ThumbsUp className="size-4" />
                        )}
                        Approve & post
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-mist/60"
                        disabled={busyId === item.id}
                        onClick={() => reject(item.id)}
                      >
                        <ThumbsDown className="size-4" />
                        Reject
                      </Button>
                    </div>
                  )}
                  {item.status === "posted" && (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-200">
                      <Check className="size-3.5" /> Posted
                    </span>
                  )}
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
                  <video
                    src={item.videoUrl}
                    controls
                    loop
                    playsInline
                    className="max-h-72 w-full rounded-lg border border-mist/10 bg-black"
                  />
                  <div className="space-y-3 text-sm text-mist/65">
                    <div>
                      <p className="text-xs tracking-wide text-mist/40 uppercase">
                        YouTube
                      </p>
                      <p className="text-mist/80">{item.clip.youtube.title}</p>
                    </div>
                    <div>
                      <p className="text-xs tracking-wide text-mist/40 uppercase">
                        Instagram
                      </p>
                      <p className="line-clamp-4 whitespace-pre-wrap">
                        {item.clip.instagram.caption}
                      </p>
                    </div>
                    {item.rejectReason && (
                      <p className="text-amber-200/90">
                        Rejected: {item.rejectReason}
                      </p>
                    )}
                    {item.publishResults?.map((r) => (
                      <p
                        key={`${item.id}-${r.platform}-${r.at}`}
                        className={r.ok ? "text-emerald-200/90" : "text-red-200/90"}
                      >
                        {r.platform}: {r.ok ? `${r.mode} ok` : r.error}{" "}
                        {r.url ? (
                          <a
                            className="underline"
                            href={r.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            open
                          </a>
                        ) : null}
                      </p>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
