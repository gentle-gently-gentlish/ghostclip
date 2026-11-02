# Facebook Page Reels

Facebook publishing uses the **same Meta login as Instagram**. There is no second OAuth app or flow.
On connect, Ghostcut also saves the linked Page's access token as the `facebook` connection,
if the login granted `pages_manage_posts`. Instagram works exactly as before even if that part fails.

## One-time owner steps
1. Meta app dashboard → Facebook Login (for Business) → permissions: make sure **`pages_manage_posts`** is
   enabled. Instagram already uses `pages_show_list`, `pages_read_engagement` and `business_management`.
   If you use a Business Login configuration (`META_CONFIG_ID`), add `pages_manage_posts` to that
   configuration, because there the scopes come from the configuration, not from the code.
2. Deploy this version (`scripts/deploy-fly.sh`).
3. Publish hub → **Reconnect Meta login** (Instagram or Facebook card). On Meta's screen, keep the Page
   selected and allow "Create content on your Page".
4. The Facebook card should now show your Page name as `connected`. If it doesn't, the server log line
   `[ghostcut] Facebook Page not connected: …` says why.

## What gets published
- `video_reels` three-phase upload (start → binary upload → finish, `video_state=PUBLISHED`). The file is
  uploaded from the server, so no public media URL is needed.
- Copy: `clip.facebook` if present, otherwise the Instagram copy.
- Meta's Reel spec: 9:16, 3–90 s, 24–60 fps, H.264/AAC. Pages post publicly only, max 30 API posts per 24 h.
- Only queue items whose `platforms` include `"facebook"` go to Facebook. Existing items are unchanged.

## Not yet covered
- Long-form 16:9 Page videos (`/{page-id}/videos`, may need `publish_video`). Planned with the
  Kinetic Worlds package import.
- Graph API v21.0 expires 2027-01-21; upgrade all Meta calls together before then.

## Tests
`npm run test:facebook`: spawns its own server against a local mock of Meta. Nothing is posted.
