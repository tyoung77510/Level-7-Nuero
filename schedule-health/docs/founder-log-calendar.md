# Founder Log — 90-day content calendar

> **Status:** 🟡 Active build-out | **Purpose:** One distinct, on-topic post per day for 90 days, posted identically to LinkedIn and the ordo7.pro blog, with consistent Nocturne visuals throughout. | **Last Updated:** 2026-07-20

Companion to `brand-narrative.md`, which holds the locked voice rules and the "don't fabricate" standard this calendar is built to honor. This doc is the day-by-day topic bank; `render/` (in `marketing-assets/linkedin-founder-log/`) is the graphic pipeline; `backend/src/blog-content.js` is where the matching blog post for each day gets appended.

**Changelog (2026-07-20):** swapped two Slot G days to cover real product capabilities the market hasn't heard about yet, per `brand-narrative.md`'s new "Product capabilities" section — Day 014 (was "audience before ask," now redundant with Day 044's near-identical angle) → **Ask Ordo spotlight**, timely because a well-funded competitor just validated the same feature category; Day 077 (was "scope cuts") → **what-if sandbox spotlight**. Reserved, not yet assigned a day: **Portfolio Overview / Multi-Project Leaderboard**, **printable status report**, **Team seats**, **shareable snapshot links** — all real, all currently undocumented in any Founder Log content. These don't have a natural home in the current 7-slot wheel without displacing more reflective/meta topics than is worth it in one pass — flag for a decision on where they go (a short feature-spotlight sub-series, or folded into the next 90-day cycle) rather than cramming them in unilaterally.

## The structure: a 7-slot weekly wheel

Every day maps to one of 7 recurring content categories, so the calendar has rhythm (same 7 categories every week — the "consistent theme, feel") while every single day covers a different specific topic (the "different topic every day"). Slot assignment is just `(day number − 1) mod 7`:

| Slot | Category | What it is | Source material |
|---|---|---|---|
| **A** | Build Log | What actually happened in the build this week | Live/current — real milestones only |
| **B** | Spark / Market Thesis | Why now — the boom, the labor shortage, the migration parallel | `brand-narrative.md` → "The spark" |
| **C** | Educational (DCMA-14) | One schedule-health concept per post, plain-language | The real DCMA 14-point assessment |
| **D** | Industry Pain Point | A specific industry's scheduling reality | `brand-narrative.md` → Founder background (5 industries) |
| **E** | Founder Story | A real, quantified anchor from Taj's track record | `brand-narrative.md` → confirmed track record |
| **F** | User Feedback / Community | A real user comment or request, anonymized | Live/current — real quotes only, never fabricated |
| **G** | Reflective / Meta | Why build in public, who this is for, how the product thinks | Voice + product philosophy |

**Hard rule for Slots A and F:** these are the two "live" categories. Never pre-write a specific milestone or quote that hasn't happened yet. If a given week has nothing real to report, that day's post either slips to the next real event or runs a category-appropriate placeholder ("still heads-down on X — more next week") rather than inventing content. This is the same standard the product holds itself to in `design-notes.md` ("don't fabricate metrics") — the brand doesn't get a pass the product doesn't get.

Portrait side alternates strictly left/right by day (odd = left, even = right) for visual rhythm, matching Founder Log 001/002.

## Slot C — the real DCMA 14-point checklist

This calendar runs the actual, industry-standard DCMA 14-point schedule health assessment as a 14-part educational series (13 fit inside these 90 days; the 14th — Baseline Execution Index — opens the *next* 90-day cycle, so the series completes rather than being cut short):

1. Logic 2. Leads 3. Lags 4. Relationship Types 5. Hard Constraints 6. High Float 7. Negative Float 8. High Duration 9. Invalid Dates 10. Resources 11. Missed Tasks 12. Critical Path Test 13. Critical Path Length Index (CPLI) 14. Baseline Execution Index (BEI) — *Day 91*

## The 90 days

Days 001–002 are already published (see `../marketing-assets/linkedin-founder-log/`). Everything below is the topic/angle for each remaining day — not final copy. Full copy + rendered graphics get drafted in batches (see "Drafting batches" below); writing all 90 in full now would front-load content past the point the live slots (A/F) can actually stay honest.

| Day | Slot | Topic |
|---|---|---|
| 001 ✅ | A | *Published.* Invite: "Scheduling's been broken for years. I decided to fix it." |
| 002 ✅ | B | *Published.* PMs are doing two jobs — Ordo7 takes one back |
| 003 | C | Logic — every activity needs a predecessor and a successor |
| 004 | D | Utility maintenance programs — why safety adherence and schedule discipline go together |
| 005 | E | Why I got into project controls, and what 8+ years and a PMP actually taught me |
| 006 | F | *Placeholder — real user comment/request, anonymized. Do not write until true.* |
| 007 | G | Why I'm building this in public — no big team, no permission, just the work |
| 008 | A | *Placeholder — real build milestone from the week.* |
| 009 | B | The staffing shortage — demand for controls talent is outpacing supply |
| 010 | C | Leads — why negative lag quietly breaks your logic |
| 011 | D | Manufacturing's capital boom, seen from the inside — project controls stretched thin |
| 012 | E | Improved schedule baseline accuracy 17% on a $1M–$25M energy portfolio — what that took |
| 013 | F | *Placeholder — real user comment/request, anonymized.* |
| 014 | G | A well-funded competitor just shipped "chat with your schedule." Ordo7's had it since day one — Ask Ordo spotlight |
| 015 | A | *Placeholder — real build milestone from the week.* |
| 016 | B | The CA→TX/AZ migration, and why infrastructure can't keep up — the org-capacity parallel |
| 017 | C | Lags — when "wait time" hides schedule risk |
| 018 | D | Pharma capital projects — why validation milestones leave zero slack |
| 019 | E | Ran $35M+ in monthly forecasting cycles, cut cost variance 12% — the discipline behind that |
| 020 | F | *Placeholder — real user comment/request, anonymized.* |
| 021 | G | Who Ordo7 is actually for — superintendents, facilities directors, bond program directors |
| 022 | A | *Placeholder — real build milestone from the week.* |
| 023 | B | The data-center and manufacturing capital boom driving the demand spike |
| 024 | C | Relationship Types — why Finish-to-Start should dominate your network |
| 025 | D | Oil & gas turnaround planning — 18% schedule-deviation reduction through EVM |
| 026 | E | 11% performance improvement across a 15-project energy portfolio through variance analysis |
| 027 | F | *Placeholder — real user comment/request, anonymized.* |
| 028 | G | Why plain language is a design principle here, not a compromise |
| 029 | A | *Placeholder — real build milestone from the week.* |
| 030 | B | "The tool that didn't exist" — I've built this kind of tool before, by hand |
| 031 | C | Hard Constraints — how "must finish by" dates override the schedule's own logic |
| 032 | D | K-12 bond programs — delivering a $50M modernization 12% under budget, ahead of schedule |
| 033 | E | The Excel tool I built from scratch before Ordo7 existed — same instinct, earlier problem |
| 034 | F | *Placeholder — real user comment/request, anonymized.* |
| 035 | G | Why Ordo7 doesn't fabricate a metric it can't actually compute |
| 036 | A | *Placeholder — real build milestone from the week.* |
| 037 | B | Why plain language beats a 35-metric dashboard nobody has time to read |
| 038 | C | High Float — the tasks nobody's watching because they look safe |
| 039 | D | Utility programs and the compliance clock — why maintenance schedules don't get extensions |
| 040 | E | Delivering a $50M K-12 modernization program 12% under budget, ahead of schedule |
| 041 | F | *Placeholder — real user comment/request, anonymized.* |
| 042 | G | The feedback loop is already built in — why this product won't ship-and-freeze |
| 043 | A | *Placeholder — real build milestone from the week.* |
| 044 | B | "Follow the journey," not "buy now" — why the ask right now is attention, not a sale |
| 045 | C | Negative Float — the clearest signal your schedule is already broken |
| 046 | D | Why manufacturing schedules break first when demand spikes faster than staffing |
| 047 | E | A 9% reduction in safety incidents on a water utility program — discipline as safety |
| 048 | F | *Placeholder — real user comment/request, anonymized.* |
| 049 | G | Why "zero setup, one upload" was the bar from day one |
| 050 | A | *Placeholder — real build milestone from the week.* |
| 051 | B | A dedicated analyst shouldn't be a luxury — what Ordo7 stands in for |
| 052 | C | High Duration — why a 44-day activity is a planning shortcut, not a plan |
| 053 | D | Pharma's other constraint — coordinating capital work around production/validation windows |
| 054 | E | 18% reduction in schedule deviation on an oil & gas turnaround using EVM |
| 055 | F | *Placeholder — real user comment/request, anonymized.* |
| 056 | G | Why I picked a boring, zero-dependency stack on purpose |
| 057 | A | *Placeholder — real build milestone from the week.* |
| 058 | B | The gap between "the schedule says green" and what's actually happening on site |
| 059 | C | Invalid Dates — actual vs. planned dates that don't make sense together |
| 060 | D | Turnarounds are the least forgiving schedule in any industry — why |
| 061 | E | A 15% cost reduction through supplier contract negotiations — controls beyond the schedule |
| 062 | F | *Placeholder — real user comment/request, anonymized.* |
| 063 | G | What "evolving, not static" has looked like these past weeks |
| 064 | A | *Placeholder — real build milestone from the week.* |
| 065 | B | Why this problem isn't new — it's just gotten louder as project volume climbs |
| 066 | C | Unassigned Resources — a task with no owner isn't a real task |
| 067 | D | K-12 bond programs — >95% schedule adherence, 30% fewer year-end budget lapses |
| 068 | E | Why I went back to finish a degree in Construction Management while already doing the work |
| 069 | F | *Placeholder — real user comment/request, anonymized.* |
| 070 | G | Why the score is shown with its logic, not as a black-box number |
| 071 | A | *Placeholder — real build milestone from the week.* |
| 072 | B | What happens to a project when nobody's watching the schedule full-time |
| 073 | C | Missed Tasks — what a blown baseline finish date is actually telling you |
| 074 | D | What a utility maintenance backlog actually costs, beyond the obvious |
| 075 | E | What a 4:45pm status-meeting scramble actually looks like — and why it keeps happening |
| 076 | F | *Placeholder — real user comment/request, anonymized.* |
| 077 | G | The what-if sandbox — test a schedule fix before you commit to it |
| 078 | A | *Placeholder — real build milestone from the week.* |
| 079 | B | Building for the person who inherited the controls job, not chose it |
| 080 | C | The Critical Path Test — does your "critical" path actually drive the finish date? |
| 081 | D | Manufacturing capital projects and the hidden cost of an under-resourced controls function |
| 082 | E | $100M+ in portfolios, five industries — what stayed the same everywhere I worked |
| 083 | F | *Placeholder — real user comment/request, anonymized.* |
| 084 | G | Two weeks from spark to launch-ready — what that pace cost, and what it didn't |
| 085 | A | *Placeholder — real build milestone from the week.* |
| 086 | B | The real cost of "we'll catch up on the schedule next week" |
| 087 | C | Critical Path Length Index (CPLI) — how much float cushion is really left |
| 088 | D | Why a pharma delay is never "just" a schedule problem |
| 089 | E | Why "the tool wasn't good enough" has been the pattern of my whole career, not just this once |
| 090 | F | *Placeholder — real user comment/request, anonymized. Closes the first 90 days on the community that's been following along.* |

## Drafting batches

Full copy + rendered graphics get produced in small batches, not all 90 at once — this keeps Slots A and F honest (nothing gets written before it's true) and keeps quality consistent (each batch gets reviewed against voice guidelines before it ships). First batch: Days 003–009 (closes out the rest of week one). See `../marketing-assets/linkedin-founder-log/render/` for the pipeline that turns a finished batch into graphics.

## Obsidian / cross-references

- [[brand-narrative.md]] — voice rules, locked copy, the "don't fabricate" standard this calendar follows
- [[../marketing-assets/README.md]] — asset inventory
- [[../marketing-assets/linkedin-founder-log/render/README.md]] — render pipeline usage
