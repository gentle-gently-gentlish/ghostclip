import type { Clip } from "@/lib/clips";

export type Platform = "youtube" | "instagram" | "facebook";

export const PLATFORMS: Platform[] = ["youtube", "instagram", "facebook"];

export type YoutubePrivacy = "public" | "unlisted" | "private";

export type ConnectionStatus = "disconnected" | "connected" | "demo";

export type PlatformConnection = {
  platform: Platform;
  status: ConnectionStatus;
  accountLabel?: string;
  accountId?: string;
  /** Demo mode never stores real tokens */
  connectedAt?: string;
  scopes?: string[];
  /** Opaque refresh/access — only on disk, never sent to client */
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  /** Instagram Graph needs a Page + IG user id; Facebook stores the Page id + Page token */
  pageId?: string;
  igUserId?: string;
};

export type QueueStatus =
  | "pending"
  | "approved"
  | "posting"
  | "posted"
  | "failed"
  | "rejected";

export type PublishResult = {
  platform: Platform;
  ok: boolean;
  mode: "live" | "demo" | "skipped";
  url?: string;
  externalId?: string;
  error?: string;
  at: string;
};

export type QueueItem = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: QueueStatus;
  channelName: string;
  clip: Clip;
  filename: string;
  /** Relative path under .data/videos */
  videoPath: string;
  engine?: string;
  note?: string;
  rejectReason?: string;
  platforms: Platform[];
  publishResults?: PublishResult[];
  /** YouTube visibility for this item. Unset = "public" (previous behaviour). */
  youtubePrivacy?: YoutubePrivacy;
};

export type ConnectionsPublic = {
  youtube: {
    status: ConnectionStatus;
    accountLabel?: string;
    connectedAt?: string;
    liveConfigured: boolean;
  };
  instagram: {
    status: ConnectionStatus;
    accountLabel?: string;
    connectedAt?: string;
    liveConfigured: boolean;
  };
  /** Connected through the Meta (Instagram) login — no separate OAuth start. */
  facebook?: {
    status: ConnectionStatus;
    accountLabel?: string;
    connectedAt?: string;
    liveConfigured: boolean;
  };
  appUrl: string;
  redirectUris?: {
    youtube: string;
    instagram: string;
    appUrl: string;
  };
  publicMediaConfigured?: boolean;
};

export type QueuePublic = Omit<QueueItem, "videoPath"> & {
  videoUrl: string;
};
