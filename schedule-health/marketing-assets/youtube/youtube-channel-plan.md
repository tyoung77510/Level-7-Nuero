# Ordo7 YouTube Channel — launch plan

> **Status:** 🟡 Planned, not yet created | **Purpose:** Channel identity, first-batch content, and content backlog for the Ordo7 YouTube channel. Owner-decided focus: **Product Deep Dives** (2026-08-05). | **Last Updated:** 2026-08-05

**What this session can and can't do.** No YouTube API/OAuth connector is available in this session — channel creation and every upload are manual steps Taj does himself. This doc prepares everything short of that: identity, copy, and an upload-ready first batch. Same "stage and notify, never auto-post" posture the raw LinkedIn video series already uses, just with a bigger manual gap since there's no upload automation at all yet.

## Channel identity

- **Name:** Ordo7
- **Handle:** `@Ordo7` — no existing channel found under this name/handle in a web search (checked 2026-08-05); YouTube's own handle registry is the real check, do that at creation time.
- **Category:** Science & Technology (or Education — either is defensible; Education leans into the "learn something" framing of Deep Dives, Science & Technology reads more SaaS-product-forward. Recommend Education, since every video's actual content is explaining a real project-controls concept, not just showcasing a UI).
- **Profile picture:** reuse `backend/public/brand/musk/icon-512.png` — needs upscaling to YouTube's 800×800 minimum (it's a flat glyph, should upscale cleanly, but verify no artifacting before uploading).
- **Banner (2560×1440, safe area 1546×423):** none built yet. Offering to build one next, reusing the Nocturne dark palette (`#080d12` ground, `#34d399` accent) already established across `/check` and the Deep Dive video captions, so the channel matches everything else Ordo7-branded — say the word and I'll build it.

### Channel description (paste-ready)

> Ordo7 runs DCMA-style schedule health checks on your Primavera P6, MS Project, or CSV export — missing logic, negative float, out-of-sequence work, hard constraints, and more — and gives you a plain-language score in seconds instead of a spreadsheet of red flags.
>
> This channel is real walkthroughs of the actual product: real schedules, real scores, real issues, no staged demos. New Deep Dive videos as features ship.
>
> Free, no-signup schedule check: https://www.ordo7.pro/check
> Full product: https://www.ordo7.pro

### Suggested first playlist

**"Ordo7 Deep Dives"** — single playlist for now; split into more playlists (e.g., "DCMA Checks Explained," "Feature Walkthroughs") once there's enough volume that one list gets unwieldy (roughly 10+ videos).

## Format: lead with Shorts, not standard videos

Every Deep Dive built so far is vertical (720×1280) and 27–35 seconds — that's YouTube Shorts' native shape (vertical, ≤60s), not a standard 16:9 video. Two implications:

1. **The existing 4 videos are upload-ready for Shorts as-is** — zero rework, just upload.
2. **Standard longer-form videos (3–8 min tutorials, screen-recorded landscape, deeper walkthroughs) are a real but separate future format** — different aspect ratio, different pacing, a bigger production lift per video (more real product interaction to record, longer narration to write and verify). Worth doing once Shorts prove the channel is worth the ongoing effort, not before.

Recommendation: launch on Shorts only, using the existing pipeline, and revisit standard-length videos once there's a first real batch live and some signal on whether anyone's watching.

## First batch — ready to upload today

All four already built, live-verified, real product interactions (see `deepdive-video-log.md` for full build notes). Suggested upload order — oldest-built first, so the channel's own history matches when each feature was actually real:

| # | Video file | Title (YouTube, ≤100 chars) | Tags |
|---|---|---|---|
| 1 | Deep Dive #1 (delivered earlier this session — Issue Punch List + "How to fix") | Ordo7: Real Schedule, 5 Failed Checks, 2/100 Score | primavera p6, dcma 14 point, schedule health check, project controls, construction scheduling |
| 2 | Deep Dive #2 (Ask Ordo) | Ask Your Schedule a Question — Literally | Primavera P6, ask ordo, ai project controls, schedule chatbot, dcma checks |
| 3 | Deep Dive #3 (Earned Value Management) | Real EVM in Seconds: CPI, CV, Planned vs Actual | earned value management, cpi cost variance, project controls software, primavera p6, evm explained |
| 4 | Deep Dive #4 (Free checker, narrated, 27s) | Free Schedule Health Check — No Signup Required | free schedule checker, dcma 14 point check, primavera p6 online, no signup tool, project controls |

**Descriptions** (same shape for all four, swap the specific claim):

> [1–2 sentence real claim from the video, e.g. "This real Primavera P6 schedule scored 2 out of 100 — here's exactly why."]
>
> Ordo7 runs DCMA-style schedule health checks on your P6, MS Project, or CSV export and gives you a plain-language score in seconds. Real schedule, real result, every time — nothing staged.
>
> Try it free, no signup: https://www.ordo7.pro/check
> Full product: https://www.ordo7.pro
>
> #Ordo7 #ProjectControls #PrimaveraP6 #DCMA #ConstructionManagement

## Content backlog — real features not yet Deep-Dived

Every topic below is a real, already-shipped feature verified in this session's own work, not a guess at what to build next:

- **What-If Sandbox** — recovery-scenario testing (float/duration edits, live score recalculation). Already has a raw LinkedIn cut (`ordo7-raw-03-sandbox.mp4`) that could be re-shot narrated for Shorts, or used as reference for the beats.
- **Finish Forecast (Earned Schedule)** — two-scenario IEAC(t) finish-date forecast. Same situation — raw cut exists (`ordo7-raw-05-forecast.mp4`), no Deep Dive yet.
- **Gantt Timeline — milestones, WBS grouping, baseline comparison** — built this session, real, live, and has **zero video coverage in either series so far.** Probably the strongest next Deep Dive: milestone diamonds, collapsible WBS phase headers, and the baseline-vs-actual drift overlay are all genuinely new and demoable.
- **The redesigned `/check` landing page itself** (the conversion-focused rebuild, not just the checker function) — a "why this page is built the way it is" Deep Dive could work, though this leans more founder-narrative than product-demo; flagging as a maybe, not a strong recommendation, given the chosen focus is Deep Dives not vlogging.

## Cadence

No existing automation posts to YouTube (none possible without a connector). Recommend starting at whatever pace keeps quality real — 1 Short/week is sustainable without straining the live-verify-then-record discipline every entry so far has held to; faster is fine if you're doing the uploads yourself and I keep feeding you verified, ready-to-upload videos ahead of that pace.

## Open items, not resolved here

- **Channel banner** — not built; say the word and I'll design one off the existing Nocturne palette.
- **Thumbnail strategy** — Shorts don't strictly need custom thumbnails (YouTube auto-picks a frame), but a consistent custom thumbnail style is worth deciding before the channel has enough videos that retrofitting is annoying.
- **Whether to cross-post the raw LinkedIn series to Shorts too**, not just Deep Dives — the raw series' own SOP says "native upload (not a YouTube link)" for LinkedIn specifically; doesn't preclude also uploading the same silent clips to Shorts separately. Worth a call once the Deep-Dive-only channel has some runway.
