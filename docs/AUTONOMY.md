# Ghostcut autonomy: OAuth + human approval

Goal: agents generate and stage posts; **you** are the final approver so nothing “slop” goes live.

```
Generate batch → Render MP4 → Send to approval queue
        → You watch / Approve or Reject
        → On Approve: OAuth upload to YouTube Shorts + Instagram Reels
```

## What is autonomous vs human

| Step | Who |
|------|-----|
| Clip ideas + captions | Ghostcut |
| MP4 render (Kling / local) | Ghostcut |
| Queue for review | You click **Send to approval queue** (or we can auto-queue later) |
| Quality gate | **You only** — Approve / Reject |
| Platform upload | Ghostcut via OAuth tokens |
| Passwords | Never — OAuth only |

## Connect accounts (OAuth)

1. Open **Publish hub** (`#publish`).
2. **YouTube:** set `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`, enable YouTube Data API v3, redirect URI  
   `{GHOSTCUT_APP_URL}/api/oauth/youtube/callback`  
   Then **Connect with OAuth**.
3. **Instagram:** Meta app with Instagram Graph permissions, redirect URI  
   `{GHOSTCUT_APP_URL}/api/oauth/instagram/callback`  
   IG must be a Business/Creator account linked to a Facebook Page.
4. Without live keys: **Connect demo** exercises the full Approve → “posted (demo)” path.

Tokens live in `.data/connections.json` (gitignored). Never commit them.

## Approval queue

- Studio → Generate MP4 → **Send to approval queue**
- Publish hub lists **pending** items with video + captions
- **Approve & post** → uploads to connected platforms
- **Reject** → never posts; leave a reason for the next render

## Instagram note

Meta’s Reels API needs a **public HTTPS** `video_url`. Localhost cannot be fetched by Instagram. For live IG posts set:

```bash
GHOSTCUT_PUBLIC_MEDIA_BASE=https://your-public-host
```

YouTube upload works from the server filesystem (multipart), so local demo + live YT is fine without a public media base.

## Security

- No password collection
- CSRF-ish OAuth `state` cookie on start/callback
- Disconnect clears stored tokens
- You remain the only path from “rendered” → “public”
