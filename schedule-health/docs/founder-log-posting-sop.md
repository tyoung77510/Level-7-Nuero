# Founder Log Posting — Standard Operating Procedure

> **Status:** ✅ Active | **Purpose:** The single, authoritative standard for how each Founder Log day gets posted — same format, same surfaces, same order, every time. The daily posting Routine and any human doing it by hand both follow this exact procedure. | **Last Updated:** 2026-07-22

This is the source of truth. Companion files: the day-by-day topic bank is `founder-log-calendar.md`; the locked voice + caption formula is `brand-narrative.md`; pre-approved copy is `../marketing-assets/linkedin-founder-log/batch-0N-linkedin-captions.md`; the graphic pipeline is `../marketing-assets/linkedin-founder-log/render/`; the dedup ledger is `../marketing-assets/linkedin-founder-log/posting-log.md`; matching blog posts live in `../backend/src/blog-content.js`.

## Automation stance — fully straight-through, no approval gate
The routine drafts **and publishes** each day end to end on its own — the blog article and all three LinkedIn surfaces — every weekday, with no human review step in the path. Do not add a "draft → wait for approval → publish" checkpoint; the owner has explicitly chosen no bottlenecks. The only things that ever halt a run are the **safety rails below, never a review queue**:
- **Fabrication guard** — a Slot A/F day with no real content is skipped, never invented (step 1).
- **Dead-blog-link stop** — never post a caption whose blog URL 404s (step 2).
- **Connection-down stop** — if the LinkedIn connection is off, alert the owner and let the day re-run, rather than posting half of it (step 4).

Everything else publishes without waiting on anyone.

## Cadence
- One post per weekday (Mon–Fri), ~4pm US/Pacific, run by the **"Ordo7 Founder Log Daily Posting"** Routine (cron `0 23 * * 1-5` UTC = 4pm PDT; becomes 3pm after DST ends ~Nov 1 — flag to the owner then).
- **Holiday check first.** Do not post on US holidays (engagement craters). Known skip dates: 2026-09-07, 2026-10-12, 2026-11-11, 2026-11-26, 2026-11-27, 2026-12-25. Past the last known date, ask the owner rather than guessing.

## Work off `main` — always
Production (ordo7.pro) deploys from **`main`**. All posting work — blog appends, cover images, posting-log updates — commits to `main` (via a PR that gets merged) so it actually deploys. **Do not work off a feature branch for this;** that is exactly what left every blog link 404 in the past. If `main` is missing calendar/captions/render infra, stop and alert the owner.

## The procedure, per day
1. **Pull latest `main`.** Read `posting-log.md`. Find the lowest-numbered day in `founder-log-calendar.md` **not** already listed as posted. Respect the Slot A/F fabrication rule — if the next day is a build-log (A) or user-feedback (F) day with no real content yet, skip it (do not fabricate, do not log it) and take the next eligible day.
2. **Get the copy.** Days 004/005/007/009 → `batch-01`; 014 → `batch-02`; 035 → `batch-03`. For any other day, draft the caption yourself using **only** facts already in `brand-narrative.md` / the assigned DCMA-14 item — never invent a stat, quote, or milestone.
3. **Blog first, and verify it's live.** Append the matching post to `backend/src/blog-content.js` (schema: `slug: founder-log-0NN-<slug>`, `category: 'Founder Log'`, plus an `ogImage` pointing to `/brand/founder-log-0NN-cover.jpg`). Host that cover under `backend/public/brand/`. Commit to `main` and let it deploy, **then confirm `https://www.ordo7.pro/blog/<slug>` returns 200 before posting to LinkedIn.** The caption links to this URL; never post the caption while the blog link 404s.
4. **Render the graphic** via `render/render.js` (alternate portrait side by day parity, per the calendar).
5. **Post to all three LinkedIn surfaces** (see format + IDs below), same caption + image on each.
6. **Log it.** Add the day's row to `posting-log.md` — slot, date, the three returned LinkedIn URLs, and the blog URL — and commit to `main`.
7. **Report** one line: which day posted, or "skipped, holiday", or "skipped, no real content for day 00N".

## LinkedIn surfaces, IDs, and format
| Surface | How | Image format |
|---|---|---|
| **Taj's personal profile** | Zapier `linkedin_create_share_update` | **Link-card** today (Zapier limitation). Native image is Phase 2 — see below. |
| **Ordo7 company page** (`142904113`) | Zapier `linkedin_create_company_update`, `image_type: post_media` | **Native image** ✅ |
| **Level 7 Consulting page** (`142899041`) | Zapier `linkedin_create_company_update`, `image_type: post_media` | **Native image** ✅ |

The **company pages already post native images** (the full 4:5 graphic in-feed). The **personal profile cannot** through Zapier's only personal action — it attaches the graphic as a link-card preview, not a native image. Making the personal post native (matching the company pages) requires posting via LinkedIn's API directly — tracked as **Phase 2** below.

## Caption formula (from `brand-narrative.md`)
hook line → the problem/story → what Ordo7 does → `Read the full post → <blog URL>` → `Follow Ordo7 on LinkedIn → https://www.linkedin.com/company/ordo7/` → `Try It For Free → https://ordo7.pro` → 4–5 hashtags. **`#Ordo7` is mandatory every time**, plus 3–4 topic-relevant tags. The blog link is mandatory (every day has a matching blog post).

## Reliability — the Zapier connection
The Zapier LinkedIn connection drops periodically; that is the top failure mode. On every run:
- **Pre-flight:** call `list_enabled_zapier_actions`. If LinkedIn is missing or its actions error, **do not silently skip.**
- **Fail loud:** send the owner a **push notification** ("Founder Log did not post — reconnect Zapier LinkedIn") and stop. The slot is not lost; it re-posts once reconnected (the day stays unlogged, so it's still "next").
- **Reconnect:** the owner re-authorizes the LinkedIn connection in Zapier, then the next run picks the day back up automatically.
- Stop-and-alert on **any** ambiguity (a page missing, unclear which day is next, uncertain whether Slot A/F content is real) rather than guessing.

## Phase 2 — remove the Zapier dependency (planned)
Post to the personal profile via **LinkedIn's API directly** (native image UGC post), giving all three surfaces the same native format and removing the flaky Zapier connection as the single point of failure. Requires a LinkedIn developer app with `w_member_social` (profile) and Community Management `w_organization_social` (pages) — app approval is the long pole, so it runs in parallel with the Phase-1 Zapier reliability fixes above.
