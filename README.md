# Ghostcut

Guided workflow for **Gentle Gentlemen** (`@gentle.gently.gentlish`): faceless looping Rube Goldberg **Shorts & Reels**.

**Purpose:** one-time setup, then everyday **Generate → Quality check → Post** (you approve before anything goes live).

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123) (or `http://localhost:43123`).

Dev note: `allowedDevOrigins` in `next.config.ts` must include the host you use in the browser, or Next blocks client hydration and buttons appear dead.

## Deploy (Phase A — before in-app onboarding)

Host on **Fly.io** (HTTPS + persistent volume). Step-by-step: [docs/DEPLOY_FLY.md](./docs/DEPLOY_FLY.md).

Until `https://YOUR-APP.fly.dev` loads the setup screen, do **not** start Google/Meta OAuth.

## Product shape

1. **Onboarding (once)** — Profile → Video engine → Connect (live OAuth) → Finish setup  
2. **Studio (everyday)** — Generate → Quality check → Post  
3. **Settings** — edit profile / Kling key / reconnect OAuth without putting setup back on the main rail

Setup is stored in gitignored **SQLite** at `.data/ghostcut.db` (profile, secrets, OAuth tokens, queue). “Forever” means the same machine / persistent volume — not a multi-device cloud account.

## Optional env

```bash
FAL_KEY=                 # or paste in-app
OPENAI_API_KEY=          # richer batch copy
GOOGLE_CLIENT_ID=        # or paste in Connect / Settings
GOOGLE_CLIENT_SECRET=
META_APP_ID=
META_APP_SECRET=
GHOSTCUT_APP_URL=http://127.0.0.1:43123
# Instagram live Reels need a public HTTPS URL Meta can fetch:
# GHOSTCUT_PUBLIC_MEDIA_BASE=https://your-deployed-host.example
```

See [SETUP.md](./SETUP.md) and [docs/AUTONOMY.md](./docs/AUTONOMY.md).
