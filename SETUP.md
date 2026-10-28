# Ghostcut — onboarding once, then studio

## Phase A first (infra)

Before using onboarding in the browser: deploy to Fly with HTTPS + a disk.  
See [docs/DEPLOY_FLY.md](./docs/DEPLOY_FLY.md). Phase B (below) starts only after that URL loads.

## Onboarding (first launch on your HTTPS URL)

| Step | You insert / do | App checks |
|------|-----------------|------------|
| **Profile** | Channel name, handle, YouTube About, IG bio | Fields complete → SQLite |
| **Video engine** | Paste `FAL_KEY` (or continue with local) | Kling and/or local ready |
| **Connect** | Paste Google + Meta client credentials → **Connect with OAuth** for YT + IG | Both **live** `connected` (demo does not finish setup) |
| **Finish setup** | Click Finish | `onboardingComplete` saved → next load opens Studio |

Redirect URIs (shown in Connect) must match `GHOSTCUT_APP_URL`:

- `{APP}/api/oauth/youtube/callback`
- `{APP}/api/oauth/instagram/callback`

Instagram live Reels also need `GHOSTCUT_PUBLIC_MEDIA_BASE` (public HTTPS).

## Studio (every day)

| Step | You do | Gate |
|------|--------|------|
| **Generate** | Batch → Generate MP4 → **Send to approval queue** | ≥1 queued item |
| **Quality check** | Watch, tick 4 gates → Approve or Reject | Approve disabled until all four |
| **Post** | Results / links after Approve | Live upload or clear error |

**Settings** (header) reopens profile / engine / connect without resetting the studio rail. Danger: Reset onboarding.

## Persistence

- DB: `.data/ghostcut.db` (gitignored)
- Videos: `.data/videos/`
- Legacy `.data/*.json` migrates into SQLite on first boot

## Rules

- Never share YouTube/Instagram passwords — OAuth only.
- You are the anti-slop gate: Reject anything that fails the quality checks.
- Demo connect is local smoke only; finishing onboarding requires live OAuth.

## Money

Views → YPP later. Ghostcut is the assembly line; platforms pay on attention.
