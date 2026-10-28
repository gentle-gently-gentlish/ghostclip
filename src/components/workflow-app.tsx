"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Check,
  ChevronRight,
  Loader2,
  Settings2,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { CHANNEL_NAME } from "@/lib/brand";
import { DEFAULT_PROFILE } from "@/lib/defaults";
import { SERIES, type SeriesId } from "@/lib/niches";
import type { Clip, ClipBatch } from "@/lib/clips";
import type { ChannelProfile } from "@/lib/publish/profile";
import type { ConnectionsPublic, QueuePublic } from "@/lib/publish/types";
import {
  ONBOARDING_STEPS,
  QUALITY_CHECKS,
  STUDIO_STEPS,
  type QualityCheckId,
  type WorkflowStatus,
  type WorkflowStepId,
} from "@/lib/workflow";
import { VideoForge } from "@/components/video-forge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "cn";

function stepIndex(id: WorkflowStepId, mode: "onboarding" | "studio") {
  const list = mode === "onboarding" ? ONBOARDING_STEPS : STUDIO_STEPS;
  return list.findIndex((s) => s.id === id);
}

function canOpen(
  id: WorkflowStepId,
  unlocked: WorkflowStepId,
  mode: "onboarding" | "studio",
) {
  // Studio daily rail is always fully open after onboarding
  if (mode === "studio") return true;
  const want = stepIndex(id, mode);
  const have = stepIndex(unlocked, mode);
  if (want < 0) return false;
  if (have < 0) return want === 0;
  return want <= have;
}

function isProfileComplete(p: ChannelProfile) {
  return (
    p.channelName.trim().length >= 2 &&
    p.handle.trim().length >= 2 &&
    p.youtubeAbout.trim().length >= 40 &&
    p.instagramBio.trim().length >= 10
  );
}

async function fetchJson<T>(url: string, init?: RequestInit, ms = 8000): Promise<T> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) message = body.error;
      } catch {
        /* ignore */
      }
      throw new Error(message);
    }
    return (await res.json()) as T;
  } finally {
    window.clearTimeout(timer);
  }
}

function PrimaryButton({
  children,
  disabled,
  onClick,
  className,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{ backgroundColor: "#C4F082", color: "#14110F" }}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Gate({
  ok,
  label,
  detail,
}: {
  ok: boolean;
  label: string;
  detail: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border px-3 py-3",
        ok
          ? "border-emerald-500/30 bg-emerald-500/10"
          : "border-amber-500/25 bg-amber-500/10",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
          ok ? "bg-emerald-400 text-ink" : "bg-amber-400/90 text-ink",
        )}
      >
        {ok ? "✓" : "!"}
      </span>
      <div>
        <p className="text-sm text-mist">{label}</p>
        <p className="text-xs text-mist/55">{detail}</p>
      </div>
    </div>
  );
}

type Mode = "onboarding" | "studio";

function parseStepFromUrl(mode: Mode): WorkflowStepId | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("step");
    const hash = window.location.hash.replace(/^#/, "");
    const aliases: Record<string, WorkflowStepId> = {
      "1": mode === "onboarding" ? "profile" : "generate",
      "2": mode === "onboarding" ? "engine" : "review",
      "3": mode === "onboarding" ? "connect" : "post",
      "4": "generate",
      "5": "review",
      "6": "post",
      "video-engine": "engine",
      "video_engine": "engine",
      settings: "generate",
    };
    const raw = hash || q || "";
    if (raw === "settings") return null;
    const id = (aliases[raw] || raw) as WorkflowStepId;
    const allowed =
      mode === "onboarding"
        ? ["profile", "engine", "connect"]
        : ["generate", "review", "post"];
    if (allowed.includes(id)) return id;
  } catch {
    /* ignore */
  }
  return null;
}

function writeStepUrl(step: WorkflowStepId, mode: Mode) {
  try {
    const url = new URL(window.location.href);
    const idx = stepIndex(step, mode);
    if (idx >= 0) url.searchParams.set("step", String(idx + 1));
    else url.searchParams.delete("step");
    url.hash = step;
    window.history.pushState({ step, mode }, "", url);
  } catch {
    /* ignore */
  }
}

export function WorkflowApp() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [active, setActive] = useState<WorkflowStepId>("profile");
  const [unlocked, setUnlocked] = useState<WorkflowStepId>("profile");
  const [status, setStatus] = useState<WorkflowStatus | null>(null);
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const userNavigated = useRef(false);
  const didLand = useRef(false);

  const [profile, setProfile] = useState<ChannelProfile>(() => ({
    ...DEFAULT_PROFILE,
  }));
  const [falInput, setFalInput] = useState("");
  const [connections, setConnections] = useState<ConnectionsPublic | null>(null);

  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [metaAppId, setMetaAppId] = useState("");
  const [metaAppSecret, setMetaAppSecret] = useState("");

  const [count, setCount] = useState(3);
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<SeriesId[]>([
    "desk-chain",
    "marble-run",
    "kitchen-table",
  ]);
  const [batch, setBatch] = useState<ClipBatch | null>(null);
  const [genBusy, setGenBusy] = useState(false);

  const [queue, setQueue] = useState<QueuePublic[]>([]);
  const [quality, setQuality] = useState<
    Record<string, Partial<Record<QualityCheckId, boolean>>>
  >({});
  const [actionId, setActionId] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<WorkflowStatus | null> => {
    const errors: string[] = [];
    let nextStatus: WorkflowStatus | null = null;

    try {
      nextStatus = await fetchJson<WorkflowStatus>("/api/workflow/status");
      setStatus(nextStatus);
    } catch {
      errors.push("status");
    }

    try {
      const p = await fetchJson<{ profile: ChannelProfile }>("/api/workflow/profile");
      if (p.profile) setProfile(p.profile);
    } catch {
      errors.push("profile");
    }

    try {
      setConnections(await fetchJson<ConnectionsPublic>("/api/connections"));
    } catch {
      errors.push("connections");
    }

    try {
      const q = await fetchJson<{ items: QueuePublic[] }>("/api/queue");
      setQueue(q.items || []);
    } catch {
      errors.push("queue");
    }

    if (errors.length === 4) {
      throw new Error("Could not reach Ghostcut APIs. Is the dev server running?");
    }
    setBootError(
      errors.length
        ? `Partial load (missing: ${errors.join(", ")}). You can still edit and save.`
        : null,
    );
    return nextStatus;
  }, []);

  function unlockAtLeast(step: WorkflowStepId, m: Mode) {
    setUnlocked((prev) =>
      stepIndex(step, m) > stepIndex(prev, m) ? step : prev,
    );
  }

  function goTo(step: WorkflowStepId, opts?: { unlock?: boolean }) {
    const m = mode || "onboarding";
    if (m === "studio") {
      // always navigable
    } else if (opts?.unlock) {
      setUnlocked((prev) =>
        stepIndex(step, m) > stepIndex(prev, m) ? step : prev,
      );
    } else if (!canOpen(step, unlocked, m)) {
      return;
    }
    userNavigated.current = true;
    setMessage(null);
    writeStepUrl(step, m);
    setActive(step);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await refresh();
        if (cancelled || !s) return;

        const nextMode: Mode = s.onboardingComplete ? "studio" : "onboarding";
        setMode(nextMode);

        if (nextMode === "onboarding") {
          let unlock: WorkflowStepId = "profile";
          if (s.profile.complete) unlock = "engine";
          if (s.profile.complete && s.engine.pass) unlock = "connect";
          setUnlocked(unlock);

          if (!userNavigated.current && !didLand.current) {
            didLand.current = true;
            const fromUrl = parseStepFromUrl("onboarding");
            if (fromUrl && canOpen(fromUrl, unlock, "onboarding")) {
              setActive(fromUrl);
            } else if (!s.profile.complete) setActive("profile");
            else if (!s.connect.livePass)
              setActive(s.profile.complete ? "engine" : "profile");
            else setActive("connect");
          }
        } else {
          // Studio: all three daily steps stay open after onboarding
          setUnlocked("post");

          if (!userNavigated.current && !didLand.current) {
            didLand.current = true;
            const fromUrl = parseStepFromUrl("studio");
            if (fromUrl) {
              setActive(fromUrl);
            } else if (s.review.pending > 0) setActive("review");
            else setActive("generate");
          }
        }
      } catch (e) {
        if (!cancelled) {
          setBootError(e instanceof Error ? e.message : "Failed to load workflow");
          setMode("onboarding");
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    const failSafe = window.setTimeout(() => {
      if (!cancelled) {
        setBooting(false);
        setMode((m) => m || "onboarding");
      }
    }, 2500);
    return () => {
      cancelled = true;
      window.clearTimeout(failSafe);
    };
  }, [refresh]);

  useEffect(() => {
    if (!mode) return;
    const onUrl = () => {
      const fromUrl = parseStepFromUrl(mode);
      if (!fromUrl) return;
      if (stepIndex(fromUrl, mode) > stepIndex(unlocked, mode)) return;
      userNavigated.current = true;
      setActive(fromUrl);
    };
    window.addEventListener("hashchange", onUrl);
    window.addEventListener("popstate", onUrl);
    return () => {
      window.removeEventListener("hashchange", onUrl);
      window.removeEventListener("popstate", onUrl);
    };
  }, [mode, unlocked]);

  const profileOk = isProfileComplete(profile) || !!status?.profile.complete;
  const liveConnectOk =
    !!status?.connect.livePass ||
    (connections?.youtube.status === "connected" &&
      connections?.instagram.status === "connected");
  const softConnectOk =
    liveConnectOk ||
    ((connections?.youtube.status === "connected" ||
      connections?.youtube.status === "demo") &&
      (connections?.instagram.status === "connected" ||
        connections?.instagram.status === "demo"));

  useEffect(() => {
    if (mode !== "onboarding") return;
    if (profileOk) unlockAtLeast("engine", "onboarding");
    if (profileOk && softConnectOk) unlockAtLeast("connect", "onboarding");
  }, [mode, profileOk, softConnectOk]);

  async function saveProfile() {
    setBusy(true);
    setMessage(null);
    try {
      const data = await fetchJson<{
        profile: ChannelProfile;
        complete: boolean;
      }>("/api/workflow/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      setProfile(data.profile);
      if (data.complete) {
        unlockAtLeast("engine", mode || "onboarding");
        setMessage("Profile saved — check passed.");
        if (mode === "onboarding" && !settingsOpen) {
          userNavigated.current = true;
          setActive("engine");
        }
      } else {
        setMessage("Saved, but still incomplete — fill all fields.");
      }
      void refresh().catch(() => undefined);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveFalKey() {
    setBusy(true);
    setMessage(null);
    try {
      const data = await fetchJson<{ kling: boolean }>("/api/workflow/fal-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: falInput }),
      });
      setFalInput("");
      setMessage(
        data.kling
          ? "Kling key saved — engine check passed."
          : "Key saved but Kling still offline.",
      );
      void refresh().catch(() => undefined);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function continueWithLocal() {
    setMessage("Local renderer is always available — continuing.");
    goTo("connect", { unlock: true });
  }

  async function saveOAuthClients() {
    setBusy(true);
    setMessage(null);
    try {
      const body: Record<string, string> = {};
      if (googleClientId.trim()) body.googleClientId = googleClientId.trim();
      if (googleClientSecret.trim())
        body.googleClientSecret = googleClientSecret.trim();
      if (metaAppId.trim()) body.metaAppId = metaAppId.trim();
      if (metaAppSecret.trim()) body.metaAppSecret = metaAppSecret.trim();
      if (!Object.keys(body).length) {
        setMessage("Paste at least one client id/secret to save.");
        return;
      }
      await fetchJson("/api/workflow/oauth-clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setGoogleClientId("");
      setGoogleClientSecret("");
      setMetaAppId("");
      setMetaAppSecret("");
      setMessage("OAuth client credentials saved. Connect with OAuth next.");
      void refresh().catch(() => undefined);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function demoConnect(platform: "youtube" | "instagram") {
    setBusy(true);
    setMessage(null);
    try {
      await fetchJson("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "demo-connect", platform }),
      });
      const c = await fetchJson<ConnectionsPublic>("/api/connections");
      setConnections(c);
      setMessage(
        `${platform} demo connected — local smoke only. Finish setup still requires live OAuth.`,
      );
      void refresh().catch(() => undefined);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Connect failed");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(platform: "youtube" | "instagram") {
    await fetchJson("/api/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "disconnect", platform }),
    });
    void refresh().catch(() => undefined);
  }

  async function finishOnboarding() {
    setBusy(true);
    setMessage(null);
    try {
      await fetchJson("/api/workflow/complete-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const s = await refresh();
      setMode("studio");
      setUnlocked("post");
      setActive("generate");
      setSettingsOpen(false);
      userNavigated.current = true;
      writeStepUrl("generate", "studio");
      setMessage(
        s?.onboardingComplete
          ? "Setup saved. Everyday studio is Generate → Quality → Post."
          : "Setup finished.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not finish setup");
    } finally {
      setBusy(false);
    }
  }

  async function resetOnboarding() {
    setBusy(true);
    try {
      await fetchJson("/api/workflow/complete-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true }),
      });
      didLand.current = false;
      userNavigated.current = false;
      setMode("onboarding");
      setUnlocked("profile");
      setActive("profile");
      setSettingsOpen(false);
      setMessage("Onboarding reset — walk through Profile → Engine → Connect again.");
      void refresh().catch(() => undefined);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  async function generateBatch() {
    setGenBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelName: profile?.channelName || CHANNEL_NAME,
          seriesIds: selected,
          count,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generate failed");
      setBatch(data as ClipBatch);
      setMessage("Batch ready — render an MP4 and send it to the approval queue.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setGenBusy(false);
    }
  }

  function qualityPass(itemId: string) {
    const q = quality[itemId] || {};
    return QUALITY_CHECKS.every((c) => q[c.id]);
  }

  async function rejectItem(id: string) {
    setActionId(id);
    try {
      await fetch(`/api/queue/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: "Failed quality check — regenerate",
        }),
      });
      await refresh();
      setMessage("Rejected. Generate a better cut and queue again.");
      setActive("generate");
    } finally {
      setActionId(null);
    }
  }

  async function approveItem(id: string) {
    if (!qualityPass(id)) {
      setMessage("Complete all quality checks before approving.");
      return;
    }
    setActionId(id);
    try {
      const res = await fetch(`/api/queue/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approve failed");
      await refresh();
      setMessage("Posted (or demo-posted). Check results in Post.");
      setActive("post");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setActionId(null);
    }
  }

  const pending = useMemo(
    () => queue.filter((i) => i.status === "pending" || i.status === "failed"),
    [queue],
  );
  const posted = useMemo(
    () => queue.filter((i) => i.status === "posted"),
    [queue],
  );

  const railSteps = mode === "studio" ? STUDIO_STEPS : ONBOARDING_STEPS;
  const effectiveMode: Mode = mode || "onboarding";

  function renderProfileSection(opts?: { inSettings?: boolean }) {
    return (
      <section className="space-y-4 rounded-2xl border border-mist/10 bg-clay/35 p-5">
        <div>
          <h2 className="font-display text-2xl text-mist">
            {opts?.inSettings ? "Profile" : "1 · Profile"}
          </h2>
          <p className="mt-1 text-sm text-mist/55">
            Channel name, handle, YouTube About, Instagram bio — saved on this
            machine forever (SQLite under .data/).
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-mist/80">Channel name</Label>
            <Input
              value={profile.channelName}
              onChange={(e) =>
                setProfile({ ...profile, channelName: e.target.value })
              }
              className="border-mist/15 bg-ink text-mist"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-mist/80">Handle</Label>
            <Input
              value={profile.handle}
              onChange={(e) =>
                setProfile({ ...profile, handle: e.target.value })
              }
              className="border-mist/15 bg-ink text-mist"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-mist/80">YouTube About</Label>
          <Textarea
            value={profile.youtubeAbout}
            onChange={(e) =>
              setProfile({ ...profile, youtubeAbout: e.target.value })
            }
            className="min-h-32 border-mist/15 bg-ink text-mist"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-mist/80">Instagram bio</Label>
          <Textarea
            value={profile.instagramBio}
            onChange={(e) =>
              setProfile({ ...profile, instagramBio: e.target.value })
            }
            className="min-h-24 border-mist/15 bg-ink text-mist"
          />
        </div>
        <Gate
          ok={profileOk}
          label={
            profileOk
              ? "Check passed — profile complete"
              : "Check waiting — fill all fields, then Save & verify"
          }
          detail="Needs name, handle, About (≥40 chars), bio (≥10 chars)."
        />
        <div className="flex flex-wrap gap-2">
          <PrimaryButton disabled={busy} onClick={() => void saveProfile()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Save & verify
          </PrimaryButton>
          {!opts?.inSettings && profileOk && (
            <PrimaryButton onClick={() => goTo("engine", { unlock: true })}>
              Continue to Video engine
              <ChevronRight className="size-4" />
            </PrimaryButton>
          )}
        </div>
      </section>
    );
  }

  function renderEngineSection(opts?: { inSettings?: boolean }) {
    return (
      <section className="space-y-4 rounded-2xl border border-mist/10 bg-clay/35 p-5">
        <div>
          <h2 className="font-display text-2xl text-mist">
            {opts?.inSettings ? "Video engine" : "2 · Video engine"}
          </h2>
          <p className="mt-1 text-sm text-mist/55">
            Paste a fal.ai key for Kling, or continue with the free local loop
            renderer.
          </p>
        </div>
        <Gate
          ok={!!status?.engine.kling}
          label={
            status?.engine.kling
              ? `Kling ready (source: ${status.engine.falKeySource})`
              : "Kling not configured — local renderer still works"
          }
          detail="Get a key at fal.ai/dashboard/keys. Stored in .data/ghostcut.db."
        />
        <div className="space-y-2">
          <Label className="text-mist/80">FAL_KEY</Label>
          <Input
            type="password"
            value={falInput}
            onChange={(e) => setFalInput(e.target.value)}
            placeholder={
              status?.engine.kling ? "•••••••• (already set)" : "Paste fal.ai key"
            }
            className="border-mist/15 bg-ink text-mist"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <PrimaryButton
            disabled={busy || falInput.trim().length < 8}
            onClick={() => void saveFalKey()}
          >
            Save key & verify
          </PrimaryButton>
          {!opts?.inSettings && (
            <button
              type="button"
              onClick={() => void continueWithLocal()}
              className="inline-flex h-10 items-center gap-1 rounded-xl border border-mist/20 px-4 text-sm text-mist hover:bg-mist/5"
            >
              Continue with local renderer
              <ChevronRight className="size-4" />
            </button>
          )}
        </div>
      </section>
    );
  }

  function renderConnectSection(opts?: { inSettings?: boolean }) {
    const redirects = connections?.redirectUris || status?.connect.redirectUris;
    const ytLive =
      connections?.youtube.status === "connected" ||
      status?.connect.youtube === "connected";
    const igLive =
      connections?.instagram.status === "connected" ||
      status?.connect.instagram === "connected";
    const clientsReady =
      !!status?.oauthClients.youtube && !!status?.oauthClients.instagram;

    return (
      <section className="space-y-4 rounded-2xl border border-mist/10 bg-clay/35 p-5">
        <div>
          <h2 className="font-display text-2xl text-mist">
            {opts?.inSettings ? "Connect" : "3 · Connect"}
          </h2>
          <p className="mt-1 text-sm text-mist/55">
            Paste Google + Meta OAuth client credentials, then connect live.
            Demo connect is for local smoke only — finishing setup requires live
            YouTube + Instagram.
          </p>
        </div>

        <Gate
          ok={liveConnectOk}
          label={
            liveConnectOk
              ? "Live OAuth ready — YouTube + Instagram connected"
              : "Save client credentials, then Connect with OAuth for both platforms"
          }
          detail={`YT: ${connections?.youtube.status || status?.connect.youtube || "…"} · IG: ${connections?.instagram.status || status?.connect.instagram || "…"}`}
        />

        <div className="space-y-3 rounded-xl border border-mist/10 bg-ink/40 p-4">
          <p className="text-sm font-medium text-mist">OAuth client credentials</p>
          <ol className="list-decimal space-y-1 pl-4 text-xs text-mist/55">
            <li>
              Google Cloud → OAuth client → enable YouTube Data API v3 → paste
              Client ID & Secret
            </li>
            <li>
              Meta app → Instagram Graph + Facebook Login → link IG Business to a
              Page → paste App ID & Secret
            </li>
            <li>Add the redirect URIs below to each console</li>
          </ol>
          {redirects && (
            <div className="space-y-1 text-xs text-mist/60">
              <p>
                YouTube redirect:{" "}
                <code className="rounded bg-mist/10 px-1 text-signal">
                  {redirects.youtube}
                </code>
              </p>
              <p>
                Instagram redirect:{" "}
                <code className="rounded bg-mist/10 px-1 text-signal">
                  {redirects.instagram}
                </code>
              </p>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-mist/80">GOOGLE_CLIENT_ID</Label>
              <Input
                value={googleClientId}
                onChange={(e) => setGoogleClientId(e.target.value)}
                placeholder={
                  status?.oauthClients.youtube
                    ? `Saved (${status.oauthClients.youtubeSource})`
                    : "xxxx.apps.googleusercontent.com"
                }
                className="border-mist/15 bg-ink text-mist"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-mist/80">GOOGLE_CLIENT_SECRET</Label>
              <Input
                type="password"
                value={googleClientSecret}
                onChange={(e) => setGoogleClientSecret(e.target.value)}
                placeholder={status?.oauthClients.youtube ? "••••••••" : "Secret"}
                className="border-mist/15 bg-ink text-mist"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-mist/80">META_APP_ID</Label>
              <Input
                value={metaAppId}
                onChange={(e) => setMetaAppId(e.target.value)}
                placeholder={
                  status?.oauthClients.instagram
                    ? `Saved (${status.oauthClients.instagramSource})`
                    : "App ID"
                }
                className="border-mist/15 bg-ink text-mist"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-mist/80">META_APP_SECRET</Label>
              <Input
                type="password"
                value={metaAppSecret}
                onChange={(e) => setMetaAppSecret(e.target.value)}
                placeholder={
                  status?.oauthClients.instagram ? "••••••••" : "App Secret"
                }
                className="border-mist/15 bg-ink text-mist"
              />
            </div>
          </div>
          <PrimaryButton disabled={busy} onClick={() => void saveOAuthClients()}>
            Save OAuth clients
          </PrimaryButton>
        </div>

        {!status?.connect.publicMediaConfigured && (
          <p className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Instagram live Reels need a public HTTPS base Meta can fetch. Set{" "}
            <code className="text-signal">GHOSTCUT_PUBLIC_MEDIA_BASE</code> before
            approving live IG posts.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {(["youtube", "instagram"] as const).map((platform) => {
            const c = connections?.[platform];
            const connected =
              c?.status === "connected" || c?.status === "demo";
            const liveReady =
              platform === "youtube"
                ? !!status?.oauthClients.youtube || !!c?.liveConfigured
                : !!status?.oauthClients.instagram || !!c?.liveConfigured;
            return (
              <div
                key={platform}
                className="rounded-xl border border-mist/10 bg-ink/50 p-4"
              >
                <p className="font-display capitalize text-mist">
                  {platform === "youtube" ? "YouTube Shorts" : "Instagram Reels"}
                </p>
                <p className="mt-1 text-xs text-mist/45">
                  {connected
                    ? `${c?.accountLabel} (${c?.status})`
                    : "Not connected"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {liveReady ? (
                    <a
                      href={`/api/oauth/${platform}/start`}
                      className="inline-flex h-8 items-center gap-1 rounded-lg bg-signal px-3 text-xs font-medium text-ink"
                    >
                      <ShieldCheck className="size-3.5" />
                      Connect with OAuth
                    </a>
                  ) : (
                    <span className="text-[11px] text-mist/40">
                      Save client credentials first
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void demoConnect(platform)}
                    className="inline-flex h-8 items-center rounded-lg border border-mist/15 px-3 text-xs text-mist/55 hover:text-mist"
                  >
                    Demo (smoke only)
                  </button>
                  {connected && (
                    <button
                      type="button"
                      className="inline-flex h-8 items-center rounded-lg px-3 text-xs text-mist/55 hover:text-mist"
                      onClick={() => void disconnect(platform)}
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {!opts?.inSettings && (
          <>
            <Gate
              ok={!!status?.canFinishOnboarding || (clientsReady && ytLive && igLive)}
              label={
                status?.canFinishOnboarding || (ytLive && igLive)
                  ? "Ready to finish setup"
                  : "Finish setup needs live connected status on both platforms"
              }
              detail="Demo connections do not unlock Finish setup."
            />
            <PrimaryButton
              disabled={
                busy ||
                !(status?.canFinishOnboarding || (ytLive && igLive && clientsReady))
              }
              onClick={() => void finishOnboarding()}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Finish setup
              <ChevronRight className="size-4" />
            </PrimaryButton>
          </>
        )}
      </section>
    );
  }

  if (!mode && booting) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center bg-ink text-mist">
        <p className="flex items-center gap-2 text-sm text-mist/55">
          <Loader2 className="size-4 animate-spin" />
          Loading Ghostcut…
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-ink text-mist">
      <header className="border-b border-mist/10 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-lg tracking-tight text-mist">Ghostcut</p>
            <p className="text-xs text-mist/45">
              {profile?.channelName || CHANNEL_NAME} ·{" "}
              {effectiveMode === "studio"
                ? "studio — generate, check, post"
                : "one-time setup"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {effectiveMode === "studio" && (
              <button
                type="button"
                data-testid="ghostcut-settings"
                onClick={() => {
                  setMessage(null);
                  setSettingsOpen(true);
                }}
                className="relative z-10 inline-flex h-9 items-center gap-1.5 rounded-xl border border-mist/15 px-3 text-xs text-mist/70 hover:border-mist/30 hover:text-mist"
              >
                <Settings2 className="pointer-events-none size-3.5" />
                Settings
              </button>
            )}
            <Badge className="border-0 bg-signal/15 text-signal">
              {effectiveMode === "studio"
                ? `Studio ${Math.max(1, stepIndex(active, "studio") + 1)} / ${STUDIO_STEPS.length}`
                : `Setup ${Math.max(1, stepIndex(active, "onboarding") + 1)} / ${ONBOARDING_STEPS.length}`}
            </Badge>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
        <nav className="shrink-0 lg:w-56">
          <ol className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
            {railSteps.map((step) => {
              const open = canOpen(step.id, unlocked, effectiveMode);
              const passed =
                (step.id === "profile" && profileOk) ||
                (step.id === "engine" && profileOk) ||
                (step.id === "connect" && liveConnectOk) ||
                (step.id === "generate" && !!status?.generate.pass) ||
                (step.id === "review" && !!status?.review.pass) ||
                (step.id === "post" && !!status?.post.pass);
              return (
                <li key={step.id} className="min-w-[9.5rem] lg:min-w-0">
                  <button
                    type="button"
                    data-testid={`ghostcut-rail-${step.id}`}
                    disabled={!open}
                    onClick={() => {
                      if (open) goTo(step.id);
                    }}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition",
                      active === step.id
                        ? "border-signal/40 bg-signal/10"
                        : open
                          ? "border-mist/10 bg-clay/40 hover:border-mist/25"
                          : "cursor-not-allowed border-mist/5 bg-clay/20 opacity-45",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        passed
                          ? "bg-emerald-400 text-ink"
                          : active === step.id
                            ? "bg-signal text-ink"
                            : "bg-mist/10 text-mist/60",
                      )}
                    >
                      {passed ? (
                        <Check className="pointer-events-none size-3.5" />
                      ) : (
                        step.number
                      )}
                    </span>
                    <span>
                      <span className="block text-sm text-mist">{step.title}</span>
                      <span className="mt-0.5 hidden text-[11px] leading-snug text-mist/45 lg:block">
                        {step.blurb}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <main className="min-h-[28rem] min-w-0 flex-1 space-y-4">
          {bootError && (
            <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              {bootError}
            </p>
          )}
          {message && (
            <p className="rounded-xl border border-signal/25 bg-signal/10 px-3 py-2 text-sm text-signal">
              {message}
            </p>
          )}
          {booting && (
            <p className="flex items-center gap-2 text-sm text-mist/45">
              <Loader2 className="size-4 animate-spin" />
              Syncing saved progress…
            </p>
          )}

          {effectiveMode === "onboarding" && active === "profile" &&
            renderProfileSection()}
          {effectiveMode === "onboarding" && active === "engine" &&
            renderEngineSection()}
          {effectiveMode === "onboarding" && active === "connect" &&
            renderConnectSection()}

          {effectiveMode === "studio" && active === "generate" && (
            <section className="space-y-4 rounded-2xl border border-mist/10 bg-clay/35 p-5">
              <div>
                <h2 className="font-display text-2xl text-mist">Generate</h2>
                <p className="mt-1 text-sm text-mist/55">
                  Create a clip batch, render an MP4, then{" "}
                  <strong className="text-mist/80">Send to approval queue</strong>.
                </p>
              </div>
              <Gate
                ok={!!status?.generate.pass}
                label={
                  status?.generate.pass
                    ? `Check passed — ${status.generate.pendingOrReady} item(s) in publish pipeline`
                    : "Check waiting — queue at least one rendered MP4"
                }
                detail="Use Send to approval queue on a clip after Generate MP4."
              />

              <div className="grid gap-3 sm:grid-cols-[1fr_5rem]">
                <div className="space-y-2">
                  <Label className="text-mist/80">Series</Label>
                  <div className="flex flex-wrap gap-2">
                    {SERIES.map((s) => {
                      const on = selected.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() =>
                            setSelected((prev) =>
                              on
                                ? prev.length === 1
                                  ? prev
                                  : prev.filter((x) => x !== s.id)
                                : [...prev, s.id],
                            )
                          }
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs",
                            on
                              ? "border-signal/50 bg-signal/15 text-signal"
                              : "border-mist/15 text-mist/60",
                          )}
                        >
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-mist/80">Clips</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value) || 3)}
                    className="border-mist/15 bg-ink text-mist"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-mist/80">Direction (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Softer desk props, slower marble…"
                  className="min-h-16 border-mist/15 bg-ink text-mist"
                />
              </div>
              <Button
                className="bg-signal text-ink hover:bg-signal/90"
                disabled={genBusy}
                onClick={generateBatch}
              >
                {genBusy ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Generate clip batch
              </Button>

              {batch && (
                <div className="space-y-4">
                  {batch.clips.map((clip: Clip, i) => (
                    <article
                      key={clip.id}
                      className="rounded-xl border border-mist/10 bg-ink/45 p-4"
                    >
                      <p className="font-display text-xs tracking-wide text-signal uppercase">
                        Clip {i + 1} · {clip.seriesName}
                      </p>
                      <h3 className="mt-1 font-display text-lg text-mist">
                        {clip.hook}
                      </h3>
                      <p className="mt-1 text-xs text-mist/45">
                        YT: {clip.youtube.title}
                      </p>
                      <VideoForge
                        clip={clip}
                        channelName={batch.channelName}
                        onQueued={async () => {
                          await refresh();
                          setMessage(
                            "Queued — open Quality check to review before posting.",
                          );
                          setActive("review");
                          unlockAtLeast("review", "studio");
                        }}
                      />
                    </article>
                  ))}
                </div>
              )}

              {status?.generate.pass && (
                <Button
                  variant="ghost"
                  className="text-mist/70"
                  onClick={() => goTo("review", { unlock: true })}
                >
                  Go to Quality check
                  <ChevronRight />
                </Button>
              )}
            </section>
          )}

          {effectiveMode === "studio" && active === "review" && (
            <section className="space-y-4 rounded-2xl border border-mist/10 bg-clay/35 p-5">
              <div>
                <h2 className="font-display text-2xl text-mist">Quality check</h2>
                <p className="mt-1 text-sm text-mist/55">
                  Watch each pending cut. Tick every quality gate — then Approve &
                  post, or Reject back to Generate.
                </p>
              </div>
              <Gate
                ok={pending.length === 0 && posted.length > 0}
                label={
                  pending.length
                    ? `${pending.length} waiting for your review`
                    : posted.length
                      ? "No pending items — you’re clear to Post"
                      : "Nothing queued yet — go back to Generate"
                }
                detail="Approve is disabled until all four quality checks are ticked."
              />

              {pending.length === 0 && (
                <Button
                  className="bg-signal text-ink"
                  onClick={() =>
                    goTo(posted.length ? "post" : "generate", { unlock: true })
                  }
                >
                  {posted.length ? "Open Post" : "Back to Generate"}
                  <ChevronRight />
                </Button>
              )}

              {pending.map((item) => {
                const q = quality[item.id] || {};
                const ok = qualityPass(item.id);
                return (
                  <article
                    key={item.id}
                    className="space-y-4 rounded-xl border border-mist/10 bg-ink/45 p-4"
                  >
                    <div>
                      <p className="font-display text-mist">{item.clip.hook}</p>
                      <p className="text-xs text-mist/45">
                        {item.clip.seriesName} · {item.clip.youtube.title}
                      </p>
                    </div>
                    <video
                      src={item.videoUrl}
                      controls
                      loop
                      playsInline
                      className="max-h-96 w-full rounded-lg border border-mist/10 bg-black"
                    />
                    <ul className="space-y-2">
                      {QUALITY_CHECKS.map((check) => {
                        const on = !!q[check.id];
                        return (
                          <li key={check.id}>
                            <button
                              type="button"
                              onClick={() =>
                                setQuality((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...prev[item.id],
                                    [check.id]: !on,
                                  },
                                }))
                              }
                              className={cn(
                                "flex w-full gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                                on
                                  ? "border-signal/40 bg-signal/10"
                                  : "border-mist/10 hover:border-mist/25",
                              )}
                            >
                              <span
                                className={cn(
                                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border text-[10px]",
                                  on
                                    ? "border-signal bg-signal text-ink"
                                    : "border-mist/30 text-transparent",
                                )}
                              >
                                ✓
                              </span>
                              <span>
                                <span className="block text-sm text-mist">
                                  {check.label}
                                </span>
                                <span className="block text-xs text-mist/50">
                                  {check.detail}
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="bg-signal text-ink hover:bg-signal/90"
                        disabled={!ok || actionId === item.id}
                        onClick={() => approveItem(item.id)}
                      >
                        {actionId === item.id ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <ThumbsUp className="size-4" />
                        )}
                        Approve & post
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-mist/60"
                        disabled={actionId === item.id}
                        onClick={() => rejectItem(item.id)}
                      >
                        <ThumbsDown className="size-4" />
                        Reject — regenerate
                      </Button>
                    </div>
                    {!ok && (
                      <p className="text-xs text-amber-200/80">
                        Tick all four checks to enable Approve.
                      </p>
                    )}
                  </article>
                );
              })}
            </section>
          )}

          {effectiveMode === "studio" && active === "post" && (
            <section className="space-y-4 rounded-2xl border border-mist/10 bg-clay/35 p-5">
              <div>
                <h2 className="font-display text-2xl text-mist">Post</h2>
                <p className="mt-1 text-sm text-mist/55">
                  Results after Approve. Live OAuth uploads when tokens are
                  connected; demo mode only simulates.
                </p>
              </div>
              <Gate
                ok={posted.length > 0}
                label={
                  posted.length
                    ? `${posted.length} post attempt(s) logged`
                    : "Nothing posted yet — finish Quality check"
                }
                detail="Keep generating → reviewing → posting for the 3/day cadence."
              />
              {posted.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border border-mist/10 bg-ink/45 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-0 bg-emerald-500/15 text-emerald-200">
                      {item.status}
                    </Badge>
                    <span className="text-sm text-mist">{item.clip.hook}</span>
                  </div>
                  <ul className="mt-3 space-y-1 text-xs text-mist/60">
                    {item.publishResults?.map((r) => (
                      <li key={`${item.id}-${r.platform}-${r.at}`}>
                        {r.platform}: {r.ok ? `${r.mode} ok` : r.error}{" "}
                        {r.url ? (
                          <a
                            className="text-signal underline"
                            href={r.url.startsWith("http") ? r.url : undefined}
                            target="_blank"
                            rel="noreferrer"
                          >
                            link
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
              <Button
                className="bg-signal text-ink hover:bg-signal/90"
                onClick={() => goTo("generate")}
              >
                Generate another
                <ChevronRight />
              </Button>
            </section>
          )}
        </main>
      </div>

      {settingsOpen && (
        <div
          data-testid="ghostcut-settings-panel"
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSettingsOpen(false);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-mist/15 bg-ink shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-mist/10 bg-ink/95 px-5 py-4 backdrop-blur">
              <div>
                <p className="font-display text-lg text-mist">Settings</p>
                <p className="text-xs text-mist/45">
                  Edit setup without leaving the studio rail
                </p>
              </div>
              <button
                type="button"
                data-testid="ghostcut-settings-close"
                onClick={() => setSettingsOpen(false)}
                className="rounded-lg p-2 text-mist/50 hover:bg-mist/10 hover:text-mist"
                aria-label="Close settings"
              >
                <X className="pointer-events-none size-4" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              {renderProfileSection({ inSettings: true })}
              {renderEngineSection({ inSettings: true })}
              {renderConnectSection({ inSettings: true })}
              <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4">
                <p className="text-sm text-rose-100">Danger</p>
                <p className="mt-1 text-xs text-rose-100/70">
                  Reset onboarding to walk Profile → Engine → Connect again.
                  Does not delete queue videos.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void resetOnboarding()}
                  className="mt-3 inline-flex h-9 items-center rounded-xl border border-rose-400/40 px-3 text-xs text-rose-100 hover:bg-rose-500/20"
                >
                  Reset onboarding
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
