import { randomUUID } from "crypto";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import path from "path";
import {
  dbClearConnection,
  dbGetConnections,
  dbGetOnboarding,
  dbGetQueue,
  dbGetQueueItem,
  dbSaveConnection,
  dbSetOnboardingComplete,
  dbUpsertQueueItem,
  ensureDataDirs,
  videosDir,
} from "./db";
import {
  instagramLiveConfigured,
  publicMediaBaseConfigured,
  youtubeLiveConfigured,
} from "./secrets";
import type {
  Platform,
  PlatformConnection,
  QueueItem,
  QueuePublic,
  QueueStatus,
} from "./types";

export { youtubeLiveConfigured, instagramLiveConfigured, publicMediaBaseConfigured };

export function getAppUrl() {
  return (
    process.env.GHOSTCUT_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://127.0.0.1:43123"
  );
}

export function getOAuthRedirectUris() {
  const base = getAppUrl().replace(/\/$/, "");
  return {
    youtube: `${base}/api/oauth/youtube/callback`,
    instagram: `${base}/api/oauth/instagram/callback`,
    appUrl: base,
  };
}

export function getConnections() {
  return dbGetConnections();
}

export function saveConnection(conn: PlatformConnection) {
  dbSaveConnection(conn);
}

export function clearConnection(platform: Platform) {
  dbClearConnection(platform);
}

export function getQueue(): QueueItem[] {
  return dbGetQueue();
}

export function getQueueItem(id: string): QueueItem | undefined {
  return dbGetQueueItem(id);
}

export function toPublicQueueItem(item: QueueItem): QueuePublic {
  const { videoPath: _v, ...rest } = item;
  return {
    ...rest,
    videoUrl: `/api/queue/${item.id}/video`,
  };
}

export function upsertQueueItem(item: QueueItem) {
  return dbUpsertQueueItem(item);
}

export function updateQueueStatus(
  id: string,
  status: QueueStatus,
  patch: Partial<QueueItem> = {},
) {
  const item = getQueueItem(id);
  if (!item) return null;
  const next: QueueItem = {
    ...item,
    ...patch,
    status,
    updatedAt: new Date().toISOString(),
  };
  upsertQueueItem(next);
  return next;
}

export function saveVideoBuffer(id: string, buffer: Buffer, filename: string) {
  ensureDataDirs();
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const videoPath = path.join(videosDir(), `${id}-${safe}`);
  writeFileSync(videoPath, buffer);
  return videoPath;
}

export function readVideoFile(videoPath: string): Buffer | null {
  if (!existsSync(videoPath)) return null;
  return readFileSync(videoPath);
}

export function deleteVideoFile(videoPath: string) {
  try {
    if (existsSync(videoPath)) unlinkSync(videoPath);
  } catch {
    /* ignore */
  }
}

export function createQueueId() {
  return randomUUID();
}

export function absoluteVideoPath(stored: string) {
  return path.isAbsolute(stored)
    ? stored
    : path.join(/*turbopackIgnore: true*/ process.cwd(), stored);
}

export function getOnboarding() {
  return dbGetOnboarding();
}

export function setOnboardingComplete(complete: boolean) {
  return dbSetOnboardingComplete(complete);
}

/** Live (not demo) connections required to finish onboarding. */
export function liveConnectionsReady() {
  const c = getConnections();
  return (
    c.youtube?.status === "connected" &&
    Boolean(c.youtube.accessToken) &&
    c.instagram?.status === "connected" &&
    Boolean(c.instagram.accessToken)
  );
}

export function canCompleteOnboarding(opts: {
  profileOk: boolean;
  engineOk?: boolean;
}) {
  const engineOk = opts.engineOk !== false; // local always ok
  return {
    profileOk: opts.profileOk,
    engineOk,
    youtubeLiveConfigured: youtubeLiveConfigured(),
    instagramLiveConfigured: instagramLiveConfigured(),
    youtubeConnectedLive: getConnections().youtube?.status === "connected",
    instagramConnectedLive: getConnections().instagram?.status === "connected",
    liveConnections: liveConnectionsReady(),
    publicMediaHint: publicMediaBaseConfigured(),
    ok:
      opts.profileOk &&
      engineOk &&
      youtubeLiveConfigured() &&
      instagramLiveConfigured() &&
      liveConnectionsReady(),
  };
}
