# Infrastructure roadmap

This document originally described what it would take to turn a single-file, browser-only demo
into something a team could actually rely on. That demo (`app/index.html`) is gone — the real
product now lives in `backend/` (Node + `node:sqlite`, real accounts, real API layer, deployed on
Railway at ordo7.pro). This revision reflects what's actually been built and what's genuinely
still open, so it stays useful instead of describing a version of the app that no longer exists.

## Why this order (still holds)

Don't build everything before getting users. Sequence infrastructure as: (1) backend + auth
first, since it's required for *any* multi-user value, (2) real EVM/cost integration next, since
that's the single biggest credibility unlock for a project-controls audience, (3) automated
ingestion and notifications after that, once there's evidence people are using it daily. Steps 1
and (a real, if intentionally simple, version of) 2 are done; 3 is still ahead.

## 1. Backend and database — done

- Server-side SQLite (`node:sqlite`, no external dependency) persists uploaded schedules, parsed
  activity data, health score history, and issue resolution status.
- A real API layer (`backend/src/server.js`) sits between the frontend and the database.
- Multi-user access to the same project data works via the Teams multi-seat plan.
- Not done: this is still a single SQLite file on one Railway instance, not Postgres. Fine at
  current scale; revisit if/when this needs to run as more than one instance (see the rate
  limiter's own note on the same constraint in `backend/src/rate-limit.js`).

## 2. Authentication and multi-tenancy — mostly done

- Real accounts (email/password, hashed with scrypt) plus Google/LinkedIn/Facebook/X OAuth.
- Self-service password reset, email verification, and session management, all covered in a
  pre-launch security pass (rate limiting, upload caps, security headers, error monitoring — see
  `backend/README.md`).
- Teams multi-seat access for shared project visibility.
- **Not done**: role-based access within a team. Every team member currently has identical access
  — there's no analyst/PM/admin distinction (e.g., a PM who shouldn't need to see raw DCMA codes).
  Would need a `role` column on team membership plus per-route checks; nothing in the schema
  blocks adding this later.

## 3. Server-side file parsing — partially done

- XER (Primavera P6) and MSPDI (MS Project's XML export format) are both parsed server-side
  (`backend/src/analyze.js`), including planned/actual dates and status for Earned Schedule (see
  item 4).
- **Not done**: binary `.mpp` files still aren't supported — MSPDI (File → Save As → XML in MS
  Project) is required today. Binary `.mpp` would need a server-side library like `mpxj`.
- **Not done**: no object-storage upload pipeline or background job queue. Files are read
  directly into memory (now capped at 25MB — see the security pass) and parsed synchronously in
  the request. Fine at current file sizes/volume; would need rearchitecting for very large
  schedules (50,000+ activities) or high concurrent upload volume.

## 4. Real EVM/cost integration layer — partially done, deliberately scoped down

Real cost-based EVM (PV/EV/AC/CPI/SPI with automatic ERP cost feeds) is still not built, and
genuinely can't be from file uploads alone — almost no schedule export carries per-activity cost
data. What shipped instead, deliberately: **Earned Schedule** (Walt Lipke's methodology), a
schedule-only analog computed entirely from real parsed dates/status, with an *optional* manual
cost layer (user enters Budget at Completion + Actual Cost to Date) that produces genuine, honest
CPI/CV/EV/PV — never fabricated, never estimated for the user. See the "Earned Value" view in the
app and its backend in `analyze.js`'s `computeEarnedSchedule`.

- **Still not done**: automatic ERP/cost-system integration (SAP, Oracle, Deltek) or a cost-CSV
  import with an activity-code mapping/reconciliation step. This is the real next lift here if a
  customer wants CPI/SPI without manually re-entering two numbers per snapshot.

## 5. Scheduled/automated ingestion — not done

Still the biggest untouched item. Value compounds when someone doesn't have to remember to
upload:
- A nightly job pulling the latest schedule from wherever it lives (SharePoint, a P6 database
  directly, a watched email inbox)
- Primavera has a web services API worth targeting for direct P6 integration

## 6. Notifications — partially done

- Transactional email exists end-to-end via Knock: email verification, password reset, team
  invites, feedback-received (to the team), and error alerts (to the team) — see
  `backend/src/knock.js` and the corresponding `KNOCK_*_WORKFLOW_KEY` env vars in
  `backend/.env.example`.
- **Not done**: proactive product-health alerts to *customers* — nothing yet emails/Slacks a user
  when their own health score drops, a new critical issue appears, or float goes negative on the
  critical path. That's still the "pull → push" lift described below, and would need a job
  scheduler plus a per-user notification-preferences model.

## 7. Audit trail and versioning — already true, no work needed

Every upload creates a new, immutable `snapshots` row rather than overwriting a mutable "current
state" — this was true of the schema from early on, not something added in this pass. Cross-
snapshot variance (what changed between two uploads of the same project) is already a real feature
in the app. Nothing further needed here unless compliance requirements get more specific (e.g., a
customer needing signed/notarized snapshots for a contract dispute).

## 8. Security and compliance basics — app-level hardening done; infra/compliance still open

A real pre-launch security pass shipped: rate limiting on auth and AI-cost endpoints, a request
body size cap, security response headers (CSP/HSTS/X-Frame-Options), server-side error monitoring
with an admin-visible log, and a self-service password reset flow with full session invalidation
on use. See `backend/README.md` for details on each.

- **Not done**: encryption at rest (Railway's underlying storage encryption may already cover
  this at the infra level — worth confirming, not verified as part of this pass), SOC 2, and
  FedRAMP. All still genuinely open and still the right calls to defer until there's a customer
  actually requiring them — SOC 2 in particular is an ongoing compliance program, not a one-time
  build task, and not worth starting before it's a sales blocker.

The rest of this section is the map for *when* one of those becomes a sales blocker. It splits
into two very different bars — SOC 2 (a commercial trust baseline) and government use (a much
larger, different lift). Neither is a one-time build, and both stay deferred until a specific deal
requires them. But several of the architecture choices below should be made *before* that deal so
hosting and data-flow decisions aren't redone under pressure.

### 8a. SOC 2 — the commercial trust baseline
An attestation issued by a CPA firm, not a certification. Type I (controls exist at a point in
time) then Type II (controls operate effectively over a 3–12 month window). It needs:
- **Program:** a named security owner; written policies (infosec, access control, incident
  response, change management, vendor/subprocessor management, BCP/DR, risk assessment);
  security-awareness training; background checks; a compliance-automation platform
  (Vanta / Drata / Secureframe) to collect evidence continuously.
- **Technical controls:** encryption in transit (TLS — have it) *and at rest* (see the blockers
  below); MFA; audit logging; least-privilege + RBAC (the same gap as item 2's missing roles);
  vulnerability scanning + an annual third-party pen test; tested backup/restore; endpoint/MDM on
  employee laptops.
- **Vendor governance:** a subprocessor register + DPAs for every data-touching vendor — Stripe,
  Anthropic, Knock, the OAuth providers, and the host.
- **Rough cost/timeline:** ~6–12 months, ~$25–60k/yr (tooling + audit). Do this first: ~70% of its
  controls are prerequisites for the government path anyway, and it unblocks the enterprise/Teams
  tier.

### 8b. Government use — depends entirely on *which* government
There is no single "government compliant." The gate differs by buyer:
- **Federal agencies (direct):** FedRAMP ATO (NIST SP 800-53; Low/Moderate/High baselines), a 3PAO
  assessment, an agency sponsor, and hosting on FedRAMP-authorized IaaS (**AWS GovCloud / Azure
  Government**). 12–24 months, **$500k–$2M+** — only worth starting with a committed sponsor and a
  real deal in hand.
- **Defense contractors** (the A&D firms already in the Tier-2 outreach): **CMMC 2.0 Level 2 ≈
  NIST SP 800-171** (110 controls) for handling CUI. Much lighter than FedRAMP and the most
  realistic near-term government-adjacent target.
- **State/local & education** (the K-12 bond-program vertical): **StateRAMP**, which mirrors
  FedRAMP Moderate at a lower entry cost.
- **Any federal use also implies:** Section 508 / WCAG accessibility, US data residency, and often
  US-persons-only access.

### 8c. The three Ordo7-specific blockers (settle these before any government deal)
1. **The AI narrative sends schedule content to Anthropic** (an external subprocessor). For
   CUI/defense/ITAR schedules this is a showstopper as-built. It needs either a per-tenant toggle
   to disable AI for government tenants, or a government-compliant inference path (e.g., Claude via
   AWS Bedrock in GovCloud — verify current availability) with the right agreements in place. **If
   A&D/defense is a target, schedules may carry ITAR-controlled technical data → US-persons-only
   access, US-only hosting, no foreign support staff.** That one fact reshapes hosting, staffing,
   and the AI feature, so decide it early.
2. **SQLite single file** (item 1) → managed **Postgres** with encryption at rest, automated
   encrypted backups + point-in-time recovery, and HA. SQLite makes encryption-at-rest, backups,
   and audit evidence materially harder to demonstrate to an assessor.
3. **Audit logging + AuthN gaps:** a comprehensive, tamper-evident audit trail (auth events, data
   access, admin actions, exports — today it's error logging + snapshot variance only) and **MFA +
   enterprise SSO (SAML/SCIM)**. Item 2's missing RBAC is this same gap from the access-control
   angle.

One genuine tailwind: the **zero-dependency architecture is a compliance asset** — a tiny
supply-chain attack surface and no npm-CVE churn is exactly what assessors want to see. The
hand-rolled auth (scrypt + server-side sessions) is sound but will be scrutinized, so keep it
documented and get it into the pen-test scope.

### 8d. Recommended sequence
1. **SOC 2 Type II first** — the trust baseline; it pre-builds most government controls and
   unblocks enterprise revenue.
2. **In parallel, close the both-bars architecture gaps:** encryption at rest, managed Postgres,
   audit logging, MFA/SSO, subprocessor governance, and the AI-feature tenant toggle.
3. **Then pick the government wedge deliberately** (it drives hosting, which is expensive to
   redo): defense contractors via NIST 800-171/CMMC (cheapest, matches current outreach) →
   state/local + education via StateRAMP → direct-to-federal via FedRAMP (only with a sponsor).

## Open questions for whoever picks this up

- Which ERP/cost systems are the actual target customers using? This determines the first
  integration to build in item 4, if/when automatic cost feeds become worth building.
- **Which** government segment, if any — federal agencies (FedRAMP), defense contractors
  (CMMC / NIST 800-171), or state/local + education (StateRAMP)? See the expanded item 8. This is
  the pivotal decision: it sets whether hosting must be GovCloud + US-persons-only from the start
  (federal / ITAR) or can stay on mainstream compliant cloud (contractors / state) — and hosting
  is expensive to redo, so it should be decided before, not after, the compliance work begins.
- Direct P6 API integration vs. file upload as the primary ingestion method — the former is a
  much bigger lift but removes the single biggest point of friction (remembering to export and
  upload). This is now the single highest-leverage item left on this list (item 5).
