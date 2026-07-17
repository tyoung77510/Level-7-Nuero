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

## Open questions for whoever picks this up

- Which ERP/cost systems are the actual target customers using? This determines the first
  integration to build in item 4, if/when automatic cost feeds become worth building.
- Is government/defense a target segment? This determines how early FedRAMP planning needs to
  start, since it affects hosting choices made much earlier than item 8.
- Direct P6 API integration vs. file upload as the primary ingestion method — the former is a
  much bigger lift but removes the single biggest point of friction (remembering to export and
  upload). This is now the single highest-leverage item left on this list (item 5).
