# Phase A — Deploy Ghostcut on Fly.io

Goal: public HTTPS URL + persistent disk, so **in-app onboarding** can begin.  
Do **not** start Google/Meta OAuth until this page loads: `https://YOUR-APP.fly.dev`

## Fastest path

From this folder on your Mac, run:

```bash
bash scripts/deploy-fly.sh
```

It installs `flyctl` if needed, logs you in, pushes to GitHub, creates the app + volume,
sets secrets (including a login password) and deploys. The manual steps below do the same thing.

## Prerequisites

- GitHub repo with this code pushed
- [Fly.io](https://fly.io) account
- [flyctl](https://fly.io/docs/flyctl/install/) on your laptop

```bash
fly auth login
```

## 1. Push code

```bash
git remote -v   # should be your GitHub repo
git push -u origin main
```

## 2. Create the Fly app (once)

From the repo root:

```bash
# Pick a unique app name and a region near you (den, iad, sjc, …)
fly launch --no-deploy --copy-config --name ghostcut-YOURNAME --region dfw
```

If `fly.toml` already has `app = "…"`, you can use:

```bash
fly apps create ghostcut-YOURNAME
# then edit fly.toml `app = "ghostcut-YOURNAME"`
```

## 3. Persistent volume (required)

SQLite, OAuth tokens, and queued videos live on disk:

```bash
fly volumes create ghostcut_data --region dfw --size 3
```

`fly.toml` already mounts it at `/data`.

## 4. Launch env (Phase A only)

Replace with your real Fly hostname after create:

```bash
fly secrets set \
  GHOSTCUT_APP_URL=https://ghostcut-YOURNAME.fly.dev \
  GHOSTCUT_PUBLIC_MEDIA_BASE=https://ghostcut-YOURNAME.fly.dev \
  GHOSTCUT_PASSWORD=pick-a-long-password
```

`GHOSTCUT_PASSWORD` puts the whole app behind a browser login (any username + that password).
Without it, anyone who finds the URL could approve posts or spend your fal.ai credits.

Optional now (or paste later in Engine onboarding):

```bash
fly secrets set FAL_KEY=your_fal_key
```

## 5. Deploy

```bash
fly deploy
fly status
fly open
```

**Phase A done when** the site opens on HTTPS and shows Ghostcut **one-time setup** (Profile → Engine → Connect).

## 6. Your domain (optional, still Phase A)

```bash
fly certs add ghostcut.yourdomain.com
```

Add the DNS records Fly prints (usually a CNAME or A/AAAA). Then:

```bash
fly secrets set \
  GHOSTCUT_APP_URL=https://ghostcut.yourdomain.com \
  GHOSTCUT_PUBLIC_MEDIA_BASE=https://ghostcut.yourdomain.com
fly deploy
```

## After Phase A → Phase B (in the app)

Open the HTTPS URL → complete **Profile → Engine → Connect** (paste Google/Meta client credentials + Connect with OAuth) → **Finish setup**.

Redirect URIs shown in Connect will use `GHOSTCUT_APP_URL`.

## Useful commands

```bash
fly logs
fly ssh console
fly volumes list
```
