# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Schedule Health (Ordo7)

A tool that tells project controls analysts and PMs what's actually wrong with their schedule, in plain language, from one upload. Parses Primavera `.xer` (and MS Project XML / CSV fallback) exports, runs DCMA-style schedule-health checks, scores 0–100, and produces a printable status report. Branded as **Ordo7**, powered by Level 7.

Read `README.md` and `docs/design-notes.md` before extending anything. The UX thesis — plain language over jargon, one primary action per screen, progressive disclosure — is the product, not polish. Evaluate every new feature against "does this stay out of the way until someone needs it."

## Run / build / test

```bash
cd backend
node src/server.js          # API + frontend at http://localhost:3000
```

- **No build step and no `npm install`.** The backend is intentionally **zero-dependency**: only Node's built-in `http` and `node:sqlite`. Requires **Node ≥ 22.5** (for `node:sqlite`).
- **Automated tests are just getting started** — run `npm test` (Node's built-in `node --test`, zero dependencies). Coverage today is a regression test for the Microsoft Project (MSPDI/XML) analysis path in `test/analyze-msp.test.js`; the rest of the app is still verified manually/end-to-end (curl + real-browser/Playwright), documented in `backend/README.md` under "Tested." Add a `test/*.test.js` file alongside any parser/rules-engine change you want protected, and drive the actual flow for everything not yet covered.
- Config: copy `backend/.env.example` → `backend/.env` (gitignored). Every external integration **degrades gracefully** when its env vars are unset — the app runs fully on email/password auth alone with billing, OAuth, notifications, and AI all inert. Don't add hard dependencies on any integration being configured.

## Which frontend is real

There are two, and this trips people up:

- `app/index.html` — the **original single-file browser-only prototype** (parses/analyzes/stores entirely in the browser via `localStorage`). Kept for reference only. **Do not build on it.**
- `backend/public/index.html` — the **real, server-backed frontend**. This is the one served at `localhost:3000` and the one to change.

## Backend architecture (`backend/src/`)

A hand-rolled HTTP server with a manual route dispatcher — no Express, no framework. All the same zero-dependency philosophy applies to every integration (Stripe, OAuth, Knock, Anthropic are all raw REST/HTTPS calls, no SDKs).

| File | Responsibility |
|---|---|
| `server.js` | The whole HTTP server + route dispatcher (largest file). Auth gating, ownership checks, and error capture live here. |
| `analyze.js` | Schedule parsing (`.xer`/CSV/MSP-XML) **and** the DCMA-style rules engine that produces issues + the 0–100 score and sub-scores. |
| `db.js` | SQLite schema (10 tables) + all queries. Migrations via an `ensureColumn()` helper that runs `ALTER TABLE ... ADD COLUMN` at every startup — see below. |
| `auth.js` | `crypto.scrypt` password hashing + opaque server-side session tokens (not JWT), stored in the `sessions` table. |
| `oauth.js` | Hand-rolled OAuth 2.0 auth-code flow for Google/LinkedIn/Facebook/X (PKCE only for X). |
| `billing.js` | Stripe subscriptions + one-time credit top-ups via Stripe's REST API directly. |
| `pricing.js` | Tier definitions and the **credit math** — cost is derived from real Anthropic per-token price × margin multiplier. Change tiers/margin here only. |
| `ai.js` | Raw HTTPS calls to `api.anthropic.com` for the AI narrative and multi-turn chat. Model defaults to `claude-haiku-4-5` (override via `ANTHROPIC_MODEL`). |
| `knock.js` | Notifications/lead-sync (verification email, password reset, feedback, error alerts, team invites) via Knock. |
| `rate-limit.js` | In-memory rate limiting. |
| `blog-content.js` | Server-rendered blog posts for SEO. |

`backend/public/` also serves `admin.html` (the `/admin` command center), `privacy.html`/`terms.html`, `robots.txt`/`sitemap.xml`, `shared-snapshot.html`, and `brand/` assets.

## Conventions and gotchas specific to this codebase

- **Authorization is enforced at the DB layer**, not just authentication: every project-scoped query is filtered by `user_id` (`WHERE user_id = ?`), and ID-addressed routes (e.g. `PATCH /api/issues/:id`) re-check ownership and return `403`. Preserve this pattern on any new route — never reach a resource by raw ID without an ownership check.
- **Schema changes must go through `ensureColumn()`.** `CREATE TABLE IF NOT EXISTS` does nothing for an existing table, so a new column won't appear on an existing local DB. Add it to the `ensureColumn` list in `db.js` so old databases self-upgrade on boot. New columns must be **nullable / safely defaulted** — note the `email_verified` default is `1` specifically so enabling verification doesn't retroactively lock out existing users. `node:sqlite` also rejects non-constant `ALTER TABLE` defaults.
- **Never trust client-supplied money/tier values.** Purchased tier is derived from Stripe's actual line-item price ID; top-up credits from Stripe's `amount_total`. Top-up grants are idempotent via a `UNIQUE` Stripe-session-id row.
- **AI cost is metered as credits** and logged per call to `ai_usage`. Generation returns `429` when a user is out of credits vs. `503` when `ANTHROPIC_API_KEY` is unset — keep those distinct.
- **Don't fabricate metrics.** True CPI/SPI (cost EVM) aren't computed because schedule-only exports lack cost data — flag as unavailable rather than faking. Sub-scores/columns that predate a feature show `—` for old snapshots, never a made-up number.
- **The frontend sandbox scoring is a hand-kept mirror** of `analyze.js`'s formula (`sandboxScoreFrom`/`sandboxContribution` in `index.html`) — there's no shared module between frontend and backend, so a scoring change in `analyze.js` must be mirrored there by hand.
- **Theming** is all CSS custom properties under `:root` in `public/index.html`; retheme by changing values there. `@media print` deliberately overrides back to a light palette.

## Deploying

Needs a host that runs a long-lived Node 22.5+ process (Railway/Render/Fly/VPS — not pure serverless, since it holds an open HTTP server + local SQLite file). Set `DATA_DIR` to a mounted persistent volume so the SQLite DB survives redeploys. For live Stripe subscription lifecycle sync, register the webhook (`/api/billing/webhook`) and set `STRIPE_WEBHOOK_SECRET`; until then, post-checkout `/api/billing/verify` is the primary activation path. See `backend/README.md` (Deploying) and `docs/infrastructure-roadmap.md` for the full plan.
