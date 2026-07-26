# Founder Log Posting — Standard Operating Procedure

> **Status:** ✅ Active | **Purpose:** The single, authoritative standard for how each Founder Log day gets posted — same format, same surfaces, same order, every time. The daily posting Routine and any human doing it by hand both follow this exact procedure. | **Last Updated:** 2026-07-26

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
2. **Get the copy.** Days 004/005/007/009 → `batch-01`; 010–012 → `batch-04` (revised formula, see below); 014 → `batch-02`; 035 → `batch-03`. For any other day, draft the caption yourself using **only** facts already in `brand-narrative.md` / the assigned DCMA-14 item — never invent a stat, quote, or milestone — and use the current caption formula (below), not an older batch file's formula as a template.
3. **Blog first, and verify it's live.** Append the matching post to `backend/src/blog-content.js` (schema: `slug: founder-log-0NN-<slug>`, `category: 'Founder Log'`, plus an `ogImage` pointing to `/brand/founder-log-0NN-cover.jpg`). Host that cover under `backend/public/brand/`. Commit to `main` and let it deploy, **then confirm `https://www.ordo7.pro/blog/<slug>` returns 200 before posting to LinkedIn.** The post's link-card points at this URL; never post while the blog link 404s.
4. **Render the graphic** via `render/render.js` (alternate portrait side by day parity, per the calendar).
5. **Post to all three LinkedIn surfaces** (see format + IDs below), same caption + image on each.
6. **Post the first comment on each of the three posts** (Day 011 onward): `Try Ordo7 free → https://ordo7.pro`, posted immediately after each post goes live. This is the one link with no card behind it (see caption formula below) — it has to go somewhere, and the caption body isn't it.
7. **Log it.** Add the day's row to `posting-log.md` — slot, date, the three returned LinkedIn URLs, and the blog URL — and commit to `main`.
8. **Report** one line: which day posted, or "skipped, holiday", or "skipped, no real content for day 00N".

## LinkedIn surfaces, IDs, and format
| Surface | How | Format |
|---|---|---|
| **Taj's personal profile** | Zapier `linkedin_create_share_update` — `content__submitted_url` = blog URL, `content__submitted_image_url` = ordo7.pro cover | **Link-card** |
| **Ordo7 company page** (`142904113`) | Zapier `linkedin_create_company_update` — `image_type: preview_thumbnail`, `submitted_url` = blog URL, `image` = ordo7.pro cover, `title` + `description`, `allow_reserved_characters: false` | **Link-card** |
| **Level 7 Consulting page** (`142899041`) | same call as Ordo7, `company_id: 142899041` | **Link-card** |

**Use link-cards on ALL THREE surfaces — do NOT use `image_type: post_media` (native image) for the company pages.** Native company posts fail with LinkedIn's `DataMap should have no more than one entry for a union type` error: when the caption contains URLs (the blog link, ordo7.pro, the company-page link), LinkedIn tries to unfurl one as an article AND attach the media image → two content entries in one union → rejected. A link-card is a single article entity (the blog post, previewed with its cover), so there's no conflict — it posts first-try every time (proven across Days 005/007/010, after native posts failed repeatedly). The blog's `ogImage` (cover) is what shows in the card. **Also use the ordo7.pro-hosted image URL, never raw.githubusercontent.com** (GitHub rate-limits LinkedIn's image fetcher). Making all three surfaces native-image posts requires posting via LinkedIn's API directly — tracked as **Phase 2** below.

### Image hosting — serve from ordo7.pro, never raw.githubusercontent.com
LinkedIn fetches the post image at publish time. GitHub's raw host (`raw.githubusercontent.com`) rate-limits that fetcher, which makes the **native company-image post fail intermittently** (`Could not find entity` / `DataMap should have no more than one entry for a union type`) — this was the exact bug that blocked the 2026-07-23 run. Every day's feed graphic is deployed to `backend/public/brand/` and served from `https://www.ordo7.pro/brand/…`, which is reliable.

**Always post the company-page image using its `https://www.ordo7.pro/brand/founder-log-0NN-feed-1200x1500.jpg` URL — never the raw.githubusercontent.com URL.** For a new day: after rendering, copy the feed image into `backend/public/brand/`, commit + deploy so the ordo7.pro URL returns 200, then post (same gate as the blog link). Verified: on 2026-07-23 the Ordo7 native post that failed 3× on the raw-GitHub URL succeeded first-try on the ordo7.pro URL.

## Caption formula (from `brand-narrative.md`, revised 2026-07-26)
hook line → the problem/story → what Ordo7 does, one line, no link → a direct question inviting a reply → 3–4 hashtags. **`#Ordo7` is mandatory every time**, plus 3–4 topic-relevant tags.

**No URLs in the caption body — not even the blog link.** The post is already a link-card off `content__submitted_url` (the blog URL, set in the Zapier call itself — see the surfaces table below), which renders its own rich preview automatically. Typing the blog URL again in the caption text was redundant and, per the 2026-07-26 analytics finding below, plausibly reach-suppressing. The one link without a card — the `https://ordo7.pro` product ask — goes in a **first comment**, posted immediately after each of the three posts goes live (step 6 above): `Try Ordo7 free → https://ordo7.pro`. `Follow Ordo7 on LinkedIn` is dropped from the ask entirely.

**Why this changed:** Day 009 (512 impressions, right audience, **zero reactions/comments/reposts**) was the first day with usable analytics, and its caption had three raw links in the body. That's a known LinkedIn distribution suppressor, and the total absence of any question in the caption lines up with the zero comments. Full diagnosis and changelog in `brand-narrative.md`. Days 001–010 already posted under the old formula are not retroactively edited.

## Reliability — the Zapier connection
The Zapier LinkedIn connection drops periodically; that is the top failure mode. On every run:
- **Pre-flight:** call `list_enabled_zapier_actions`. If LinkedIn is missing or its actions error, **do not silently skip.**
- **Fail loud:** send the owner a **push notification** ("Founder Log did not post — reconnect Zapier LinkedIn") and stop. The slot is not lost; it re-posts once reconnected (the day stays unlogged, so it's still "next").
- **Reconnect:** the owner re-authorizes the LinkedIn connection in Zapier, then the next run picks the day back up automatically.
- Stop-and-alert on **any** ambiguity (a page missing, unclear which day is next, uncertain whether Slot A/F content is real) rather than guessing.

## Phase 2 — remove the Zapier dependency (planned)
Post to the personal profile via **LinkedIn's API directly** (native image UGC post), giving all three surfaces the same native format and removing the flaky Zapier connection as the single point of failure. Requires a LinkedIn developer app with `w_member_social` (profile) and Community Management `w_organization_social` (pages) — app approval is the long pole, so it runs in parallel with the Phase-1 Zapier reliability fixes above.
