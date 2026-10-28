import type { Clip } from "@/lib/clips";

export type Platform = "youtube" | "instagram";

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
  /** Instagram Graph needs a Page + IG user id */
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
