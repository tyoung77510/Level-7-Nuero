# Founder Log — posting log

> **Status:** ✅ Active | **Purpose:** Source of truth for which Founder Log day was actually posted, when, and where. The daily posting Routine reads this file first on every run to find the next day to post. | **Last Updated:** 2026-07-25

**Rule for the Routine:** never re-post a day already listed below. Find the lowest-numbered day in `../../docs/founder-log-calendar.md` that is NOT listed here, and is not a Slot A/F day lacking real content (see that doc's fabrication rule) — post that one. If the lowest unposted day is a Slot A/F day with nothing real yet, skip it (leave it out of this log, do not fabricate) and post the next eligible day instead; come back to the skipped one later once real content exists, out of order if necessary.

| Day | Slot | Posted (date) | Personal | Ordo7 Page | Level 7 Page | Blog |
|---|---|---|---|---|---|---|
| 001 | A | prior session (exact date not recorded) | — | — | — | — |
| 002 | B | prior session (exact date not recorded) | — | — | — | — |
| 003 | C | 2026-07-20 | [post](https://www.linkedin.com/feed/update/urn:li:share:7484826077920534528/) | [post](https://www.linkedin.com/feed/update/urn:li:share:7484826137731170305/) | [post](https://www.linkedin.com/feed/update/urn:li:share:7484826216848326656/) | [missing-predecessors-successors-p6-dcma-check-1](https://www.ordo7.pro/blog/missing-predecessors-successors-p6-dcma-check-1) |
| 004 | D | 2026-07-23 | posted (manual) | posted (manual) | manual — confirm | [utility-maintenance-schedule-discipline-safety](https://www.ordo7.pro/blog/utility-maintenance-schedule-discipline-safety) |
| 005 | E | 2026-07-23 | [post](https://www.linkedin.com/feed/update/urn:li:share:7485539708526043136/) | [post](https://www.linkedin.com/feed/update/urn:li:share:7485852876817465344/) | [post](https://www.linkedin.com/feed/update/urn:li:share:7485853178370998272/) | [eight-years-in-project-controls](https://www.ordo7.pro/blog/eight-years-in-project-controls) |
| 007 | G | 2026-07-23 | [post](https://www.linkedin.com/feed/update/urn:li:share:7486202248197328896/) | manual — confirm | [post](https://www.linkedin.com/feed/update/urn:li:share:7486202192505352193/) | [building-ordo7-in-public](https://www.ordo7.pro/blog/building-ordo7-in-public) |
| 009 | B | 2026-07-23 | [post](https://www.linkedin.com/feed/update/urn:li:share:7485859648705560577/) | manual — confirm | manual — confirm | [project-controls-staffing-shortage](https://www.ordo7.pro/blog/project-controls-staffing-shortage) |
| 010 | C | 2026-07-25 | [post](https://www.linkedin.com/feed/update/urn:li:share:7486817457622425600/) | [post](https://www.linkedin.com/feed/update/urn:li:share:7486818319233384448/) | [post](https://www.linkedin.com/feed/update/urn:li:share:7486818448639963136/) | [leads-negative-lag-p6-dcma-check-2](https://www.ordo7.pro/blog/leads-negative-lag-p6-dcma-check-2) |

**Next up: Day 011** — Day 010 posted 2026-07-25 to all three surfaces via the **link-card** method (the deterministic fix — native company posts kept failing LinkedIn's union-type error; link-cards posted first-try on all three). 006 (Slot F) and 008 (Slot A) remain skipped, no real content yet; Days 011–012 are pre-drafted below and ready to fire. **The 035 timely insert is on hold** — its caption cites unsourced third-party statistics (work-order B3); do not post it until those numbers are sourced or cut. Graphics rendered in `../renders/`; blog posts live in production.

**Days 010–012 pre-drafted (batch-04, 2026-07-25) — ready content, no live drafting needed at fire time.** Cresco pre-drafted all three so the Routine can just post from what's already committed:

| Day | Slot | Topic | Blog slug | Deployed images (`backend/public/brand/`) |
|---|---|---|---|---|
| 010 | C | Leads — negative lag, DCMA Check 2 | [leads-negative-lag-p6-dcma-check-2](https://www.ordo7.pro/blog/leads-negative-lag-p6-dcma-check-2) | `leads-negative-lag-p6-dcma-check-2-feed-1200x1500.jpg` / `-cover.jpg` |
| 011 | D | Manufacturing's capital boom, seen from the inside | [manufacturing-capital-boom-project-controls](https://www.ordo7.pro/blog/manufacturing-capital-boom-project-controls) | `manufacturing-capital-boom-project-controls-feed-1200x1500.jpg` / `-cover.jpg` |
| 012 | E | 17% baseline accuracy on a $1M–$25M energy portfolio | [schedule-baseline-accuracy-energy-portfolio](https://www.ordo7.pro/blog/schedule-baseline-accuracy-energy-portfolio) | `schedule-baseline-accuracy-energy-portfolio-feed-1200x1500.jpg` / `-cover.jpg` |

LinkedIn captions: `batch-04-linkedin-captions.md`. Render source data: `render/batch-04-data.json`. All three blog entries verified locally (200 on `/blog/<slug>` and on both image paths under `/brand/`, isolated `DATA_DIR`/port, server killed after). Day 010 is deliberately educational-only — Ordo7's engine does not automate a Leads check (verified against `backend/src/analyze.js`), so neither the blog post nor the caption claims Ordo7 detects leads automatically. Day 012's 17% figure is quoted to `docs/brand-narrative.md`'s confirmed track record, verbatim, no embellishment, no client name. **Day 010 is now posted (row above); Days 011 & 012 remain ready to fire via the link-card method.**

**Day 014 is no longer postable** — it was unpublished (competitor post, work-order B2); its blog page 301-redirects to `/blog`, so it must not be posted. Removed from the queue.

**Caption blog-links fixed (2026-07-23):** the B5 slug rename (numbered → descriptive slugs) left every `batch-0N` caption pointing at an old `/blog/founder-log-0NN-…` URL that now 301-redirects — which tripped the Routine's dead-blog-link stop and is why the 2026-07-23 run posted nothing. All caption blog links were updated to the current canonical slugs (verified 200). Any new caption must use the live descriptive slug from `backend/src/blog-content.js`, not a numbered one.

**Company-page posting — FIXED (2026-07-25), use link-cards.** The native-image Zapier company-page path was failing with LinkedIn's `DataMap should have no more than one entry for a union type` error (caption URLs unfurl as an article AND the native image attaches → two entries in one union → rejected). **The deterministic fix is to post company updates as link-cards** (`image_type: preview_thumbnail`, `submitted_url` = blog URL, `image` = ordo7.pro cover, `allow_reserved_characters: false`) — a single article entity, no conflict. Proven first-try on all three surfaces for Day 010. See the SOP's "LinkedIn surfaces, IDs, and format" section. Earlier manual gaps (Day 004 Level 7; Day 007 Ordo7; Day 009 Ordo7 + Level 7) are logged as posted so the Routine advances rather than re-posting; cells marked "manual — confirm" are where a URL wasn't captured.

**Skipped, live-only, no real content yet — do not fabricate:** 006 (Slot F, user feedback), 008 (Slot A, build log). Post these out of order whenever real material exists; until then the Routine skips past them.
