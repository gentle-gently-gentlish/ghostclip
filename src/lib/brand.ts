/** Locked from Jacque's live accounts */
export const CHANNEL_NAME = "Gentle Gentlemen";
export const HANDLE = "@gentle.gently.gentlish";

export const NAME_OPTIONS = [CHANNEL_NAME] as const;

export const BRAND = {
  channelName: CHANNEL_NAME,
  handle: HANDLE,
  colors: {
    ink: "#14110F",
    clay: "#1C1814",
    mist: "#F3EEE6",
    signal: "#C4F082",
  },
  youtube: {
    handleHint: HANDLE,
    description: `Gentle Gentlemen — looping Rube Goldberg animations for quiet brains.

Soft chain reactions that reset themselves. No face. Built to replay.

New Shorts daily. Calm compilations on Sundays.

${HANDLE}`,
  },
  instagram: {
    bio: `Gentle Gentlemen · Rube Goldberg loops
no face · soft chain reactions
YT ${HANDLE}`,
  },
  hashtags: {
    always: [
      "rubegoldberg",
      "chainreaction",
      "oddlysatisfying",
      "satisfying",
      "loop",
      "relaxing",
      "gentlegentlemen",
    ],
    youtubeExtra: ["Shorts", "animation", "satisfyingvideo"],
    instagramExtra: ["reels", "instareels", "explorepage", "animation"],
  },
};

export type HumanTask = {
  id: string;
  step: number;
  title: string;
  detail: string;
  /** In-app jump target */
  href?: string;
  /** Pre-checked when we already saw the user finish this */
  presetDone?: boolean;
};

export type AgentTask = {
  id: string;
  title: string;
  detail: string;
  status: "done" | "ready" | "blocked";
};

/** Mirrors SETUP.md — You (human) */
export const HUMAN_TASKS: HumanTask[] = [
  {
    id: "name",
    step: 1,
    title: "Lock channel name + matching handles",
    detail: `${CHANNEL_NAME} · ${HANDLE} on YouTube + Instagram.`,
    presetDone: true,
  },
  {
    id: "accounts",
    step: 2,
    title: "Create YouTube + Instagram accounts",
    detail: "Both live with the same handle.",
    presetDone: true,
  },
  {
    id: "profile",
    step: 3,
    title: "Fill profile — avatar, banner, bio",
    detail: "Paste the brand copy below. Avatar: soft texture close-up (not the blue G forever).",
    href: "#brand-kit",
  },
  {
    id: "kling",
    step: 4,
    title: "Add Kling (recommended)",
    detail: "Create a key at fal.ai → set FAL_KEY → restart Ghostcut for cinematic loops.",
    href: "#studio",
  },
  {
    id: "oauth",
    step: 5,
    title: "Connect YouTube + Instagram via OAuth",
    detail: "Publish hub → Connect (or Connect demo). Never share passwords.",
    href: "#publish",
  },
  {
    id: "footage",
    step: 6,
    title: "Generate MP4 → send to approval queue",
    detail: "Batch clips → Kling/Local → Send to approval queue (optional CapCut polish first).",
    href: "#studio",
  },
  {
    id: "approve",
    step: 7,
    title: "Approve (or reject) each video",
    detail: "You are the anti-slop gate. Approve & post only when the loop looks right.",
    href: "#publish",
  },
  {
    id: "posted",
    step: 8,
    title: "Confirm posts went live",
    detail: "After Approve, Ghostcut uploads Short + Reel (demo simulates without API apps).",
    href: "#publish",
  },
  {
    id: "cadence",
    step: 9,
    title: "Keep 3 approved posts/day for 14 days",
    detail: "Batch on Sunday; approve through the week.",
    href: "#studio",
  },
  {
    id: "feedback",
    step: 10,
    title: "Tell the agent which series won",
    detail: "Watch analytics — which series holds view % — so the next batch biases winners.",
  },
  {
    id: "monetize",
    step: 11,
    title: "Monetize later (YPP)",
    detail: "YouTube Partner Program when you hit thresholds. IG stays discovery first.",
  },
];

export const AGENT_TASKS: AgentTask[] = [
  {
    id: "niche",
    title: "Niche + pillars locked",
    detail: "Looping Rube Goldberg animations — five chain-reaction series.",
    status: "done",
  },
  {
    id: "brand-lock",
    title: "Brand locked to your accounts",
    detail: `${CHANNEL_NAME} ${HANDLE} — bios + studio default updated.`,
    status: "done",
  },
  {
    id: "plan",
    title: "Channel plan written",
    detail: "CHANNEL_PLAN.md — cadence, growth, monetization order.",
    status: "done",
  },
  {
    id: "studio",
    title: "Ghostcut clip desk live",
    detail: "Batch prompts + YT/IG packs + in-app MP4 loop renderer.",
    status: "done",
  },
  {
    id: "video",
    title: "In-app video generation",
    detail: "Kling (fal.ai) + local canvas fallback for 9:16 looping MP4s.",
    status: "done",
  },
  {
    id: "oauth-publish",
    title: "OAuth + approval queue shipping",
    detail: "Connect accounts, queue MP4s, post only after your Approve.",
    status: "done",
  },
  {
    id: "kling-key",
    title: "Waiting on your FAL_KEY for Kling",
    detail: "Add FAL_KEY from fal.ai/dashboard/keys, restart, then Generate MP4 → Kling.",
    status: "ready",
  },
  {
    id: "next-batch",
    title: "Generate next batch on request",
    detail: "Say “generate week 2” anytime — I bias winners you report.",
    status: "ready",
  },
  {
    id: "platform-login",
    title: "Cannot take passwords / approve for you",
    detail: "OAuth only. You stay the quality gate.",
    status: "blocked",
  },
];

export const CAPCUT_RECIPE = [
  "Optional — only if you want polish before queuing",
  "Import your Rube Goldberg loop (already seamless if possible)",
  "Project → 9:16 (1080×1920)",
  "Trim only if first and last frames still match for the loop",
  "Layer soft taps/rolls on each hit; bed music under −24dB or none",
  `Optional tiny “${CHANNEL_NAME}” last 0.5s — no big captions`,
  "Replay 3× → export 1080p 30fps → back to Ghostcut → Send to approval queue",
];
