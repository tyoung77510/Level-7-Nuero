# Marketing assets

Version-controlled marketing/social-media creative for Ordo7 — **not served by the app**. Nothing in this folder is under `backend/public/`, so none of it becomes a live URL on ordo7.pro; it's here purely for reference and reuse across sessions.

## Structure

- `facebook/` — assets for Facebook posts/ads. Currently: `ordo7-upload-flow-animation.mp4`, a screen recording of the real upload flow (New Analysis → drop a schedule file → what-you'll-get panel).
- `social-ads/` — vertical (9:16) short-form ad clips for Reels/Stories/TikTok-style placements, generated via ElevenLabs. Currently: `02-the-fix.mp4` ("Score any schedule in seconds"). Numbered — looks like part of a series, so more (01, 03, ...) may follow.
- `linkedin-founder-log/` — full design handoff for the "Founder Log" LinkedIn series (the "Nocturne" design system): design source HTML, spec README, logo mark + founder portrait assets, a Playwright render pipeline (`render/`), and post-ready JPG renders in `renders/` for entries 001–009 (batch 01: 003, 004, 005, 007, 009 — 006 and 008 are live-only slots, not yet real). LinkedIn caption text for batch 01 is in `batch-01-linkedin-captions.md`; matching blog posts are in `../backend/src/blog-content.js`. See `../docs/brand-narrative.md` for confirmed copy and voice rules, and `../docs/founder-log-calendar.md` for the full 90-day topic calendar.

## Pending

Three branding images (two "7" glyph icon renders, one landscape hero card reading "Know what's slipping before your client does." with the ordo7.pro domain) were shared in chat but pasted inline rather than uploaded as files, so they aren't on disk and couldn't be added here yet. Re-share them as file attachments to get them stored.
