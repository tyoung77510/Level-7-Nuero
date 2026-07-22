# Level 7 Consulting — Key Decisions Log
> **Purpose:** Track every significant decision, its rationale, who made it, and why.
> **Status:** ✅ Active | **Last Updated:** 2026-07-21

## Decision Log
| Date | Decision | Rationale | Made By | Status |
|------|----------|-----------|---------|:------:|
| 2026-07-05 | Business plan rev 4: $20M–$500M target, four-pillar model, fixed-fee pricing | Owner ratified initial structure | Team Lead + Owner | ✅ |
| 2026-07-05 | Website: level7dc.ctonew.app with level7data.com Cloudflare 301 redirect | Simplify hosting, keep branded domain | Team Lead | ✅ |
| 2026-07-05 | Email: admin@level7data.com via Google Workspace | Professional client comms | Owner | ✅ |
| 2026-07-06 | SOP framework: general SOPs (00X) + delivery SOPs (DP/PC/PM) | Separation of ops from methodology | Team Lead | ✅ |
| 2026-07-06 | Team: 7 agents covering all four pillars + sales + client mgmt | Full-spectrum delivery capability | Team Lead | ✅ |
| 2026-07-06 | Foundation Audit ($7,500) as flagship entry offering | ~70% conversion to implementation | Team Lead + Sales | ✅ |
| 2026-07-06 | Fixed-price consulting (no hourly billing) | Client preference; competitive advantage | Team Lead | ✅ |
| 2026-07-06 | Three-channel acquisition strategy | Diversified pipeline risk reduction | Sales Agent | ✅ |
| 2026-07-08 | Digital Brain at `/home/team/shared/digital-brain/` | Centralized AI-accessible knowledge | Data Agent | ✅ |
| 2026-07-10 | Digital Brain: Obsidian-compatible MOC structure + USER/SOUL/IDENTITY foundation | Owner requested AI OS Playbook compatibility | Data Agent | ✅ |
| 2026-07-11 | Adopted the Musk Algorithm (question → delete → simplify → accelerate → automate) as our standing method for building any system, SOP, or tool | Owner requested it as a build discipline, not a one-time fix | Owner | ✅ |
| 2026-07-11 | Deleted 00-INDEX.md; consolidated to a single navigation hub (00-MOC-MASTER.md) | Two entry points had already drifted out of sync (Step 1–2 of the Musk Algorithm: question the requirement, delete the redundant part) | Data Agent | ✅ |
| 2026-07-11 | Added README.md, LICENSE, .gitignore; standardized "Last Updated" metadata across all brain files | Repo had no GitHub-native orientation and no consistent freshness tracking — audit gap closed | Data Agent | ✅ |
| 2026-07-11 | Documented Knock (linked to cto.new) as notification infrastructure in tech-stack.md | Was connected but undocumented; workflows not yet built | Owner | ✅ |
| 2026-07-19 | Stripe activated via cto.new — live path to collect payment now exists | Business filings completed, unblocking payment processing | Owner | ✅ |
| 2026-07-21 | Launched "Ordo7 Cold Outreach — Tier 1 ICP" Apollo sequence — 15 verified project-controls/ops leaders enrolled, 2-step auto-email (Day 0 + Day 3 follow-up), sending from dedicated `outreach@ordo7.pro` mailbox on a Mon–Fri 8–5 (contact-local) business-hours schedule | First live cold-outreach motion for Ordo7; a dedicated sending domain isolates deliverability risk from the Level 7 `admin@level7data.com` inbox | Owner + Sales | ✅ |
| 2026-07-21 | Sourced & staged a blended Tier-2 batch — 20 verified contacts in two labeled A/B cohorts: `Ordo7 Tier-2 — Practitioners` (10 project-controls managers/schedulers/PMs at E&C firms) and `Ordo7 Tier-2 — Adjacent-Vertical Buyers` (10 Director-Controls/VP-Ops/COO leaders in aerospace & defense, oil & gas, utilities). Built **two persona-tailored 2-step sequences** (one per cohort), enrolled each cohort into its own, and **activated both** (10 active contacts each, sending from `outreach@ordo7.pro` on the business-hours schedule) | Owner chose a blended batch to compare which dataset drives more replies, and opted for two tailored sequences (practitioner "one upload → what's wrong" vs. buyer "visibility without headcount") over one same-copy sequence — better fit per persona, native per-sequence reply stats | Owner + Sales | ✅ |

## Open Action Items
| Item | Why It Matters | Owner Action Needed |
|------|-----------------|----------------------|
| Digital Brain ↔ shared filesystem sync | This repo mirrors `/home/team/shared/digital-brain/` but nothing enforces they stay in sync | Decide: GitHub becomes canonical, or set up a scheduled sync |
| DocuSign SOW template | Draft SOW built; needs signature/date tabs placed in DocuSign's template editor | Owner walks through tab placement with Claude |
| Ordo7 Tier-2 A/B — read the result | Two tailored sequences live 2026-07-21 (Practitioners vs. Adjacent-Vertical Buyers), 10 contacts each | After the Day-0/Day-3 cycle, compare per-sequence reply rates to decide which dataset to scale |
| Ordo7 Tier-1 sequence — monitor | Tier-1 sequence (15 contacts) went live 2026-07-21 | Watch open/reply rates over the first Day-0/Day-3 cycle |
| Level 7 outreach — 8 remaining contacts | EnPro, Franklin Electric, Rogers, Watts Water, Archrock, HNTB, CDM Smith, Valmont still need enrichment/verified emails | Run apollo_people_bulk_match once ready |
| Mobbin design reference tool | Connected, but every search (screens/flows/sections) is gated behind a paid plan — useful for benchmarking Ordo7's UI (upload flow, health-score visualization) against real app patterns | Upgrade at mobbin.com/pricing if worth the cost |

## Decision Principles
1. **Default to documented** — If not written down, it didn't happen
2. **Default to shared** — All decisions visible to full team
3. **Default to reversible** — If reversible, decide fast; if not, deliberate
4. **Default to the client** — When in doubt, serve the client better

## Obsidian Cross-References
- [[SOUL.md]] — Decisions guided by core values
- [[USER.md]] — Owner's decision-making style
- [[00-MOC-MASTER.md]] — Every MOC connects here
- [[01-STRATEGY/business-plan.md]] — Strategic decisions
- [[07-INFRASTRUCTURE/tech-stack.md]] — Infrastructure decisions