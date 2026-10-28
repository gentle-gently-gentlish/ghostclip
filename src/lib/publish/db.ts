import { existsSync, mkdirSync, readFileSync, renameSync } from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import type { ChannelProfile } from "./profile";
import type { Platform, PlatformConnection, QueueItem } from "./types";

/** Persistent data root — on Fly mount a volume and set GHOSTCUT_DATA_DIR=/data */
const ROOT = process.env.GHOSTCUT_DATA_DIR?.trim()
  ? path.resolve(process.env.GHOSTCUT_DATA_DIR.trim())
  : path.join(/*turbopackIgnore: true*/ process.cwd(), ".data");
const DB_PATH = path.join(ROOT, "ghostcut.db");
const VIDEOS_DIR = path.join(ROOT, "videos");

const PROFILE_JSON = path.join(ROOT, "profile.json");
const SECRETS_JSON = path.join(ROOT, "secrets.json");
const CONNECTIONS_JSON = path.join(ROOT, "connections.json");
const QUEUE_JSON = path.join(ROOT, "queue.json");

export type OAuthClientSecrets = {
  googleClientId?: string;
  googleClientSecret?: string;
  metaAppId?: string;
  metaAppSecret?: string;
};

export type AppSecrets = OAuthClientSecrets & {
  falKey?: string;
};

export type OnboardingSettings = {
  onboardingComplete: boolean;
  completedAt?: string;
};

let dbInstance: DatabaseSync | null = null;
let migrated = false;

export function dataRoot() {
  return ROOT;
}

export function videosDir() {
  return VIDEOS_DIR;
}

export function ensureDataDirs() {
  mkdirSync(ROOT, { recursive: true });
  mkdirSync(VIDEOS_DIR, { recursive: true });
}

function schema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      channel_name TEXT NOT NULL,
      handle TEXT NOT NULL,
      youtube_about TEXT NOT NULL,
      instagram_bio TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS secrets (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      fal_key TEXT,
      google_client_id TEXT,
      google_client_secret TEXT,
      meta_app_id TEXT,
      meta_app_secret TEXT
    );

    CREATE TABLE IF NOT EXISTS connections (
      platform TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      account_label TEXT,
      account_id TEXT,
      connected_at TEXT,
      scopes_json TEXT,
      access_token TEXT,
      refresh_token TEXT,
      expires_at INTEGER,
      page_id TEXT,
      ig_user_id TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      onboarding_complete INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS queue (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      status TEXT NOT NULL,
      channel_name TEXT NOT NULL,
      clip_json TEXT NOT NULL,
      filename TEXT NOT NULL,
      video_path TEXT NOT NULL,
      engine TEXT,
      note TEXT,
      reject_reason TEXT,
      platforms_json TEXT NOT NULL,
      publish_results_json TEXT
    );

    INSERT OR IGNORE INTO secrets (id) VALUES (1);
    INSERT OR IGNORE INTO settings (id, onboarding_complete) VALUES (1, 0);
  `);
}

function migrateFromJson(db: DatabaseSync) {
  if (existsSync(PROFILE_JSON)) {
    try {
      const p = JSON.parse(readFileSync(PROFILE_JSON, "utf8")) as ChannelProfile;
      const existing = db
        .prepare("SELECT id FROM profile WHERE id = 1")
        .get() as { id: number } | undefined;
      if (!existing) {
        db.prepare(
          `INSERT INTO profile (id, channel_name, handle, youtube_about, instagram_bio, updated_at)
           VALUES (1, ?, ?, ?, ?, ?)`,
        ).run(
          p.channelName || "",
          p.handle || "",
          p.youtubeAbout || "",
          p.instagramBio || "",
          p.updatedAt || null,
        );
      }
      renameSync(PROFILE_JSON, `${PROFILE_JSON}.migrated`);
    } catch {
      /* leave json for next boot */
    }
  }

  if (existsSync(SECRETS_JSON)) {
    try {
      const s = JSON.parse(readFileSync(SECRETS_JSON, "utf8")) as AppSecrets & {
        falKey?: string;
      };
      db.prepare(
        `UPDATE secrets SET
          fal_key = COALESCE(?, fal_key),
          google_client_id = COALESCE(?, google_client_id),
          google_client_secret = COALESCE(?, google_client_secret),
          meta_app_id = COALESCE(?, meta_app_id),
          meta_app_secret = COALESCE(?, meta_app_secret)
         WHERE id = 1`,
      ).run(
        s.falKey ?? null,
        s.googleClientId ?? null,
        s.googleClientSecret ?? null,
        s.metaAppId ?? null,
        s.metaAppSecret ?? null,
      );
      renameSync(SECRETS_JSON, `${SECRETS_JSON}.migrated`);
    } catch {
      /* leave */
    }
  }

  if (existsSync(CONNECTIONS_JSON)) {
    try {
      const all = JSON.parse(readFileSync(CONNECTIONS_JSON, "utf8")) as {
        youtube?: PlatformConnection;
        instagram?: PlatformConnection;
      };
      for (const platform of ["youtube", "instagram"] as Platform[]) {
        const c = all[platform];
        if (!c) continue;
        const row = db
          .prepare("SELECT platform FROM connections WHERE platform = ?")
          .get(platform);
        if (row) continue;
        db.prepare(
          `INSERT INTO connections (
            platform, status, account_label, account_id, connected_at, scopes_json,
            access_token, refresh_token, expires_at, page_id, ig_user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          platform,
          c.status,
          c.accountLabel ?? null,
          c.accountId ?? null,
          c.connectedAt ?? null,
          c.scopes ? JSON.stringify(c.scopes) : null,
          c.accessToken ?? null,
          c.refreshToken ?? null,
          c.expiresAt ?? null,
          c.pageId ?? null,
          c.igUserId ?? null,
        );
      }
      renameSync(CONNECTIONS_JSON, `${CONNECTIONS_JSON}.migrated`);
    } catch {
      /* leave */
    }
  }

  if (existsSync(QUEUE_JSON)) {
    try {
      const items = JSON.parse(readFileSync(QUEUE_JSON, "utf8")) as QueueItem[];
      const count = db.prepare("SELECT COUNT(*) AS n FROM queue").get() as {
        n: number;
      };
      if (count.n === 0 && Array.isArray(items)) {
        const insert = db.prepare(
          `INSERT INTO queue (
            id, created_at, updated_at, status, channel_name, clip_json, filename,
            video_path, engine, note, reject_reason, platforms_json, publish_results_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        );
        for (const item of items) {
          insert.run(
            item.id,
            item.createdAt,
            item.updatedAt,
            item.status,
            item.channelName,
            JSON.stringify(item.clip),
            item.filename,
            item.videoPath,
            item.engine ?? null,
            item.note ?? null,
            item.rejectReason ?? null,
            JSON.stringify(item.platforms || []),
            item.publishResults
              ? JSON.stringify(item.publishResults)
              : null,
          );
        }
      }
      renameSync(QUEUE_JSON, `${QUEUE_JSON}.migrated`);
    } catch {
      /* leave */
    }
  }
}

export function getDb(): DatabaseSync {
  ensureDataDirs();
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    schema(dbInstance);
  }
  if (!migrated) {
    migrateFromJson(dbInstance);
    migrated = true;
  }
  return dbInstance;
}

/* ── Profile ─────────────────────────────────────────────── */

export function dbGetProfile(): ChannelProfile | null {
  const row = getDb()
    .prepare(
      `SELECT channel_name, handle, youtube_about, instagram_bio, updated_at
       FROM profile WHERE id = 1`,
    )
    .get() as
    | {
        channel_name: string;
        handle: string;
        youtube_about: string;
        instagram_bio: string;
        updated_at: string | null;
      }
    | undefined;
  if (!row) return null;
  return {
    channelName: row.channel_name,
    handle: row.handle,
    youtubeAbout: row.youtube_about,
    instagramBio: row.instagram_bio,
    updatedAt: row.updated_at || undefined,
  };
}

export function dbSaveProfile(p: ChannelProfile) {
  getDb()
    .prepare(
      `INSERT INTO profile (id, channel_name, handle, youtube_about, instagram_bio, updated_at)
       VALUES (1, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         channel_name = excluded.channel_name,
         handle = excluded.handle,
         youtube_about = excluded.youtube_about,
         instagram_bio = excluded.instagram_bio,
         updated_at = excluded.updated_at`,
    )
    .run(
      p.channelName,
      p.handle,
      p.youtubeAbout,
      p.instagramBio,
      p.updatedAt || new Date().toISOString(),
    );
}

/* ── Secrets ─────────────────────────────────────────────── */

export function dbGetSecrets(): AppSecrets {
  const row = getDb()
    .prepare(
      `SELECT fal_key, google_client_id, google_client_secret, meta_app_id, meta_app_secret
       FROM secrets WHERE id = 1`,
    )
    .get() as
    | {
        fal_key: string | null;
        google_client_id: string | null;
        google_client_secret: string | null;
        meta_app_id: string | null;
        meta_app_secret: string | null;
      }
    | undefined;
  if (!row) return {};
  return {
    falKey: row.fal_key || undefined,
    googleClientId: row.google_client_id || undefined,
    googleClientSecret: row.google_client_secret || undefined,
    metaAppId: row.meta_app_id || undefined,
    metaAppSecret: row.meta_app_secret || undefined,
  };
}

export function dbPatchSecrets(patch: AppSecrets) {
  const cur = dbGetSecrets();
  const next: AppSecrets = { ...cur, ...patch };
  // Allow clearing by passing empty string → undefined
  for (const key of Object.keys(patch) as (keyof AppSecrets)[]) {
    const v = patch[key];
    if (v === "" || v === undefined) next[key] = undefined;
    else next[key] = v.trim();
  }
  getDb()
    .prepare(
      `UPDATE secrets SET
        fal_key = ?,
        google_client_id = ?,
        google_client_secret = ?,
        meta_app_id = ?,
        meta_app_secret = ?
       WHERE id = 1`,
    )
    .run(
      next.falKey ?? null,
      next.googleClientId ?? null,
      next.googleClientSecret ?? null,
      next.metaAppId ?? null,
      next.metaAppSecret ?? null,
    );
  return next;
}

/* ── Connections ─────────────────────────────────────────── */

function rowToConnection(row: {
  platform: string;
  status: string;
  account_label: string | null;
  account_id: string | null;
  connected_at: string | null;
  scopes_json: string | null;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;
  page_id: string | null;
  ig_user_id: string | null;
}): PlatformConnection {
  return {
    platform: row.platform as Platform,
    status: row.status as PlatformConnection["status"],
    accountLabel: row.account_label || undefined,
    accountId: row.account_id || undefined,
    connectedAt: row.connected_at || undefined,
    scopes: row.scopes_json
      ? (JSON.parse(row.scopes_json) as string[])
      : undefined,
    accessToken: row.access_token || undefined,
    refreshToken: row.refresh_token || undefined,
    expiresAt: row.expires_at || undefined,
    pageId: row.page_id || undefined,
    igUserId: row.ig_user_id || undefined,
  };
}

export function dbGetConnections(): {
  youtube?: PlatformConnection;
  instagram?: PlatformConnection;
} {
  const rows = getDb()
    .prepare(`SELECT * FROM connections`)
    .all() as {
    platform: string;
    status: string;
    account_label: string | null;
    account_id: string | null;
    connected_at: string | null;
    scopes_json: string | null;
    access_token: string | null;
    refresh_token: string | null;
    expires_at: number | null;
    page_id: string | null;
    ig_user_id: string | null;
  }[];
  const out: { youtube?: PlatformConnection; instagram?: PlatformConnection } =
    {};
  for (const row of rows) {
    const c = rowToConnection(row);
    if (c.platform === "youtube") out.youtube = c;
    if (c.platform === "instagram") out.instagram = c;
  }
  return out;
}

export function dbSaveConnection(conn: PlatformConnection) {
  getDb()
    .prepare(
      `INSERT INTO connections (
        platform, status, account_label, account_id, connected_at, scopes_json,
        access_token, refresh_token, expires_at, page_id, ig_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(platform) DO UPDATE SET
        status = excluded.status,
        account_label = excluded.account_label,
        account_id = excluded.account_id,
        connected_at = excluded.connected_at,
        scopes_json = excluded.scopes_json,
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        expires_at = excluded.expires_at,
        page_id = excluded.page_id,
        ig_user_id = excluded.ig_user_id`,
    )
    .run(
      conn.platform,
      conn.status,
      conn.accountLabel ?? null,
      conn.accountId ?? null,
      conn.connectedAt ?? null,
      conn.scopes ? JSON.stringify(conn.scopes) : null,
      conn.accessToken ?? null,
      conn.refreshToken ?? null,
      conn.expiresAt ?? null,
      conn.pageId ?? null,
      conn.igUserId ?? null,
    );
}

export function dbClearConnection(platform: Platform) {
  getDb().prepare(`DELETE FROM connections WHERE platform = ?`).run(platform);
}

/* ── Settings / onboarding ───────────────────────────────── */

export function dbGetOnboarding(): OnboardingSettings {
  const row = getDb()
    .prepare(
      `SELECT onboarding_complete, completed_at FROM settings WHERE id = 1`,
    )
    .get() as
    | { onboarding_complete: number; completed_at: string | null }
    | undefined;
  return {
    onboardingComplete: Boolean(row?.onboarding_complete),
    completedAt: row?.completed_at || undefined,
  };
}

export function dbSetOnboardingComplete(complete: boolean) {
  const completedAt = complete ? new Date().toISOString() : null;
  getDb()
    .prepare(
      `UPDATE settings SET onboarding_complete = ?, completed_at = ? WHERE id = 1`,
    )
    .run(complete ? 1 : 0, completedAt);
  return dbGetOnboarding();
}

/* ── Queue ───────────────────────────────────────────────── */

function rowToQueueItem(row: {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  channel_name: string;
  clip_json: string;
  filename: string;
  video_path: string;
  engine: string | null;
  note: string | null;
  reject_reason: string | null;
  platforms_json: string;
  publish_results_json: string | null;
}): QueueItem {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status as QueueItem["status"],
    channelName: row.channel_name,
    clip: JSON.parse(row.clip_json),
    filename: row.filename,
    videoPath: row.video_path,
    engine: row.engine || undefined,
    note: row.note || undefined,
    rejectReason: row.reject_reason || undefined,
    platforms: JSON.parse(row.platforms_json),
    publishResults: row.publish_results_json
      ? JSON.parse(row.publish_results_json)
      : undefined,
  };
}

export function dbGetQueue(): QueueItem[] {
  const rows = getDb()
    .prepare(`SELECT * FROM queue ORDER BY created_at DESC`)
    .all() as {
    id: string;
    created_at: string;
    updated_at: string;
    status: string;
    channel_name: string;
    clip_json: string;
    filename: string;
    video_path: string;
    engine: string | null;
    note: string | null;
    reject_reason: string | null;
    platforms_json: string;
    publish_results_json: string | null;
  }[];
  return rows.map(rowToQueueItem);
}

export function dbGetQueueItem(id: string): QueueItem | undefined {
  const row = getDb().prepare(`SELECT * FROM queue WHERE id = ?`).get(id) as
    | {
        id: string;
        created_at: string;
        updated_at: string;
        status: string;
        channel_name: string;
        clip_json: string;
        filename: string;
        video_path: string;
        engine: string | null;
        note: string | null;
        reject_reason: string | null;
        platforms_json: string;
        publish_results_json: string | null;
      }
    | undefined;
  return row ? rowToQueueItem(row) : undefined;
}

export function dbUpsertQueueItem(item: QueueItem) {
  getDb()
    .prepare(
      `INSERT INTO queue (
        id, created_at, updated_at, status, channel_name, clip_json, filename,
        video_path, engine, note, reject_reason, platforms_json, publish_results_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        status = excluded.status,
        channel_name = excluded.channel_name,
        clip_json = excluded.clip_json,
        filename = excluded.filename,
        video_path = excluded.video_path,
        engine = excluded.engine,
        note = excluded.note,
        reject_reason = excluded.reject_reason,
        platforms_json = excluded.platforms_json,
        publish_results_json = excluded.publish_results_json`,
    )
    .run(
      item.id,
      item.createdAt,
      item.updatedAt,
      item.status,
      item.channelName,
      JSON.stringify(item.clip),
      item.filename,
      item.videoPath,
      item.engine ?? null,
      item.note ?? null,
      item.rejectReason ?? null,
      JSON.stringify(item.platforms || []),
      item.publishResults ? JSON.stringify(item.publishResults) : null,
    );
  return item;
}
