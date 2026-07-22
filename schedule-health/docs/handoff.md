# Handoff — read this first in a new chat

> Living pointer doc, not a vault note (no metadata blockquote needed — see schedule-health/CLAUDE.md).
> Purpose: let a fresh Claude session (new chat, zero memory of prior conversation) reorient in one read.
> Update this whenever a new chat picks up work, so the NEXT new chat stays current too.

## Today's blocked Founder Log run (2026-07-22) — pick this up first

The daily Founder Log posting Routine fired today (2026-07-22, not a holiday) and got all the way to the posting step before stopping. Everything is staged and verified — the only blocker is Zapier.

- **Day to post: 004** ("Utility industry / safety") — lowest unposted day per `marketing-assets/linkedin-founder-log/posting-log.md` (001–003 already posted). Not a Slot A/F day, so no real-content check needed.
- **Caption:** already pre-approved in `marketing-assets/linkedin-founder-log/batch-01-linkedin-captions.md` (the "## Day 004" section) — use as-is, don't redraft. Includes the blog link, `Try It For Free → https://ordo7.pro`, and `#Ordo7` plus 4 other tags.
- **Graphics:** already rendered — `marketing-assets/linkedin-founder-log/renders/founder-log-004-feed-1200x1500.jpg` and `founder-log-004-cover-1200x627.jpg`.
- **Blog post:** already live in `backend/src/blog-content.js` at slug `founder-log-004-utility-safety`.
- **Blocker:** Zapier connector is authenticated/connected at the org level but `enabledInChat: false` for this chat session (confirmed via `ListConnectors`, keyword `"Zapier"`) — same per-chat toggle issue as Apollo hit in a parallel thread. Posting to LinkedIn (personal profile + Level 7 Consulting page `142899041` + Ordo7 page `142904113`) can't proceed until it's enabled.
- **Nothing was posted. `posting-log.md` was NOT touched** — Day 004 is still correctly absent from it.

**Next action for whoever picks this up:** confirm Zapier shows `enabledInChat: true`, then post Day 004's pre-approved caption + graphic to all three LinkedIn destinations, commit nothing new (content already committed), and add Day 004's row to `posting-log.md` with the three post URLs + blog URL. Full step-by-step instructions live in the Routine's own standing prompt (see the `trig_01NFQsz9yfnoiFrFTriZx4qM` trigger below) — this note is just the "what's already done, what's blocked" snapshot.

**Caption formula changed (2026-07-22):** a fourth mandatory link — `Follow Ordo7 on LinkedIn → https://www.linkedin.com/company/ordo7/` — was added to the standing caption formula in `brand-narrative.md`, cross-promoting the company page from the personal-profile post. **Day 005's caption in `batch-01-linkedin-captions.md` is already updated with this link and matches its blog post (`founder-log-005-eight-years`) — ready to post as-is when its turn comes, no further drafting needed.** Day 004 (queued to post next, see above) does **not** have this link yet — it was already fully staged before this change. Ask the user whether to retrofit Day 004 with the company-page link before posting it, or let it ship as originally drafted. Days 007+ that get drafted fresh (not pre-written in a batch file) should follow the updated 4-link formula in `brand-narrative.md` automatically.

**Other pre-drafted days still missing the company-page link:** 004, 007, 009 (`batch-01-linkedin-captions.md`), 014 (`batch-02-linkedin-captions.md`), 035 (`batch-03-linkedin-captions.md`) — none of these have been posted yet, so there's still time to retrofit them, but the user hasn't confirmed whether to backfill all of them or just apply the new link going forward. Ask before bulk-editing.

## Where things stand (as of 2026-07-20)

**Branch:** `claude/new-session-8x1hcw` (tyoung77510/Level-7-Nuero) — this is the standing dev branch for all Ordo7/marketing work referenced below. Check whether it's since been merged to `main`; if merged, start fresh from `main` under a new branch rather than stacking on merged history.

**PR #39** — "Ordo7 Founder Log: render pipeline + 90-day calendar + first batch" — open, draft, `mergeable_state: clean`, no CI configured, no review comments as of last check. Being auto-monitored by a standing check-in Routine (see below) — don't duplicate that by manually polling unless asked.

## What's built and working

- **Founder Log render pipeline** (`marketing-assets/linkedin-founder-log/render/`) — JSON → branded JPG via Playwright.
- **90-day content calendar** (`docs/founder-log-calendar.md`) — 7-slot weekly wheel; Slots A (build log) and F (user feedback) must never be pre-written, only posted when real content exists.
- **First content batches drafted and rendered** (days 003–009, plus day 014 "Ask Ordo vs. ALICE").
- **GTM competitive strategy docs** — see `/workspace/ordo7-competitive-intel/` (channels-report.md, gtm-strategy.md, fundraising-readiness.md) and a separate tracked repo `tyoung77510/ordo7-competitive-intel` watched weekly by its own Routine.
- **GTM outreach engine** — `docs/gtm-action-log.md` has the hard rules (never fabricate a target, never send — Gmail only supports `create_draft`, personalize don't template) and the running log.
- **TEDx talk draft** — `docs/tedx-talk-draft.md`, sourced stats included.
- **SmartPM 2026 report analysis** — user shared SmartPM's own "State of Construction Scheduling 2026" report (PDF); analyzed in `ordo7-competitive-intel/smartpm-2026-report-analysis.md` (private repo) — findings organized by leverage for Ordo7, marketing angles, and product feature gaps. Never name SmartPM in public content — reference generically, same rule as the Day 014/ALICE insert.
  - **Marketing:** Founder Log Day 035 (`batch-03-linkedin-captions.md`) shipped, sharpened with the report's real numbers (44% of updates rewrite actuals, 3x self-rating-vs-measured gap).
  - **Product — all three built and shipped** (commit `1d991cb`): (1) **Invalid Dates DCMA check** in `analyze.js` — reversed/future/missing actual dates, runs before milestone-classification to avoid a real edge case where reversed dates silently reclassify a task as a milestone. (2) **Changed-actuals / regressed-progress detection** — `GET /api/snapshots/compare` now returns `changedActuals`/`regressedProgress`, rendered as two "Data integrity" cards in the Trends view. (3) **Early-slip-no-recovery SPI alert** — `computeRecoveryAlert` in `analyze.js`, an honest narrower proxy for the report's strongest causal finding (not a full reimplementation — no baseline-finish/recovery-plan tracking), wired into `/api/analyze` and `/api/projects/:name/latest`, rendered as a banner atop the Earned Value panel. All three verified via curl + Playwright with synthetic multi-snapshot fixtures — see `backend/README.md`'s "Tested" section for the full writeup.
- **Fix-guidance layer (Pro-gated)** — shipped (commit `e045c23`), following up on the user's question "does Ask Ordo/the report give fix guidance?" Rule-based, not AI-generated (`backend/src/fix-guidance.js` — a written remediation guide per DCMA check type, matched by the same substring convention as `subScoresFrom()`), deliberately chosen over AI-generated per-issue guidance so it costs nothing to serve and doesn't duplicate Ask Ordo's deeper conversational role. `GET /api/issues/:id/fix-guidance` enforces the Pro/Teams gate server-side (`402` for free tier) on top of the existing ownership check — real backend enforcement, unlike Earned Value/snapshot-comparison which are currently frontend-gated only (a pre-existing gap in this codebase, flagged to the user but not fixed as part of this feature — their call whether to address it). Issue Punch List has a "How to fix" button per open issue, expanding inline to an upgrade card (free) or the real guidance (Pro). Marketing follow-up in progress: building a clean demo dataset to recapture polished screenshots of the recovery-alert banner and data-integrity cards (the test screenshots used throwaway synthetic data and looked unpolished — score of 0, generic "Task 1-5" names, visible test-user email).
- **Profile survey feature** (Ordo7 product itself) — post-first-analysis modal asking portfolio size + migrated-from tool, admin aggregate panel at `/admin`. Fully built, tested, shipped.
- **Blog newsletter subscribe** — `POST /api/blog/subscribe`, backed by MailerLite (`backend/src/mailerlite.js`), group "Ordo7 Blog Subscribers" (id `193524211311970129`). Code is live and pushed. **Route logic, rate-limiting, and frontend wiring are verified** (curl + Playwright). **Live delivery to MailerLite is NOT yet confirmed** — this dev sandbox's network policy blocks direct egress to `connect.mailerlite.com`, and the MailerLite MCP connector stayed `enabledInChat: false` despite repeated toggling, so `get_group_subscribers` couldn't be used to confirm a test subscriber landed. Should work fine once actually deployed (no sandbox restriction there) — but hasn't been proven live yet.

## Known pending items

1. **MailerLite live verification** — once the MailerLite connector shows `enabledInChat: true` in a session, call `get_group_subscribers` on group `193524211311970129` to confirm a real subscribe landed, or just test after deployment.
2. **Rotate the MailerLite API token.** A real token was pasted into chat during setup (now only in the gitignored local `.env`, never committed) — rotate it from the MailerLite dashboard once the integration is confirmed working, and update `.env` with the new value.
3. **MailerLite trial decision** — reminder scheduled for 2026-08-02 (trigger `trig_01TBwBX4LPqa2XPJApK4FRef`) to decide paid vs. fallback (Postmark) before the 14-day trial lapses.

## Standing Routines (all currently bound to session `session_01VTYXGdK1RjS3MSnZx4mz2e`)

These keep running regardless of which chat is open, since they fire into that specific session, not "whichever chat is open." Use `list_triggers` in a new chat to get current IDs/state — the ones below were current as of this doc's last update.

| Routine | Schedule | Trigger ID |
|---|---|---|
| Ordo7 Founder Log Daily Posting | `0 23 * * 1-5` | `trig_01NFQsz9yfnoiFrFTriZx4qM` |
| Ordo7 GTM Daily Outreach Engine | `0 13 * * 1-5` | `trig_01WV7MfNJUSjXVxEmUeTTtAn` |
| Ordo7 Nightly Vault Maintenance | `0 7 * * *` | `trig_0162cwuWDJbAdVXpHHSAJpMt` |
| Ordo7 Competitor Watch (separate repo) | `7 5 * * 1` | `trig_01R57zzKZeti8vQvccJ394D2` |
| PR #39 check-in (one-shot, re-arms hourly) | — | rotates each fire, check `list_triggers` |

**If you want these to report into a NEW chat instead of this one:** either update each trigger's target (delete + recreate bound to the new session), or just periodically check this old session for their output. Ask the user which they'd prefer before changing anything — these were deliberately left bound to the original session.

## Conventions to carry forward

- Never fabricate data — real WebSearch-sourced stats only, everywhere (TEDx doc, GTM targets, competitor intel).
- Chat is not a secure secret store — flag any pasted credential plainly, keep it out of git-tracked files, recommend rotation.
- Zero-dependency backend (`node:http`, `node:sqlite` only) — every integration is a raw `fetch()` call with a `xConfigured()` graceful-degradation check.
- Schema changes go through `ensureColumn()` in `db.js`, nullable/safe-defaulted only.
- `.split` in `admin.html` is a fixed 4-column grid — new panels go in a new full-width row below it.

> **Source files:** this doc summarizes state from across the repo; see the individual docs linked above for full detail.
