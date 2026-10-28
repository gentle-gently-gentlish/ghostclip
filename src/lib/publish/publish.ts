import { readFileSync } from "fs";
import {
  absoluteVideoPath,
  getAppUrl,
  getConnections,
  getQueueItem,
  updateQueueStatus,
} from "./store";
import { publishInstagramReel } from "./instagram";
import { publishYoutubeShort } from "./youtube";
import type { Platform, PublishResult, QueueItem } from "./types";

export async function publishApprovedItem(
  id: string,
  platforms?: Platform[],
): Promise<QueueItem | null> {
  const item = getQueueItem(id);
  if (!item) return null;
  if (item.status !== "pending" && item.status !== "failed" && item.status !== "approved") {
    throw new Error(`Cannot publish item in status ${item.status}`);
  }

  const targets = platforms?.length ? platforms : item.platforms;
  updateQueueStatus(id, "posting");

  // Never leave an item stuck in "posting": any thrown error (network outage,
  // expired token, missing file) becomes a per-platform failure so the item
  // lands in "failed" and can be approved again.
  const results: PublishResult[] = [];
  const fail = (platform: Platform, e: unknown): PublishResult => ({
    platform,
    ok: false,
    mode: "live",
    error: e instanceof Error ? e.message : String(e),
    at: new Date().toISOString(),
  });

  let video: Buffer;
  try {
    video = readFileSync(absoluteVideoPath(item.videoPath));
  } catch (e) {
    for (const p of targets) {
      results.push(fail(p, `Video file missing on server (${e instanceof Error ? e.message : e}) — re-render and queue again`));
    }
    return updateQueueStatus(id, "failed", { publishResults: results });
  }

  const conns = getConnections();

  if (targets.includes("youtube")) {
    if (conns.youtube?.status && conns.youtube.status !== "disconnected") {
      try {
        results.push(
          await publishYoutubeShort({
            clip: item.clip,
            video,
          }),
        );
      } catch (e) {
        results.push(fail("youtube", e));
      }
    } else {
      results.push({
        platform: "youtube",
        ok: false,
        mode: "skipped",
        error: "YouTube not connected — connect in Publish hub first",
        at: new Date().toISOString(),
      });
    }
  }

  if (targets.includes("instagram")) {
    if (conns.instagram?.status && conns.instagram.status !== "disconnected") {
      const publicBase =
        process.env.GHOSTCUT_PUBLIC_MEDIA_BASE ||
        (getAppUrl().startsWith("https") ? getAppUrl() : undefined);
      try {
        results.push(
          await publishInstagramReel({
            clip: item.clip,
            queueItemId: id,
            videoPublicUrl: publicBase
              ? `${publicBase}/api/queue/${id}/video`
              : undefined,
          }),
        );
      } catch (e) {
        results.push(fail("instagram", e));
      }
    } else {
      results.push({
        platform: "instagram",
        ok: false,
        mode: "skipped",
        error: "Instagram not connected — connect in Publish hub first",
        at: new Date().toISOString(),
      });
    }
  }

  const anyOk = results.some((r) => r.ok);
  const allFailed = results.length > 0 && results.every((r) => !r.ok);

  return updateQueueStatus(id, allFailed ? "failed" : anyOk ? "posted" : "failed", {
    publishResults: results,
  });
}
