import { connection } from "next/server";
import { NextResponse } from "next/server";
import { getProfile, profileIsComplete } from "@/lib/publish/profile";
import {
  falKeySource,
  oauthClientsPublic,
} from "@/lib/publish/secrets";
import {
  canCompleteOnboarding,
  getConnections,
  getOnboarding,
  getOAuthRedirectUris,
  getQueue,
  instagramLiveConfigured,
  publicMediaBaseConfigured,
  youtubeLiveConfigured,
} from "@/lib/publish/store";
import { hasKlingKey } from "@/lib/video/kling";
import type { WorkflowStatus, WorkflowStepId } from "@/lib/workflow";

export async function GET() {
  await connection();
  const profile = getProfile();
  const conns = getConnections();
  const queue = getQueue();
  const kling = hasKlingKey();
  const onboarding = getOnboarding();
  const clients = oauthClientsPublic();

  const ytLive = conns.youtube?.status === "connected";
  const igLive = conns.instagram?.status === "connected";
  const ytOk =
    ytLive || conns.youtube?.status === "demo";
  const igOk =
    igLive || conns.instagram?.status === "demo";

  const pending = queue.filter(
    (i) => i.status === "pending" || i.status === "failed",
  );
  const posted = queue.filter((i) => i.status === "posted");

  const profileOk = profileIsComplete(profile);
  const engineOk = true; // local always available
  const connectOk = Boolean(ytOk && igOk);
  const livePass = Boolean(ytLive && igLive);
  const generateOk = pending.length + posted.length > 0;
  const reviewOk = pending.length === 0 && posted.length > 0;
  const postOk = posted.length > 0;

  const finishGate = canCompleteOnboarding({ profileOk, engineOk });

  // Furthest step the user may open (within current mode)
  let unlockedThrough: WorkflowStepId = "profile";
  if (profileOk) unlockedThrough = "engine";
  if (profileOk && engineOk) unlockedThrough = "connect";
  if (onboarding.onboardingComplete) {
    unlockedThrough = "generate";
    if (generateOk) {
      unlockedThrough = pending.length > 0 ? "review" : "post";
    }
    if (generateOk && reviewOk) unlockedThrough = "post";
  } else if (profileOk && engineOk && connectOk) {
    unlockedThrough = "connect";
  }

  const status: WorkflowStatus = {
    onboardingComplete: onboarding.onboardingComplete,
    onboardingCompletedAt: onboarding.completedAt,
    profile: {
      complete: profileOk,
      channelName: profile.channelName,
      handle: profile.handle,
    },
    engine: {
      kling,
      local: true,
      falKeySource: falKeySource(),
      pass: engineOk,
    },
    connect: {
      youtube: conns.youtube?.status || "disconnected",
      instagram: conns.instagram?.status || "disconnected",
      youtubeLive: youtubeLiveConfigured(),
      instagramLive: instagramLiveConfigured(),
      livePass,
      pass: connectOk,
      publicMediaConfigured: publicMediaBaseConfigured(),
      redirectUris: getOAuthRedirectUris(),
    },
    oauthClients: {
      youtube: clients.youtube.configured,
      instagram: clients.instagram.configured,
      youtubeSource: clients.youtube.source,
      instagramSource: clients.instagram.source,
    },
    generate: {
      pendingOrReady: pending.length + posted.length,
      pass: generateOk,
    },
    review: {
      pending: pending.length,
      pass: reviewOk,
    },
    post: {
      posted: posted.length,
      pass: postOk,
    },
    canFinishOnboarding: finishGate.ok,
    unlockedThrough,
  };

  return NextResponse.json(status);
}
