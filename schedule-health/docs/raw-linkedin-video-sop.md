# Raw LinkedIn Video — Standard Operating Procedure

> **Status:** ✅ Active (5-day trial) | **Purpose:** Authoritative procedure for the reach-optimized raw video series — separate from, and not a replacement for, the Founder Log series in `founder-log-posting-sop.md`. | **Last Updated:** 2026-07-26

## Why this exists, and why it's different from the Founder Log format
Day 009's real analytics (512 impressions, right audience, zero engagement) plus general LinkedIn distribution mechanics point at native, raw-feeling content outperforming polished/branded content for pure reach. This series is deliberately the opposite of the Founder Log format: no branding, no CTA card, no AI narration, no links in the body — a real screen recording of the product doing something true, captioned, ending on a genuine question.

**This is a 5-day trial, not an indefinite routine.** After 5 videos are logged in `../marketing-assets/demo-video/raw-video-log.md`, the Routine disables itself (`update_trigger` with `enabled: false`) and sends a wrap-up notification. Do not re-enable it without the owner's explicit request — the point is to look at what 5 real posts actually did before committing further.

## Automation stance — stage and notify, NEVER auto-post
Unlike the Founder Log routine, **this routine does not post anything to LinkedIn itself.** It produces the video + caption + first-comment text, commits them to the repo, and sends the owner a push notification that it's ready. The owner posts it manually and personally replies to comments in the first hour — that fast personal engagement is the mechanic this format depends on, and an unattended auto-post would undercut it. Do not change this posture without the owner explicitly asking for full auto-post.

## Cadence
Weekdays only, once a day, for 5 firings total. Cron `0 16 * * 1-5` UTC (9am PDT; becomes 8am after DST ends ~Nov 1 — flag to the owner then, same as the Founder Log routine's note). Skip the same US holidays the Founder Log routine skips (see its SOP) — do not post on a holiday, re-run the next weekday instead.

## The procedure, per firing
1. **Check the count.** Read `../marketing-assets/demo-video/raw-video-log.md`. If 5 entries are already logged, disable this trigger (`update_trigger`, `enabled: false`) and stop — send a wrap-up notification instead of producing a 6th video.
2. **Pick the next topic** from the rotation table in that log file, in order. Each topic names a real, currently-working Ordo7 feature — never invent one. **Before recording, verify the feature actually behaves as the topic describes**, live, in the running app (`cd schedule-health/backend && node src/server.js`, use the demo account). If it doesn't work as expected, stop and flag it rather than recording a demo of something broken or staging it to look like it works.
3. **Record a fresh screen capture** with Playwright, following the pattern in this session's history: real actions only (no scripted lies), `waitForSelector`/`waitForFunction` on real DOM state rather than fixed timeouts (recording in this sandbox has a one-time ~13s warm-up lag — trim it in post with `ffmpeg -ss` placed *after* `-i`, don't try to pre-absorb it with a fixed wait). Silent, no audio track.
4. **Cut and caption it** per the raw blueprint (below). No logo, no branded end card, no AI voice.
5. **Write the caption** — hook → real story/context tied to what's on screen → one plain line on what Ordo7 does, no link → a genuine question inviting a reply → 3–4 hashtags. Never fabricate a claim or a statistic; if you want a number, it has to come from what's actually on screen or from real product/usage data, cited.
6. **Write the first-comment text** — one line, one link: `Try Ordo7 free → https://ordo7.pro`.
7. **Save and commit.** Video to `../marketing-assets/demo-video/ordo7-raw-0N-<slug>.mp4`, caption + first-comment text into a new entry in `raw-video-log.md`. Commit to `main` via a PR (same branch discipline as the rest of this repo).
8. **Notify the owner** (push notification): which video is ready, where the file is, and a reminder to post personally and reply to comments in the first hour. Do not post to LinkedIn.
9. If this was the 5th video, also disable the trigger and note in the notification that the trial is complete and results are worth reviewing before continuing.

## The raw blueprint (recap)
- **0–3s hook** — bold caption over real, already-moving footage. A specific, slightly uncomfortable claim, not a generic tagline.
- **3–15s proof** — the real feature, real data, minimal captions timed to what's on screen.
- **15–22s** — one specific, true claim tied to what was just shown.
- **Close** — plain-text question, not a CTA card. No logo. No links in the body anywhere.
- Square or vertical, under 25s, captions burned in, native upload (not a YouTube link).

## Never fabricate
Every hard rule from the GTM outreach and Founder Log routines applies here too: never invent a stat, a feature capability, or a claim not directly grounded in what's on screen or in verified repo/product truth. If a planned topic turns out not to hold up when you go check it live, stop and flag it rather than force the day's video out.
