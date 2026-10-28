import {
  dbGetSecrets,
  dbPatchSecrets,
  type AppSecrets,
  type OAuthClientSecrets,
} from "./db";

export type { AppSecrets, OAuthClientSecrets };

export function getFalKey(): string | undefined {
  const fromEnv = process.env.FAL_KEY?.trim();
  if (fromEnv) return fromEnv;
  const fromDb = dbGetSecrets().falKey?.trim();
  return fromDb || undefined;
}

export function setFalKey(key: string) {
  const trimmed = key.trim();
  dbPatchSecrets({ falKey: trimmed || undefined });
}

export function clearFalKey() {
  dbPatchSecrets({ falKey: undefined });
}

export function falKeySource(): "env" | "app" | "none" {
  if (process.env.FAL_KEY?.trim()) return "env";
  if (dbGetSecrets().falKey?.trim()) return "app";
  return "none";
}

/** DB first, then process env — used by OAuth helpers. */
export function getGoogleOAuthClient(): {
  clientId: string;
  clientSecret: string;
} {
  const s = dbGetSecrets();
  return {
    clientId:
      s.googleClientId?.trim() ||
      process.env.GOOGLE_CLIENT_ID?.trim() ||
      "",
    clientSecret:
      s.googleClientSecret?.trim() ||
      process.env.GOOGLE_CLIENT_SECRET?.trim() ||
      "",
  };
}

export function getMetaOAuthClient(): {
  appId: string;
  appSecret: string;
} {
  const s = dbGetSecrets();
  return {
    appId: s.metaAppId?.trim() || process.env.META_APP_ID?.trim() || "",
    appSecret:
      s.metaAppSecret?.trim() || process.env.META_APP_SECRET?.trim() || "",
  };
}

export function youtubeLiveConfigured() {
  const g = getGoogleOAuthClient();
  return Boolean(g.clientId && g.clientSecret);
}

export function instagramLiveConfigured() {
  const m = getMetaOAuthClient();
  return Boolean(m.appId && m.appSecret);
}

export function oauthClientsConfigured() {
  return {
    youtube: youtubeLiveConfigured(),
    instagram: instagramLiveConfigured(),
    both: youtubeLiveConfigured() && instagramLiveConfigured(),
  };
}

/** Public view — never return secret values. */
export function oauthClientsPublic() {
  const s = dbGetSecrets();
  const g = getGoogleOAuthClient();
  const m = getMetaOAuthClient();
  return {
    youtube: {
      configured: Boolean(g.clientId && g.clientSecret),
      clientIdHint: g.clientId
        ? `${g.clientId.slice(0, 8)}…`
        : undefined,
      source: s.googleClientId
        ? ("app" as const)
        : process.env.GOOGLE_CLIENT_ID
          ? ("env" as const)
          : ("none" as const),
    },
    instagram: {
      configured: Boolean(m.appId && m.appSecret),
      appIdHint: m.appId ? `${m.appId.slice(0, 6)}…` : undefined,
      source: s.metaAppId
        ? ("app" as const)
        : process.env.META_APP_ID
          ? ("env" as const)
          : ("none" as const),
    },
  };
}

export function saveOAuthClients(patch: {
  googleClientId?: string;
  googleClientSecret?: string;
  metaAppId?: string;
  metaAppSecret?: string;
}) {
  // Only overwrite keys that were provided (allow rotate without clearing the other)
  const next: AppSecrets = {};
  if (patch.googleClientId !== undefined)
    next.googleClientId = patch.googleClientId;
  if (patch.googleClientSecret !== undefined)
    next.googleClientSecret = patch.googleClientSecret;
  if (patch.metaAppId !== undefined) next.metaAppId = patch.metaAppId;
  if (patch.metaAppSecret !== undefined)
    next.metaAppSecret = patch.metaAppSecret;
  return dbPatchSecrets(next);
}

export function publicMediaBaseConfigured() {
  const base = process.env.GHOSTCUT_PUBLIC_MEDIA_BASE?.trim();
  return Boolean(base && !base.includes("127.0.0.1") && !base.includes("localhost"));
}
