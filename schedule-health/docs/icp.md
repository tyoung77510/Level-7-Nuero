# Ordo7 — Ideal Customer Profile (ICP)

> **Status:** 🟡 Draft — firmographics and personas are sourced from existing docs; several pain-point/fear fields are inferred from the founder's own experience, not yet validated against a real closed customer. See `gate-1-plan.md`'s own instruction: *"Re-check the ICP against reality. Who actually paid? If it's a narrower or different person than you targeted, that's the real ICP — rewrite this to match."* Treat this as the working draft that instruction points at, not a finished document. | **Last Updated:** 2026-08-06

This did not exist as a single document before now — the pieces were scattered across `gate-1-plan.md`, `brand-narrative.md`, and `gtm-action-log.md`. This assembles them into one place, in ICP-template form, and flags explicitly where a field is a real documented fact vs. a reasonable inference vs. genuinely unknown.

**One important correction this doc makes:** `04-SALES-MARKETING/target-clients.md`'s firmographic profile ($20M–$500M revenue, 50–1,000 employees) is **Level 7 Consulting's** ICP, not Ordo7's. `gate-1-plan.md` calls this out directly — Ordo7 sells to an individual practitioner, often self-serve on a credit card, not a $20M+ company buying a consulting engagement. Do not reuse that range here.

## Firmographics

| Attribute | Value | Confidence |
|---|---|---|
| **Company size** | Not yet validated. No confirmed range exists for Ordo7 specifically — the only number in this codebase ($20M–$500M) belongs to Level 7's consulting business and is explicitly flagged as the wrong target for Ordo7. What is real: Ordo7's self-serve tiers (Free/Pro) target an *individual* buyer regardless of employer size; the Teams tier and the K-12 vertical (below) imply mid-size-to-large organizations, but no lower/upper bound has been set or tested. | **Unknown — needs Taj's input or a real cohort of paying customers to derive** |
| **Location** | United States, primary. Inferred from every GTM target researched to date (AGC chapter events, U.S.-based consultants and firms) and Level 7's own stated U.S.-primary/Canada-secondary geography — no explicit written decision for Ordo7 specifically excludes other countries. | **Inferred** |
| **Industries** | Construction, oil & gas, aerospace & defense, infrastructure, utilities, manufacturing, pharmaceutical, and education (K-12 capital/bond programs) — the same industries Taj has direct hands-on experience in, per `brand-narrative.md`'s founder background. | **Confirmed** (`brand-narrative.md`) |
| **Tools they use today** | Primavera P6 (primary), MS Project, and CSV/Excel exports — the three formats Ordo7 parses. The private `ordo7-competitive-intel` target-list CSV (704 companies) is matched on "project controls / cpm scheduling" keywords, implying P6/CPM-scheduling usage is a real screening criterion there, though that repo isn't attached to this session to confirm its exact filters. | **Confirmed** (product's supported formats) / **Partially confirmed** (private list's exact methodology not verified here) |

## Buyer Personas

Ordo7 has **two distinct buying motions**, not one — worth keeping separate rather than blending into a single persona:

### 1. The practitioner (primary, self-serve)
**Who has the authority to buy:** the practitioner themselves — a project controls analyst, scheduler, or PM who can put Free/Pro on a personal or team card with no procurement cycle. This is the audience the GTM outreach log and Apollo target list are built around.

**Draft one-sentence ICP** (from `gate-1-plan.md`, proposed but not yet tested against real paying customers): *"A project controls lead at an EPC firm who reports schedule status to an owner every month and dreads the ones that are slipping."*

**Who has influence but not budget:** a PM who feels the pain daily (per "the spark" thesis below) but, at a larger org, may not hold the card/procurement authority themselves — they'd need to expense it or get a Teams seat assigned.

### 2. The K-12 bond program buyer (secondary, distinct vertical)
**Who has the authority to buy:** district-level decision-makers — **superintendents, facilities directors, bond program directors** — managing voter-approved bond dollars for campus modernization. A procurement-driven motion, not self-serve, and a different persona from the practitioner above. Credibility-backed: Taj personally delivered a $50M multi-site school modernization program 12% under budget and ahead of schedule (`brand-narrative.md`).

## Pain Points & Desires

**What keeps them up at night:** Being caught flat-footed reporting schedule status to an owner/client — finding out a schedule has slipped at the same moment the client does, instead of before. This is the real, documented "why now" behind Ordo7 (`brand-narrative.md`'s "spark" section): a construction/data-center/manufacturing capital boom has outpaced project-controls staffing, so the slack — schedule maintenance, cost tracking — lands on PMs who weren't hired to do it and don't have a dedicated analyst's tools or time.

**Their main goals:** Get real schedule-health visibility without needing Primavera-analyst-level expertise, a new headcount, or a procurement cycle. Hand in a clean, defensible status report without building it by hand every cycle (the product's own design notes call the printable status report one of the highest-leverage features for exactly this reason).

**Their fears:** Missing something in a 400-line P6 export that only becomes obvious once it's already caused a delay. Being personally on the hook for a schedule slip that traces back to a logic or constraint problem they didn't have time to manually audit.

**What they are suspicious of:** *(Inferred from Ordo7's own product decisions, not a documented customer quote — flagging as inference, not fact.)* Handing a real, sensitive project schedule to an unproven vendor before knowing if the tool is even worth it — this is the direct reasoning behind building the free, no-signup public checker (`/check`), which parses in memory and stores nothing. Also plausibly suspicious of "enterprise AI" pitches that require a sales call before they can see the product work at all.

**Who they see as an enemy:** *(Same inference caveat.)* Not a specific competitor by name to the buyer, but the pattern Ordo7's own positioning argues against: well-funded, enterprise-priced tools that gate a genuinely useful feature (like AI chat with your schedule) behind procurement and a sales cycle, per the "Ask Ordo vs. the market" contrast already documented. The practitioner's real day-to-day enemy is more likely the structural staffing gap itself — being asked to do a project-controls analyst's job on top of their own.

## What's still missing

- No field above has been validated against a real, closed, *paying* Ordo7 customer yet — `gate-1-plan.md`'s own exit check (12–15 discovery calls, ≥5 ICP prospects activated, 1–3 paying) is the mechanism meant to correct this doc once real data exists.
- The fear/suspicion/enemy fields are reasoned from the product's own build decisions and the founder's direct experience, not from a customer's own words — worth revisiting once real sales-call notes or feedback-button submissions (the in-app feedback mechanism, wired to Knock) accumulate.
- No firm company-size range exists for Ordo7 specifically; don't borrow Level 7's $20M–$500M figure for Ordo7 messaging or targeting.

> **Source files:** `schedule-health/docs/gate-1-plan.md`, `schedule-health/docs/brand-narrative.md`, `schedule-health/docs/gtm-action-log.md`, `04-SALES-MARKETING/target-clients.md` (for the explicit correction)
