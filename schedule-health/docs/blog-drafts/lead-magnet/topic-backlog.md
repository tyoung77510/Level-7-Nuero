# Lead-magnet topic backlog

> **Status:** 🟡 Backlog — topics queued, none of the four below are built yet | **Purpose:** Candidate topics for the next gated PDF lead magnet(s), feeding the same pipeline the "5 Red Flags" checklist uses (`C7-lead-magnet-spec.md`, `POST /api/public/lead-magnet`, `LEAD_MAGNET_SLUGS`). | **Last Updated:** 2026-08-09

## Where this came from

Taj brought four topic ideas from a third-party keyword/opportunity tool ("PDF Trend Lab" — search volume + competition scoring, not sourced from this codebase). The open question was whether to build these as a paid standalone store or fold them into Ordo7's existing marketing. **Decision (see `08-DECISIONS.md`): fold into the existing free lead-magnet pipeline** — same email-gate mechanism as the live "5 Red Flags" checklist, same Founder Log/blog distribution, no new commerce/checkout build. Nothing here is a paid product.

## The four topics, assessed against what Ordo7 actually does

Per this doc's own governing spec (`C7-lead-magnet-spec.md`): no overclaiming, CTA only names checks the engine actually runs (`analyze.js`'s real checks — missing logic, negative float, hard constraints, out-of-sequence, invalid dates, high float, high duration — plus EVM/Earned Schedule). Two of the four have a real, honest tie-in to build a CTA around; two don't, and are flagged rather than forced.

| Topic | Audience (from the tool) | Search vol. | Real Ordo7 tie-in? | Assessment |
|---|---|---|---|---|
| **Project Controls Risk Assessment Cheat Sheet** — "identifying cost and schedule volatility in real-time" | Project controls analysts | ~1,800/mo | **Yes** | Schedule volatility maps directly to the real issue-detection checks (negative float, missing logic, out-of-sequence); cost volatility maps to real EVM (CPI/CV). Same audience as Ordo7's actual ICP. **Strongest candidate to build first.** |
| **Cost Reporting Dashboard Design Guide** — "optimizing visual clarity for stakeholder decision making" | Project controls managers | ~1,500/mo | **Yes** | Maps to the real Earned Value tracking feature and the real printable status report — both live, both genuinely automate part of what this guide would teach manually. **Second candidate.** |
| **Resource Loading and Leveling Made Simple** | Construction schedulers | ~2,100/mo | **No** | Ordo7 has no resource-loading or resource-leveling engine — not in `analyze.js`, not in the product capabilities list in `brand-narrative.md`. Building this as-is would mean either a CTA that overclaims a feature that doesn't exist, or a purely educational PDF with no natural product tie-in at all. **Founder call needed**: build it anyway as pure top-of-funnel content (no CTA claim, just brand awareness + email capture), or skip it since it doesn't lead anywhere real. |
| **Document Control Fundamentals for Engineers** | Document controllers, project administrators | ~900/mo | **No** | Ordo7 is schedule-health, not document control/EDMS — no real feature to point the CTA at. The audience itself (document controllers, project admins) is also a step outside Ordo7's actual ICP (schedulers/project controls, not document control). **Weakest fit of the four** — lowest search volume too. Recommend deprioritizing unless Taj sees an angle I'm missing. |

## Suggested order, pending Taj's confirmation

1. **Project Controls Risk Assessment Cheat Sheet** — real tie-in, right audience, highest opportunity score of the two that fit.
2. **Cost Reporting Dashboard Design Guide** — real tie-in (EVM), right audience.
3. **Resource Loading and Leveling** — only if Taj wants pure top-of-funnel content with no product CTA.
4. **Document Control Fundamentals** — deprioritized; smallest volume, weakest audience/product fit.

## What building one actually involves (per the existing pattern)

Same shape as the live "5 Red Flags" checklist: a one-page HTML + rendered PDF, a matching blog post it's gated behind (new post, or attached to an existing one), the same form fields (`email` required, `role` required, `name`/`company` optional per `C7-lead-magnet-spec.md`), added to `LEAD_MAGNET_SLUGS` in `server.js`, and — per this doc's own discipline — an explicit engine-accuracy note in the build spec if the CTA claims any automated coverage, same as flag 5 was called out in the original spec.

> **Source:** decision logged in `08-DECISIONS.md` (2026-08-09). Companion spec: `C7-lead-magnet-spec.md`.
