> **Status:** ⚫ SUPERSEDED — resolved on `main` by commit `1aae164` ("Correct DCMA coverage claim sitewide, P-0"), which standardized on **"DCMA-style schedule checks"** and states **6 of 14** checks automated (Logic, Hard Constraints, High Float, Negative Float, High Duration, Invalid Dates, plus out-of-sequence). That sitewide fix is canonical; the "DCMA-based" wording proposed below was not adopted. Kept for history. | **Purpose:** (historical) Honest-coverage corrections for site copy claiming broader DCMA coverage than the engine delivers | **Last Updated:** 2026-07-22

# DCMA "14-point coverage" copy — correction proposal

**Context.** The blog content audit (PR #55) verified `backend/src/analyze.js` against the DCMA 14-point standard: Ordo7 **automates 5 of the 14 checks** (Logic #1, Hard Constraints #5, High Float #6, Negative Float #7, High Duration #8) plus an XER-only out-of-sequence signal. Several site-copy locations imply the full 14 are run. This proposal corrects only the copy that actually overclaims, and flags the rest as fine.

**Honest umbrella phrasing used below:** "DCMA-based schedule-health checks" — matches how `schedule-health/CLAUDE.md` already describes the product ("runs DCMA-style schedule-health checks") and keeps the marketing weight without the false full-coverage claim. Nothing here touches pricing numbers or tiers.

**No live files changed by this proposal.** Approve the replacements and I'll apply them.

---

## A. Correct these — they overclaim (5 locations)

### A1 — Pricing banner (public, highest visibility) — *you flagged this one already*
`backend/public/index.html:871`

- **Current:** `The DCMA 14-point check is included on every plan, including Free — not a paid add-on.`
- **Proposed:** `DCMA-based schedule-health checks are included on every plan, including Free — not a paid add-on.`
- **Why:** "The DCMA 14-point check" reads as all 14 automated. Keeps the punch (included on every plan, not an add-on); drops the false coverage claim. Align with whatever correction is already in flight so we don't collide.

### A2 — Upload ring subtitle (public marketing)
`backend/public/index.html:1034`

- **Current:** `Benchmarked against your baseline &amp; the DCMA 14-point check.`
- **Proposed:** `Benchmarked against your baseline &amp; DCMA-based schedule-health checks.`
- **Why:** "the DCMA 14-point check" implies the score reflects all 14; it reflects the 5 we run.

### A3 — Post-analysis subtitle (public, JS string)
`backend/public/index.html:3517`

- **Current:** `subEl.textContent = 'Last analysis: ' + mostRecent.name + ' — benchmarked against the DCMA 14-point check.';`
- **Proposed:** `subEl.textContent = 'Last analysis: ' + mostRecent.name + ' — benchmarked against DCMA-based schedule-health checks.';`
- **Why:** same claim as A2; keep the two consistent.

### A4 — Feature registry (admin/internal, but user-visible in entitlements)
`backend/src/db.js:271`

- **Current:** `{ id: 'dcma-14-check', name: 'DCMA 14-Point Check', description: 'Federal schedule-quality issue detection — the core scoring engine for every new analysis.' }`
- **Proposed:** `{ id: 'dcma-14-check', name: 'DCMA-Based Schedule Checks', description: 'Automated detection across the DCMA checks Ordo7 implements (logic, constraints, float, durations) — the core scoring engine for every new analysis.' }`
- **Why:** Keep the `id` (`dcma-14-check`) untouched to avoid breaking feature wiring; correct the display name + description only.

### A5 — Feature descriptor (admin)
`backend/public/admin.html:578`

- **Current:** `'dcma-14-check': { name: 'DCMA 14-Point Check', desc: 'Federal schedule-quality assessment suite. Gates all new uploads.' }`
- **Proposed:** `'dcma-14-check': { name: 'DCMA-Based Schedule Checks', desc: 'Automated DCMA-based schedule-quality checks (logic, constraints, float, durations). Runs on every new upload.' }`
- **Why:** "assessment suite … Gates all new uploads" reads as a full 14-point gate. Keep the internal `id` key.

---

## B. Leave as-is — accurate, or not a coverage claim (do NOT edit)

| Location | Text | Why it's fine |
|---|---|---|
| `blog-content.js:156` | "High-duration activities are flagged automatically against the DCMA 14-point threshold." | **Accurate.** High Duration is one of the 5 checks we DO run, flagged automatically at the >44-day threshold. Check-specific and true. |
| `blog-content.js:41` | "…walking through the DCMA's 14-point schedule assessment, one check at a time…" | Describes the blog **series' editorial intent**, not product coverage. Accurate as a plan. |
| `index.html:2575` | Suggested AI question: "What's the DCMA 14-point check?" | A prompt the user can ask, not a claim about what Ordo7 runs. |
| `ai.js:110` | Lists "DCMA 14-point checks" as a topic the AI can discuss | Accurate — the assistant can explain the standard. Not a coverage claim. |
| `README.md:7` | "Schedule quality checks (DCMA 14-point, EVM metrics) live in expensive, clunky tools…" | Describes the **market/problem**, not Ordo7's coverage. Accurate. |

---

## C. Related (tracked elsewhere, not part of this copy pass)

- **Engine fixes** — the Logic and Hard Constraints checks that under-detect vs. the standard are filed as **Issue #56** for engineering. If those land and coverage widens, revisit whether some "5 of 14" phrasing above can be strengthened.
- **Blog drafts** — C1/C5 (PR #55) already describe current coverage honestly with explicit coverage notes.

> **Source files:** `backend/public/index.html`, `backend/src/db.js`, `backend/public/admin.html`, `backend/src/blog-content.js` (line numbers as of branch `claude/cresco-chat-session-ttyjol`). Verified against `backend/src/analyze.js`.
