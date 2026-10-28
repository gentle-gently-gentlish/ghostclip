"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Check, Copy } from "lucide-react";
import {
  AGENT_TASKS,
  BRAND,
  CAPCUT_RECIPE,
  CHANNEL_NAME,
  HANDLE,
  HUMAN_TASKS,
} from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "cn";

/** Bumped when task IDs changed for OAuth / approval workflow */
const STORAGE_KEY = "ghostcut-human-setup-v2";

function CopyLine({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-mist/10 bg-ink/50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs tracking-wide text-mist/45 uppercase">{label}</p>
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
        </Button>
      </div>
      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-mist/75">
        {text}
      </pre>
    </div>
  );
}

export function SetupBoard() {
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const saved = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
      const presets = Object.fromEntries(
        HUMAN_TASKS.filter((t) => t.presetDone).map((t) => [t.id, true]),
      );
      setDone({ ...presets, ...saved });
    } catch {
      const presets = Object.fromEntries(
        HUMAN_TASKS.filter((t) => t.presetDone).map((t) => [t.id, true]),
      );
      setDone(presets);
    }
  }, []);

  function toggle(id: string) {
    setDone((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const humanDone = HUMAN_TASKS.filter((t) => done[t.id]).length;
  const nextTask = useMemo(
    () => HUMAN_TASKS.find((t) => !done[t.id]),
    [done],
  );
  const progress = Math.round((humanDone / HUMAN_TASKS.length) * 100);

  return (
    <section
      id="setup"
      className="scroll-mt-8 border-t border-mist/10 bg-clay/80 px-4 py-16 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <p className="font-display text-xs tracking-[0.28em] text-signal uppercase">
          Your to-do list
        </p>
        <h2 className="mt-3 font-display text-3xl text-mist sm:text-4xl">
          Human checklist for {CHANNEL_NAME}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mist/60">
          Handle locked: {HANDLE}. Ghostcut generates and can post after OAuth —
          you fill the profile, connect accounts, and approve every video so
          slop never ships.
        </p>

        <div className="mt-6 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-mist/50">
            <span>
              {humanDone}/{HUMAN_TASKS.length} done
            </span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-mist/10">
            <div
              className="h-full rounded-full bg-signal transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {nextTask ? (
            <p className="pt-1 text-sm text-mist/70">
              Next up:{" "}
              <span className="text-signal">
                {nextTask.step}. {nextTask.title}
              </span>
              {nextTask.href ? (
                <>
                  {" "}
                  ·{" "}
                  <a
                    href={nextTask.href}
                    className="inline-flex items-center gap-0.5 text-mist/55 underline-offset-2 hover:text-signal hover:underline"
                  >
                    Jump there
                    <ArrowUpRight className="size-3.5" />
                  </a>
                </>
              ) : null}
            </p>
          ) : (
            <p className="pt-1 text-sm text-emerald-200/90">
              Checklist complete — keep approving the cadence.
            </p>
          )}
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <div className="rounded-2xl border border-mist/10 bg-ink/40 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-xl text-mist">You (human)</h3>
              <Badge className="border-0 bg-mist/10 text-mist/70">
                Required gate
              </Badge>
            </div>
            <ul className="mt-5 space-y-3">
              {HUMAN_TASKS.map((task) => {
                const on = !!done[task.id];
                const isNext = nextTask?.id === task.id;
                return (
                  <li key={task.id}>
                    <div
                      className={cn(
                        "rounded-xl border transition",
                        on
                          ? "border-signal/35 bg-signal/10"
                          : isNext
                            ? "border-signal/40 bg-signal/5 ring-1 ring-signal/20"
                            : "border-mist/10 bg-clay/40",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggle(task.id)}
                        className="flex w-full gap-3 px-3 py-3 text-left"
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border text-[10px]",
                            on
                              ? "border-signal bg-signal text-ink"
                              : "border-mist/30 text-mist/35",
                          )}
                        >
                          {on ? "✓" : task.step}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-mist">
                            {task.title}
                          </span>
                          <span className="mt-0.5 block text-xs text-mist/50">
                            {task.detail}
                          </span>
                        </span>
                      </button>
                      {task.href && !on ? (
                        <div className="border-t border-mist/8 px-3 pb-3">
                          <a
                            href={task.href}
                            className="inline-flex items-center gap-1 text-xs text-signal hover:underline"
                          >
                            Open in app
                            <ArrowUpRight className="size-3.5" />
                          </a>
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-2xl border border-mist/10 bg-ink/40 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-xl text-mist">Me (agent)</h3>
              <Badge className="border-0 bg-signal/15 text-signal">Ghostcut</Badge>
            </div>
            <ul className="mt-5 space-y-3">
              {AGENT_TASKS.map((task) => (
                <li
                  key={task.id}
                  className="rounded-xl border border-mist/10 bg-clay/40 px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-mist">{task.title}</p>
                    <Badge
                      className={cn(
                        "border-0 shrink-0",
                        task.status === "done" &&
                          "bg-emerald-500/15 text-emerald-200",
                        task.status === "ready" && "bg-signal/15 text-signal",
                        task.status === "blocked" && "bg-mist/10 text-mist/45",
                      )}
                    >
                      {task.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-mist/50">{task.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div id="brand-kit" className="mt-10 scroll-mt-8 grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <h3 className="font-display text-lg text-mist">Your brand kit</h3>
            <p className="text-sm text-mist/55">
              Step 3 — paste into YouTube About + Instagram bio
            </p>
            <CopyLine label="YouTube About" text={BRAND.youtube.description} />
            <CopyLine label="Instagram bio" text={BRAND.instagram.bio} />
          </div>

          <div className="space-y-3">
            <h3 className="font-display text-lg text-mist">Optional CapCut polish</h3>
            <p className="text-sm text-mist/55">
              Before step 6 if you want SFX — otherwise queue the MP4 as-is
            </p>
            <ol className="space-y-2 rounded-2xl border border-mist/10 bg-ink/40 p-5 text-sm text-mist/70">
              {CAPCUT_RECIPE.map((step, i) => (
                <li key={step}>
                  <span className="text-signal">{i + 1}.</span> {step}
                </li>
              ))}
            </ol>
            <CopyLine
              label="Core hashtags"
              text={BRAND.hashtags.always.map((h) => `#${h}`).join(" ")}
            />
            <p className="text-xs text-mist/40">
              Colors: ink {BRAND.colors.ink} · mist {BRAND.colors.mist} · signal{" "}
              {BRAND.colors.signal}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
