export type WorkflowStepId =
  | "profile"
  | "engine"
  | "connect"
  | "generate"
  | "review"
  | "post";

export type WorkflowStep = {
  id: WorkflowStepId;
  number: number;
  title: string;
  blurb: string;
};

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: "profile",
    number: 1,
    title: "Profile",
    blurb: "Name, handle, YouTube About, Instagram bio",
  },
  {
    id: "engine",
    number: 2,
    title: "Video engine",
    blurb: "Add Kling key (or use local renderer)",
  },
  {
    id: "connect",
    number: 3,
    title: "Connect",
    blurb: "OAuth YouTube + Instagram (or demo)",
  },
  {
    id: "generate",
    number: 4,
    title: "Generate",
    blurb: "Batch ideas and render an MP4 into the queue",
  },
  {
    id: "review",
    number: 5,
    title: "Quality check",
    blurb: "Watch the cut — reject slop before it can post",
  },
  {
    id: "post",
    number: 6,
    title: "Post",
    blurb: "Approve & send Short + Reel",
  },
];

export const QUALITY_CHECKS = [
  {
    id: "loops",
    label: "Loop works",
    detail: "Last beat restarts the first — rewatched 2× without a jump cut feeling wrong",
  },
  {
    id: "soft",
    label: "Soft physics",
    detail: "Calm chain reaction — not chaotic explosions or spammy motion",
  },
  {
    id: "faceless",
    label: "Faceless + clean",
    detail: "No face, no big text spam, brand still feels Gentle Gentlemen",
  },
  {
    id: "caption",
    label: "Caption / title OK",
    detail: "YouTube title + IG caption match the clip and aren’t generic slop",
  },
] as const;

export type QualityCheckId = (typeof QUALITY_CHECKS)[number]["id"];

export type OnboardingStepId = "profile" | "engine" | "connect";
export type StudioStepId = "generate" | "review" | "post";

export const ONBOARDING_STEPS: WorkflowStep[] = WORKFLOW_STEPS.filter((s) =>
  ["profile", "engine", "connect"].includes(s.id),
);

export const STUDIO_STEPS: WorkflowStep[] = WORKFLOW_STEPS.filter((s) =>
  ["generate", "review", "post"].includes(s.id),
).map((s, i) => ({ ...s, number: i + 1 }));

export type WorkflowStatus = {
  onboardingComplete: boolean;
  onboardingCompletedAt?: string;
  profile: {
    complete: boolean;
    channelName: string;
    handle: string;
  };
  engine: {
    kling: boolean;
    local: true;
    falKeySource: "env" | "app" | "none";
    pass: boolean;
  };
  connect: {
    youtube: string;
    instagram: string;
    youtubeLive: boolean;
    instagramLive: boolean;
    /** Both platforms have live (non-demo) OAuth connections */
    livePass: boolean;
    /** Demo or live — used during onboarding progress only */
    pass: boolean;
    publicMediaConfigured: boolean;
    redirectUris: {
      youtube: string;
      instagram: string;
      appUrl: string;
    };
  };
  oauthClients: {
    youtube: boolean;
    instagram: boolean;
    youtubeSource: "env" | "app" | "none";
    instagramSource: "env" | "app" | "none";
  };
  generate: {
    pendingOrReady: number;
    pass: boolean;
  };
  review: {
    pending: number;
    pass: boolean;
  };
  post: {
    posted: number;
    pass: boolean;
  };
  canFinishOnboarding: boolean;
  unlockedThrough: WorkflowStepId;
};
