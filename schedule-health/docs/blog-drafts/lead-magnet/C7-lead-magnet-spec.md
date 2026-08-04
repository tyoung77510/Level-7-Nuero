> **Status:** ✅ Built and wired, 2026-08-02 — see `docs/handoff.md` for the final decisions (which differ from this proposal on gate scope and required fields) and what's still unverified (live Knock delivery). | **Purpose:** Form fields, gating rules, backend/email implementation plan, and QC plan for the "5 Red Flags" lead magnet | **Last Updated:** 2026-08-02

# C7 Lead Magnet — implementation spec (NOT yet wired live)

This document is the founder-approval artifact required by the C7 work order. **Nothing described
here has been built or wired into `server.js`, `db.js`, or any live file.** It is a plan, written
against this codebase's actual conventions (`schedule-health/CLAUDE.md`), for what wiring it live
would look like once approved. The two companion files are the reviewable creative:

- `5-red-flags-checklist.html` — the one-page checklist, print-ready
- `5-red-flags-checklist.pdf` — the same, rendered (verified 1 page, see QC below)

Source content distilled from the live post `contractor-baseline-red-flags-checklist` in
`backend/src/blog-content.js` ("5 Red Flags to Check in a Contractor's Baseline Schedule").

---

## 1. The 5 flags, distilled (for reference — full copy is in the PDF)

| # | Flag | What to look for | Why it matters |
|---|---|---|---|
| 1 | Negative float that's already baked in | Any activity at negative total float on day one | Schedule is already behind before work starts — unrealistic plan, or a hard date fighting the logic |
| 2 | Hard constraints doing the logic's job | A stack of "Must Finish On"/"Start On" constraints | Dozens usually means the schedule can't hold its own dates without being pinned in place |
| 3 | Open ends and dangling activities | Activities with no predecessor and/or no successor | A delay to a dangling activity never ripples to the finish date — parts of the plan look "on track" while disconnected from it |
| 4 | Activities that run for months | Any activity >~44 working days with no interim milestones | Long unbroken durations hide slippage; you can't tell it's late until it already is |
| 5 | A critical path that doesn't make sense | Trace the critical path end to end — does it match how the job is actually built? | If the chain protecting your finish date doesn't match construction reality, the date is fiction |

No security/privacy/retention/data-handling/AI-processing claims appear anywhere in the checklist.
No competitor names. No unsourced statistics. No free-tier-underpricing framing. Verified by reading
the full rendered HTML/PDF before writing this spec.

**Engine-accuracy note (why the CTA is worded the way it is):** Per
`docs/dcma-14point-copy-corrections-PROPOSAL.md`, Ordo7's engine (`analyze.js`) automates 5 of the
DCMA's 14 checks — Logic, Hard Constraints, High Float, Negative Float, High Duration — with known
under-detection gaps on Logic and Hard Constraints tracked as **Issue #56**. Flags 1, 2, 3, and 4
above map directly to checks the engine actually runs today. Flag 5 (critical path) is not one of
the named 5 checks — the engine derives a `critical` flag from the same float<=0 calculation
(`analyze.js`), so Ordo7 can surface which activities sit on the critical path, but "does this path
tell a coherent construction story" is a judgment call, not a scored check. The PDF's CTA is
deliberately generic ("Ordo7 runs these checks automatically... no Primavera expertise required")
rather than claiming per-flag automated coverage, so it doesn't overclaim against the known gaps.
**If the founder wants a stronger, more specific CTA, it should name only flags 1/2/3/4 — not all 5 — to stay accurate.**

---

## 2. Form fields (proposed)

| Field | Type | Required | Validation |
|---|---|---|---|
| `email` | text/email | **Required** | Server-side: matches `auth.EMAIL_RE` (the same regex `/api/auth/signup` already uses) — reused, not reinvented. Needed to deliver the PDF at all. |
| `name` | text | Optional | Server-side: trimmed; no format constraint. Improves personalization of the delivery email but isn't a hard gate. |
| `company` | text | Optional | Server-side: trimmed; no format constraint. |
| `role` | text (dropdown recommended, not free text) | **Required** | Server-side: non-empty after trim, rejected with `400` if blank — **this is the field the work order calls out as most valuable, feeding buyer identification, and it must not be optional or client-only.** Suggest a fixed option list (e.g. `PM`, `Project Controls / Scheduler`, `Owner's Rep / Client-side`, `Executive`, `Other`) over free text, so the stored value is analyzable without cleanup — founder call. |
| `slug` (hidden field) | text | Required, set by the page not the user | Records which gated post the lead converted on — needed for "what's working" attribution later (Cresco's own reporting loop feeds on this). |

**Founder decision needed:** confirm `name`/`company` as optional (proposed above) vs. required —
the work order only mandates `role`.

---

## 3. Gating — which pages show the email-capture gate

**Gate goes on (named, specific):**
- `/blog/contractor-baseline-red-flags-checklist` (live today) — the "5 Red Flags" post this
  checklist is drawn from; highest-intent match for the lead magnet.
- The DCMA 14-point cornerstone, **once published** — currently an unpublished draft at
  `schedule-health/docs/blog-drafts/c1-dcma-14-point-check-guide.md` ("Blog draft C1... unpublished"
  per git history). Gate it the same day it goes live in `blog-content.js`, not before.
- `schedule-health/docs/blog-drafts/c6-reviewing-contractor-baseline.md` ("How to Review a
  Contractor's Baseline") — also unpublished, also baseline-review-adjacent. Same rule: gate on
  publish, not before.

**Gate does NOT go on:** Founder Log posts, `why-ordo7-never-fabricates-a-metric`,
`utility-maintenance-schedule-discipline-safety`, `eight-years-in-project-controls` — none of these
are baseline-review high-intent pages, and stacking a lead-gate on top of Founder Log's "follow the
journey, no hard sell" narrative voice (`docs/brand-narrative.md`) would break that format's own
rule against front-loading an ask.

**Plain newsletter signup — flagging a real discrepancy, not just confirming:**

The work order says "confirm the plain newsletter signup stays on Founder Log pages ONLY." Reading
the live code: the only newsletter form that currently exists (`server.js`, the `.newsletter-form`
block, "Schedule tips, twice a month") lives on the **general `/blog` index only**
(`serveBlogIndex`) — it does **not** currently appear on `/blog/founder-log`
(`serveFounderLogIndex`) or on individual post pages at all. It's also client-side-only right now
(`onsubmit` just swaps the button text to "Coming soon" — nothing is sent anywhere).

So there's a decision here, not just a confirmation:
- **Option A:** Leave the existing newsletter form where it is (general blog index) and simply
  never add it to gated high-intent posts — the new lead-magnet form is the only capture mechanism
  those posts get.
- **Option B:** Relocate the newsletter form to live on `/blog/founder-log` specifically (matching
  the work order's literal instruction), removing it from the general `/blog` index, so the two
  capture mechanisms are cleanly split by page type.

**This needs an explicit founder call before wiring — I did not move or edit the existing form,** since
that's a live-file change out of scope for this round.

---

## 4. Backend implementation plan (proposed — NOT executed)

### 4.1 Storage: new `leads` table

Per `schedule-health/CLAUDE.md`'s DB conventions, a brand-new table is created with
`CREATE TABLE IF NOT EXISTS` in `db.js` (future columns added after this table already exists in
production would need to go through `ensureColumn()`, same as every other table):

```sql
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  name TEXT,
  company TEXT,
  role TEXT NOT NULL,
  source_slug TEXT,
  pdf_sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

- `role TEXT NOT NULL` — enforced at the DB layer too, not just the route handler, so a future code
  path can't silently insert a lead without one.
- `pdf_sent_at` nullable — set only after the Knock call succeeds, so a lead row can exist even if
  the email momentarily fails (mirrors the non-blocking `knock.identifyUser(user).catch(() => {})`
  pattern already used in `/api/auth/signup` — a marketing-sync failure never blocks the user-facing
  action, and the same should hold here: capture the lead first, attempt delivery second, log
  failures rather than losing the lead).
- Deliberately **not** folded into the `users` table — leads convert pre-signup, off a public blog
  page with no session, and are a different entity than an authenticated Ordo7 account.

### 4.2 Endpoint

`POST /api/public/lead-magnet` — public, unauthenticated, modeled directly on the existing
`POST /api/public/consent` route (same "no user, no session" shape already in `server.js`):

```
route('POST', '/api/public/lead-magnet', async (req, res) => {
  if (rateLimited(res, 'lead-magnet', req, 5, 60 * 60 * 1000)) return; // abuse guard, same shape as signup's 5/hour
  const body = await readBody(req);
  let payload;
  try { payload = JSON.parse(body.toString('utf8')); } catch (e) { return sendJSON(res, 400, { error: 'Invalid JSON body' }); }
  const email = String(payload.email || '').trim().toLowerCase();
  const name = String(payload.name || '').trim();
  const company = String(payload.company || '').trim();
  const role = String(payload.role || '').trim();
  const slug = String(payload.slug || '').trim();
  if (!auth.EMAIL_RE.test(email)) return sendJSON(res, 400, { error: 'Enter a valid email address' });
  if (!role) return sendJSON(res, 400, { error: 'Select your role' }); // server-side gate — required, not optional
  const lead = store.createLead(email, name, company, role, slug);
  knock.sendLeadMagnetEmail(lead, LEAD_MAGNET_PDF_URL).catch(() => {}); // never block the response on email delivery
  sendJSON(res, 200, { ok: true });
});
```

- Ownership/authz note: this route has no session and stores no user-scoped resource, so the
  "every project-scoped query filtered by `user_id`" rule doesn't apply here directly — but any
  future **admin-facing** read of `leads` (e.g. `GET /api/admin/leads`) must follow the same
  `isAdmin(user)` re-check every other `/api/admin/*` route already does (`server.js` lines ~1227+).
- Rate limiting reuses the existing `rateLimited()` helper — same 5/hour-per-IP shape as
  `/api/auth/signup`, sized for a public unauthenticated form to deter scripted abuse.

### 4.3 PDF hosting

Static file at `backend/public/lead-magnets/5-red-flags-checklist.pdf` — served by the existing
static-file handler, no new route code needed (same pattern as `brand/` assets). Zero-dependency:
no S3/storage integration required.

### 4.4 Delivery email: `knock.js`

New function, same shape as every existing Knock integration in the file (`sendVerificationEmail`,
`sendPasswordResetEmail`, etc.) — gated behind its own workflow key so it degrades gracefully if
unconfigured, exactly like every other Knock path:

```
function leadMagnetConfigured() {
  return knockConfigured() && Boolean(process.env.KNOCK_LEAD_MAGNET_WORKFLOW_KEY);
}

async function sendLeadMagnetEmail(lead, pdfUrl) {
  if (!leadMagnetConfigured()) {
    console.warn(`[knock] Lead magnet email skipped (KNOCK_API_KEY or KNOCK_LEAD_MAGNET_WORKFLOW_KEY not set) for ${lead.email} — lead is still saved to the database`);
    return;
  }
  // POST to Knock workflow trigger, same shape as sendVerificationEmail — recipient: lead.email,
  // data: { name: lead.name, pdfUrl }. Build the `ordo7-lead-magnet` workflow + email template in
  // the Knock dashboard first (same as the existing verify-email workflow).
}
```

- New env var: `KNOCK_LEAD_MAGNET_WORKFLOW_KEY` (added to `.env.example`, degrades gracefully like
  every other integration per `CLAUDE.md`'s "don't add hard dependencies" rule).
- **Role is stored, not discarded** — it lands in the `leads.role` column on insert, independent of
  whether the email send succeeds. Nothing about the Knock call touches or requires the role value
  beyond what's needed to render the email (name is what personalizes the email, not role).

---

## 5. QC plan (mapped to the C7 work order's checks — run these at wire-up time, not now)

| # | Test | What "pass" looks like |
|---|---|---|
| 1 | End-to-end form submit with a real/test email address | PDF email arrives in the inbox via the configured Knock workflow; the link/attachment opens and is the same one-page PDF verified below. |
| 2 | Submit with `role` left blank | Server returns `400` and the specific "Select your role" (or equivalent) error; **no row is written to `leads`** — confirms the gate is server-side, not just a disabled submit button. |
| 3 | Submit with a valid role | Row lands in `leads` with the exact role value stored (query the table directly, or via a future admin view) — confirms role is captured, not silently dropped anywhere in the request path. |
| 4 | Open the PDF on a phone (real device or mobile emulation) | Body text is legible without pinch-zoom. Flagged explicitly because the checklist uses ~10.5px print-scale type deliberately sized for a one-page Letter layout — that needs a real mobile-view check before shipping, not an assumption that print-size type reads fine on a phone screen. |

None of these have been run yet — this table is the test plan to execute once the founder approves
the copy/fields and wiring begins.

---

## 6. Everything that needs explicit founder sign-off before this goes live

1. **The PDF's content and design** — the 5 flags as distilled, the CTA wording, the visual design
   (colors pulled from `backend/public/index.html`'s `:root`, print-media block).
2. **Which posts get the gate**, exactly as named in Section 3 — including whether the two
   currently-unpublished drafts (C1 DCMA guide, C6 baseline-review guide) should be gated
   immediately on publish or held back for a later decision.
3. **The newsletter-form discrepancy in Section 3** — Option A (leave as-is) vs. Option B (move to
   Founder Log only), since the work order's instruction doesn't match what the live code currently
   does.
4. **Form fields** — confirm `role` as required (per work order) and confirm whether `name`/
   `company` should also be required or stay optional as proposed.
5. **Role field shape** — fixed dropdown (proposed, for clean downstream analysis) vs. free text.
6. **New `leads` table schema** (Section 4.1) and the new env var name
   `KNOCK_LEAD_MAGNET_WORKFLOW_KEY` (Section 4.4).
7. **PDF hosting path** (`backend/public/lead-magnets/...`) — confirm this is an acceptable public,
   unauthenticated URL for the asset (same trust level as existing `brand/` assets).
8. **Whether a basic consent/opt-in line is needed on the form itself** (e.g., a link to
   `privacy.html`, standard marketing-email consent copy) — this is a legal/compliance question
   distinct from the hard guardrail against security/privacy/data-handling *marketing claims*, which
   the PDF has none of. Worth a founder + `privacy.html` cross-check before the form goes live, since
   this spec doesn't resolve it either way.

**No stop-and-escalate flags found during this round** — no security/privacy/data-handling claim was
drafted anywhere, no competitor name appears, no unsourced statistic was used, and the CTA was
deliberately scoped to avoid overclaiming against the known Logic/Hard-Constraints engine gaps
(Issue #56). The open items above are founder *decisions*, not blockers caused by a guardrail
violation.

> **Source files referenced:** `backend/src/blog-content.js`, `backend/src/analyze.js`,
> `backend/src/db.js`, `backend/src/server.js`, `backend/src/knock.js`,
> `backend/src/auth.js` (`EMAIL_RE`), `backend/public/index.html` (`:root` tokens),
> `docs/brand-narrative.md`, `docs/dcma-14point-copy-corrections-PROPOSAL.md`,
> `docs/blog-drafts/c1-dcma-14-point-check-guide.md`,
> `docs/blog-drafts/c6-reviewing-contractor-baseline.md`, `schedule-health/CLAUDE.md`.
