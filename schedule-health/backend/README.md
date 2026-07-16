# Schedule health — backend

A real API backend for the Schedule Health app: parses schedule files, runs DCMA-style checks, and persists results to a real database instead of browser storage. This replaces step 1 of `docs/infrastructure-roadmap.md` in the main repo.

## Why it's built this way

**Zero dependencies on purpose.** This uses only Node's built-in `http` module and the built-in `node:sqlite` module (stable enough for this use case as of Node 22+, marked experimental by Node itself). That means `npm install` isn't required to run it — clone it, run `node src/server.js`, done. This was a deliberate choice to keep the prototype-to-real-backend step frictionless. For a production deployment, swapping to Express + a hosted Postgres instance (per the roadmap) is a reasonable next step, but isn't required to start using this for real.

## Running it

```bash
node src/server.js
# API running at http://localhost:3000
# SQLite file created at data/schedule-health.db
```

No `npm install` needed. Requires Node 22.5 or later (for `node:sqlite`).

## Deploying

This runs on any host that can run a long-lived Node 22.5+ process (Railway, Render, Fly.io, a
plain VPS — not a purely serverless/functions platform, since it holds an open HTTP server and a
local SQLite file). Two things matter beyond just running `node src/server.js`:

- **`PORT`** — the server already reads `process.env.PORT`, which is how most hosts (Railway
  included) tell your app which port to bind to. No changes needed.
- **`DATA_DIR`** — set this to the path of a mounted persistent volume (e.g. `/data`) so the
  SQLite database survives redeploys. Without it, the database defaults to a `data/` folder next
  to the source code, which most hosts wipe and replace on every deploy — fine for quick testing,
  not for anything you'd want to keep. Whatever `DATA_DIR` points to, the directory is created
  automatically on first run if it doesn't exist.

Once deployed with a real public URL, also: point your domain's DNS at the host, and register the
Stripe webhook endpoint (`https://yourdomain/api/billing/webhook`) in the Stripe Dashboard →
Developers → Webhooks, then set `STRIPE_WEBHOOK_SECRET` to the signing secret it gives you — this
is what keeps subscription renewals/cancellations in sync automatically going forward (see
Billing section below for what's already wired up vs. what needs that webhook specifically).

## Configuration

Copy `.env.example` to `.env` and fill in real values (`.env` is gitignored — never commit it). The
server loads it itself via a ~15-line built-in parser, no `dotenv` dependency. Without a `.env`,
auth still works but billing (Stripe) and lead-sync (Knock) stay inert — see below.

## Authentication

Every project belongs to the user who created it. All `/api/*` routes except
`/api/auth/*` require a logged-in session — an unauthenticated request gets
`401 Not authenticated`.

**How it works:**
- **Passwords** are hashed with Node's built-in `crypto.scrypt` (a random 16-byte salt per user, 64-byte derived key), not stored in plain text. No bcrypt dependency needed.
- **Sessions** are opaque random tokens (`crypto.randomBytes(32)`), stored server-side in a `sessions` table (not JWT) — this keeps sessions trivially revocable (logout just deletes the row) and avoids pulling in a JWT-signing library, which fits this codebase's zero-dependency approach better than a stateless token would. The token is set as an `HttpOnly`, `SameSite=Lax` cookie (`Secure` is added automatically when the request is over HTTPS), so it's inaccessible to JS and isn't sent cross-site. Sessions expire after 7 days; expired sessions are swept on server start.
- **Authorization**, not just authentication: every project-scoped query is filtered by `user_id` at the database layer (`WHERE user_id = ?`), and the one route that reaches a resource by its own ID rather than by project name (`PATCH /api/issues/:id`) explicitly checks that the issue's project belongs to the requesting user before allowing the update, returning `403` otherwise.

**Auth API:**

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/auth/signup` | `{name, email, phone, password}` (password ≥ 8 chars; name and phone required) — creates a user, starts a session, sets the session cookie, fires a (non-blocking) Knock lead sync, and — if email verification is configured (see below) — sends a verification email instead of granting immediate access |
| `POST` | `/api/auth/login` | `{email, password}` — verifies credentials, starts a session, sets the session cookie |
| `POST` | `/api/auth/logout` | Deletes the current session and clears the cookie |
| `GET` | `/api/auth/me` | Returns `{user}` (or `{user: null}`) for the current session — used by the frontend on load to decide whether to show the login screen, the verify-email screen, or the app |
| `POST` | `/api/auth/verify` | `{token}` — consumes a verification token (single-use) and marks the account verified. Works without an active session, since the link may be opened on a different device than the one that signed up |
| `POST` | `/api/auth/resend-verification` | Requires an active session; re-sends the verification email for the logged-in (but not yet verified) account. 503 if verification isn't configured |

### Social sign-in (OAuth)

"Continue with Google / LinkedIn / Facebook / X" — hand-rolled OAuth 2.0 authorization-code flow
(`src/oauth.js`), no auth library dependency. Each provider only appears on the login screen once
its credentials are set; with none configured, the app behaves exactly as before (email/password
only) — same graceful-degradation pattern as the rest of this app's integrations.

**Env vars** (see `.env.example`): `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`,
`LINKEDIN_CLIENT_ID`/`LINKEDIN_CLIENT_SECRET`, `FACEBOOK_CLIENT_ID`/`FACEBOOK_CLIENT_SECRET`,
`X_CLIENT_ID`/`X_CLIENT_SECRET`. Each provider's redirect URI must be registered on that
provider's app-settings page as `https://yourdomain/api/auth/{provider}/callback`.

**Routes:**

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/auth/oauth-providers` | Returns `{google, linkedin, facebook, x}` booleans — which providers have credentials configured, so the frontend only shows working buttons |
| `GET` | `/api/auth/:provider/start` | Redirects the browser to the provider's login page. Sets a short-lived (`10 min`), `HttpOnly` state cookie for CSRF protection across the round trip; X additionally gets a PKCE code verifier in that cookie (X requires PKCE even for confidential clients — the others don't require it but ignore it harmlessly) |
| `GET` | `/api/auth/:provider/callback` | Where the provider redirects back to. Validates state, exchanges the code for an access token, fetches the profile, then: logs in directly if this provider was already linked; links the provider to an existing account if the (provider-verified) email matches one; creates a new account otherwise; or, if the provider didn't return an email (X), redirects to `/?completeOAuth=TOKEN` for one more step |
| `POST` | `/api/auth/complete-oauth` | `{token, email}` — finishes account creation for a provider that didn't supply an email. This email is user-typed, not provider-verified, so it's **never** auto-linked to an existing account (that would let anyone claim someone else's account by typing their email) — a match returns `409`, same as normal signup's duplicate-email check |

Account linking is by email, and only ever automatic when the email came from the provider's own
authenticated API response (Google/LinkedIn/Facebook) — never from a value the user typed in a
form. Signing up with Google using the same email as an existing password-based account links
the two rather than creating a duplicate; signing in again via the same provider reuses the
existing linked account.

### Email verification

Enforced only once `KNOCK_VERIFICATION_WORKFLOW_KEY` is set (see `.env.example`) — same
graceful-degradation pattern as the rest of this app. Without it, new signups get immediate
access, no email step at all (good for local dev). Once configured:

- Signup creates the account with `email_verified = 0` and sends a verification link
  (`https://yourdomain/?verify=TOKEN`) via a Knock workflow you build in the dashboard.
- Every non-auth route returns `403 {code: "EMAIL_NOT_VERIFIED"}` until the account is verified —
  enforced server-side in the dispatcher, not just hidden in the UI.
- Tokens are single-use (24-hour expiry) and stored in a `verification_tokens` table — clicking
  the link a second time, or after it expires, fails cleanly rather than silently re-verifying.
- Clicking the link **in the same browser session that signed up** unlocks the app directly.
  Clicking it from a different device/browser (the common case — verifying from a phone's mail
  app) marks the account verified server-side but sends that browser to the login screen instead
  of silently starting a session — the verification token isn't treated as login credentials.
- **Existing accounts are never retroactively locked out.** The `email_verified` column's
  migration default is `1` (verified), specifically so that turning this feature on doesn't lock
  out real users who signed up before it existed — only new signups after `KNOCK_VERIFICATION_WORKFLOW_KEY`
  is set are required to verify.

The frontend (`public/index.html`) gates the whole app behind a login/signup
screen: on load it calls `/api/auth/me`; if there's no valid session it shows
a small login/signup form (toggle between the two — signup additionally asks
for name and phone). If there's a session but the account isn't verified, it shows a
"verify your email" screen with a resend button instead of the app. Otherwise it goes straight
into the app — every verified account, including the free tier, has full access to the core
product (see Pricing and AI credits below for what's actually gated) — with the logged-in user's
email, plan/credit pill, and a "Log out" button above the nav.

## Pricing and AI credits

There is no longer an all-or-nothing paywall. Every account gets full access to uploads, health
scoring, issues, trends, portfolio, and reports regardless of plan. What's metered is **AI
narrative generation** (see below), spent as credits:

- **Free** — every signup gets 20 credits once, free, no card required.
- **Starter — $19.99/month** — 150 credits/month, refilled each billing cycle.
- **Pro — $49/month** — 500 credits/month, refilled each billing cycle.
- **Teams — $149/month** — 2,500 pooled credits/month (see `getEffectiveTierUser()` below),
  unwatermarked report exports, and up to 9 invited team members sharing the owner's plan and
  credit pool (`src/server.js`'s `/api/team*` routes, `MAX_TEAM_MEMBERS` in `pricing.js`). Wired
  up the same way as Starter/Pro — `pricing.TIERS.teams` is just another entry, so
  checkout/webhook/credit-refill all work with no tier-specific code. Live review rooms are
  **not** included — still not built, so still left off the pricing card rather than sold as
  something that doesn't work.
- **Enterprise** — still a "Contact us" lead-gen card (mailing `admin@level7data.com`), no
  checkout wired up.
- **One-time credit top-ups** — any account, on any plan, can also buy AI credits directly (no
  subscription change) from the "Need more credits" card in the Plan tab: $10 minimum, in $10
  increments, credits never expire and stack on top of whatever the plan already refills monthly.

**How a credit is priced (`src/pricing.js`):** every AI call's real cost is computed from
Anthropic's actual per-token price for the model in use (`claude-haiku-4-5`: $1/$5 per million
input/output tokens), then multiplied by a fixed markup (`MARGIN_MULTIPLIER`, currently 4x — a
75% margin over what Anthropic bills us) and converted to whole credits (`CREDIT_VALUE_USD`,
currently $0.001/credit). This means credit cost always tracks real usage — a longer, more
expensive generation costs more credits than a short one — rather than a flat "1 call = 1
credit" guess. Every call's actual input/output token counts, cost, and credits charged are
logged to the `ai_usage` table for margin auditing. To retune margin or credit pricing across
every tier at once, change the constants at the top of `src/pricing.js` — nothing else needs to
change.

**Top-up pricing is deliberately separate from subscription pricing.** Subscription tiers bundle
credits into a flat monthly fee, so their effective per-credit rate is very cheap (Pro:
$49/500cr ≈ $0.10/credit) — but that rate only makes sense because the subscription is paying for
the whole product, not literally selling credits at cost. A one-time top-up has no such bundling,
so it's priced at its own flat retail rate instead (`TOPUP_CREDIT_PRICE_USD`, currently
$0.20/credit — 2x the Pro-bundled rate), so buying credits piecemeal never becomes cheaper than
just subscribing.

**Note:** the UI labels match the actual configured Stripe prices (Starter $19.99, Pro $49.00) —
double-check both against the Stripe Dashboard if either is ever unclear, since the label in code
is just a display string and isn't derived from Stripe automatically. If you change a tier's
actual Stripe price (remember: prices are immutable, so this means creating a *new* price and
updating `STRIPE_PRICE_ID_STARTER`/`STRIPE_PRICE_ID_PRO`), update the matching label in
`pricing.js` and `public/index.html` in the same change so they can't drift apart again.

## Billing (Stripe subscription)

Once `STRIPE_SECRET_KEY` and a tier's price ID (`STRIPE_PRICE_ID_STARTER` / `STRIPE_PRICE_ID_PRO`)
are set, that tier's "Subscribe" button in the Plan tab becomes live — each tier is independently
gated, so Pro can be live while Starter still shows a "not configured yet" error, or vice versa.
The rest of the app (including the free tier) is unaffected either way — billing is no longer a
gate on using the product at all. Credit top-ups (below) only need `STRIPE_SECRET_KEY`, since they
don't use a pre-created Stripe Price.

Implemented via plain calls to Stripe's REST API (`node:https`/`fetch`), no
`stripe` npm SDK — consistent with the zero-dependency approach used for auth.

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/billing/checkout` | `{tier: "starter"\|"pro"}` — creates a Stripe Checkout Session (`mode: subscription`) for the logged-in user and returns `{url}` to redirect the browser to Stripe's hosted checkout page |
| `GET` | `/api/billing/verify?session_id=...` | Called by the frontend after Stripe redirects back on success; retrieves the Checkout Session server-side (expanding both `subscription` and `line_items`), confirms it belongs to the current user, determines the purchased tier from the actual line item price ID (never trusting a client-supplied tier), and sets `plan_tier` + refills `credit_balance` to that tier's monthly allotment |
| `POST` | `/api/billing/topup/checkout` | `{amountUsd}` (≥ $10, in $10 increments) — creates a one-time Stripe Checkout Session (`mode: payment`, ad-hoc `price_data` — no pre-created Price needed) for that dollar amount |
| `GET` | `/api/billing/topup/verify?session_id=...` | Called after a top-up checkout redirect; confirms the session belongs to the current user and is paid, derives credits from Stripe's own `amount_total` (never the client's original request), and adds them to `credit_balance`. Idempotent — a `credit_purchases` row keyed on the Stripe session ID means refreshing the success page can't double-grant credits |
| `POST` | `/api/billing/webhook` | Stripe webhook receiver for subscription lifecycle events (renewals, cancellations) and `invoice.payment_succeeded` (refills credits on each renewal). Verifies `Stripe-Signature` against `STRIPE_WEBHOOK_SECRET`. **Inert (204, no-op) until that secret is set** — see below |

**Why verification happens on redirect, not just via webhook:** Stripe webhooks require a
publicly reachable HTTPS URL registered in the Stripe Dashboard, which `localhost` isn't. So the
primary way a subscription gets activated (and credits refilled) is the `/api/billing/verify`
call the frontend makes right after the successful-checkout redirect (Stripe embeds a
`{CHECKOUT_SESSION_ID}` in the `success_url`, which the frontend then verifies server-side
against the Stripe API — not just trusting the redirect happened). The webhook handler is written
and ready for when this is deployed somewhere with a public URL: register the endpoint in Stripe
Dashboard → Developers → Webhooks, put the resulting signing secret in `STRIPE_WEBHOOK_SECRET`,
and cancellations/renewals (including the monthly credit refill) will then happen automatically
too.

## Lead sync (Knock)

On signup, `name`/`email`/`phone` are synced to Knock (`PUT /v1/users/:id`) so new signups land in
your nurture/marketing workflows there. This never blocks or fails signup — if `KNOCK_API_KEY`
isn't set, or the Knock API call fails for any reason, it's logged to the console and signup
proceeds normally.

## Feedback

Every logged-in, subscribed user sees a "Suggest a feature" link in the app (next to "Log out")
that opens a one-box form — this is the feature-request/improvement channel: feedback is always
saved to the `feedback` table (durable, survives restarts), and — once `KNOCK_FEEDBACK_WORKFLOW_KEY`
and `KNOCK_FEEDBACK_RECIPIENT_EMAIL` are set and a matching workflow exists in your Knock dashboard
— also triggers a Knock workflow so the team gets notified (email/Slack/whatever that workflow is
configured to do) as soon as it comes in. Like the other Knock integration, this no-ops gracefully
(with a console log, feedback still saved) until that's configured.

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/feedback` | `{message}` (3–2000 chars) — saves the feedback under the current user and (if configured) notifies the team via Knock |

## AI narrative

The Report view has a "Generate AI summary" button that calls Claude (Haiku 4.5 by default) to
write a short, direct narrative — overall health, what's driving the score, and the top 1-2 next
actions — from that snapshot's score and open issues. Raw HTTPS calls to
`https://api.anthropic.com/v1/messages` (no SDK dependency, same philosophy as the Stripe/Knock
integrations), gated behind `ANTHROPIC_API_KEY`. The generated text is cached on the snapshot
(`snapshots.narrative`) so it's only generated once per snapshot, not re-billed on every view.
Without `ANTHROPIC_API_KEY` set, the button's endpoint returns a 503 and the rest of the app is
unaffected. Every generation also spends AI credits — see Pricing and AI credits above — and
returns `429` once a user's balance hits zero, distinct from the `503 not configured` case.

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/snapshots/:id/narrative` | Generates (or returns the cached) AI narrative for a snapshot — 403s if the snapshot doesn't belong to the current user, 503 if `ANTHROPIC_API_KEY` isn't set, 429 if the user is out of AI credits |

## AI chat

The "Ask AI" tab is a real multi-turn conversation about the current analysis — not just a
one-shot summary. Claude gets the same schedule context (score, open issues) as a system prompt,
plus the full prior conversation for that snapshot, so follow-up questions ("which one should I
fix first?") work the way they would in an actual back-and-forth. History is persisted per
snapshot in the `chat_messages` table, so it survives a page reload (as long as the same analysis
is still the active one in the browser session — same caveat as the Report/Health views not
reloading from the server on navigation, see Frontend section).

To bound cost on long conversations, only the last `CHAT_HISTORY_LIMIT` (20) messages are resent
to Claude as context on each new turn — older messages are still stored and returned by the GET
endpoint, just not replayed. Every turn spends credits the same way narrative generation does
(computed from that call's actual token usage, see Pricing and AI credits above) and 429s once
the balance hits zero.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/snapshots/:id/chat` | Returns the full message history for a snapshot, oldest first |
| `POST` | `/api/snapshots/:id/chat` | `{message}` (1-2000 chars) — sends a message, gets a reply, and persists both turns. 503 if `ANTHROPIC_API_KEY` isn't set, 429 if out of credits, 403/404 for ownership/existence |

## API reference

All routes below require an authenticated session (see Authentication) and are scoped to the current user's own projects.

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/analyze` | Upload a schedule (JSON body: `{project, filename, content}`, or multipart form with a file field) — parses it, runs the health checks, and saves a snapshot under the current user. Response includes `activities` (per-activity name/dates/duration/float/critical-path flag, for the Gantt view — Pro/Teams) and `hasDates` (whether the source file had real calendar dates; CSV never does) |
| `GET` | `/api/projects` | List the current user's analyzed projects |
| `GET` | `/api/portfolio` | Latest health score for each of the current user's projects, for the portfolio view. Free tier is capped to the top 2 by score in the UI; Pro/Teams see the full ranked list |
| `GET` | `/api/projects/:name/history` | Full snapshot history for one of the current user's projects, for the trends view |
| `GET` | `/api/projects/:name/latest` | Latest snapshot + its issues + its `activities` for one of the current user's projects |
| `PATCH` | `/api/issues/:id` | Update an issue's status (`open`, `acknowledged`, `resolved`) — 403s if the issue doesn't belong to one of the current user's projects |
| `POST` | `/api/snapshots/:id/narrative` | Generate/fetch the AI narrative for a snapshot — see AI narrative section above |

### Example: sign up, then analyze a file

```bash
curl -c cookies.txt -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "a-real-password"}'

curl -b cookies.txt -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"project": "River Bridge", "filename": "schedule.xer", "content": "<xer file contents as a string>"}'
```

## Database

SQLite, stored at `data/schedule-health.db`. Ten tables:
- `users` — one row per account (name, email, phone, hashed password + salt, Stripe customer/subscription IDs, subscription status, `plan_tier`, `credit_balance`, `email_verified`)
- `sessions` — one row per active login (token, user, expiry)
- `verification_tokens` — one row per pending email verification (token, user, expiry) — single-use, deleted on consumption whether valid or expired
- `projects` — one row per project name, scoped to the user who created it (`UNIQUE(user_id, name)` — two users can each have a project called "River Bridge")
- `snapshots` — one row per analysis run, with the score and breakdown, plus a cached `narrative` column for the AI-generated summary (null until generated) and an `activities_json` column (per-activity name/dates/duration/float, for the Gantt view)
- `issues` — one row per flagged issue, linked to the snapshot it came from, with a status field for tracking resolution
- `feedback` — one row per feature suggestion/improvement submitted through the app, linked to the user who submitted it
- `ai_usage` — one row per AI narrative or chat generation, logging real token counts, actual Anthropic cost, and credits charged — the audit trail behind the credit math in Pricing and AI credits above
- `credit_purchases` — one row per one-time credit top-up, keyed on the Stripe checkout session ID (`UNIQUE`) so a repeated verify call can't double-grant credits
- `chat_messages` — one row per turn (user question or assistant reply) in a snapshot's AI chat, ordered by `id` to reconstruct the conversation

This is genuinely persistent (survives restarts, unlike the browser-storage version) but is still a single SQLite file on one machine — see `docs/infrastructure-roadmap.md` in the main repo for what's needed to make this properly multi-tenant at scale (real Postgres, hosted, role-based access).

**Schema migrations:** `db.js` uses `CREATE TABLE IF NOT EXISTS`, which does nothing for a table
that already exists — so a new column added to the schema (like `narrative`, `plan_tier`, or
`credit_balance`) won't retroactively appear on an existing local `data/schedule-health.db` from
before that column existed. `db.js` handles this with a small `ensureColumn()` helper that runs
`ALTER TABLE ... ADD COLUMN` for anything missing, every time the server starts — so an older
local database upgrades itself automatically the next time you run `node src/server.js`, no
manual migration step needed.

## What this does NOT yet include

- **Role-based access / orgs** — every user only sees their own projects; there's no team/workspace concept yet where multiple people share the same project. This is separate from Teams multi-seat billing (see below), which shares a plan and credit pool across invited members — it does not share project visibility (see the roadmap's "Authentication and multi-tenancy" section).
- **Password reset / email verification** — signup and login only. No email sending is wired up.
- **File upload size limits / virus scanning** — the multipart parser here is intentionally minimal; swap in a real library (e.g., `busboy`) before accepting uploads from untrusted users.
- **Raw binary .mpp parsing** — MS Project's XML export is supported (see below); the proprietary binary `.mpp` format itself needs a real library like `mpxj`, deliberately not added to keep this zero-dependency.
- **Failed-payment / dunning handling** — a `past_due` or `unpaid` Stripe status isn't specially handled; there's no dedicated "your payment failed, update your card" screen yet, and credits aren't clawed back if a renewal fails.
- **Webhook-driven subscription updates** — written and ready, but inert until this is deployed with a public URL and registered in the Stripe Dashboard (see Billing section above). Until then, cancellations/renewals (and the credit refill on renewal) won't reflect here automatically — only the post-checkout verify call keeps things in sync.
- **No in-app feedback review screen** — submissions land in the `feedback` table and (once configured) trigger a Knock notification, but there's no admin view in the app itself yet; reviewing them today means querying the database directly or reading the Knock notification.
- **Live review rooms** — still not built (no real-time infra); left off the Teams pricing card for the same reason multi-seat invites used to be. Enterprise remains a "Contact us" card (see Pricing and AI credits above).

## Frontend

`public/index.html` is the real, wired frontend — open `http://localhost:3000/` after starting the server and it's fully live: uploads go to `/api/analyze`, trends and portfolio pull from the real database, and issues can be marked resolved with a button that calls `PATCH /api/issues/:id`. This has been tested end-to-end (screenshotted and verified working, not just written).

The original `app/index.html` in the repo root is the earlier browser-storage-only version — kept for reference, but `backend/public/index.html` is the one to actually use and build on from here.

### Theme

Dark background with a teal (`--teal: #2dd6c4`) primary accent, replacing the earlier light/navy
theme — every color in the stylesheet is a CSS custom property under `:root`, so retheming again
means changing values in one place, not hunting for hardcoded hex codes across the file. The one
deliberate exception is `@media print`: it overrides `:root` back to a light palette, since a
printed "Export as PDF" report with a black background would waste ink and look broken on paper —
verified by rendering the Report view under Playwright's print media emulation and confirming the
output flips to light colors regardless of the on-screen theme.

### Health dashboard

The Health tab is a real dashboard, not just a score bar: three metric cards (critical/at-risk/
total activities), a circular SVG gauge for the overall score (colored red/amber/teal by
threshold, same thresholds the rest of the app already uses for issue badges), three sub-scores
(logic quality, float distribution, constraint hygiene — computed in `analyze.js` by grouping the
existing six DCMA-style checks into three pairs, not a new detection engine), a trend delta
comparing the current score to the previous analysis, and a live activity feed. The feed is real
data, not decorative — it's assembled server-side (`GET /api/projects/:name/activity`) from actual
snapshot history and issue status-change timestamps, sorted by recency.

Sub-scores and the activity feed's issue-resolution timestamps are new columns
(`snapshots.logic_quality`/`float_distribution`/`constraint_hygiene`, `issues.updated_at`) —
nullable, so old snapshots from before this existed just show `—` instead of a fabricated number.

### Gantt timeline and What-If sandbox (Pro/Teams)

Both build on the `activities` array now returned alongside every analysis (see API reference) —
per-activity name, dates, duration, float, and a critical-path flag. The Gantt tab renders it as a
responsive horizontal bar-chart timeline (no charting library), red for critical-path/negative-
float rows; XER files with real dates get a calendar-accurate timeline, CSV (no date fields) falls
back to a sequential relative one, and activities with no resolvable date are listed separately
rather than plotted at a misleading "day 0".

The Sandbox tab is a pure client-side what-if tool: edit an activity's float or duration and the
health score recalculates instantly by mirroring the float/duration-based checks from
`analyze.js`'s scoring formula (`sandboxScoreFrom`/`sandboxContribution` in `index.html`, kept in
sync with the backend by hand — there's no shared module between frontend and backend here).
Logic/sequencing/constraint issues aren't recomputed since the sandbox has no lever for them; they
stay part of the fixed baseline. Nothing in the sandbox is ever sent to the server or persisted —
"Reset to saved" just clears the in-memory overrides.

## Tested

Verified working end-to-end during development: XER upload → snapshot + issues saved correctly (matches the browser prototype's DCMA-style checks), CSV upload path, project history endpoint, portfolio rollup, and issue status updates. Auth was verified end-to-end too: signup (including the new name/phone-required validation), login (wrong-password and duplicate-email rejection), logout, and that a second user cannot see or modify a first user's projects or issues (`/api/projects`, `/api/portfolio`, and `PATCH /api/issues/:id` all reject or 403 cross-user access) — tested both via curl and by driving the actual signup/login/upload/logout flow in a real browser.

**Billing and lead-sync: what was and wasn't verified.** The environment this was built in has no outbound network access to `api.stripe.com` or `api.knock.app` (sandboxed for security, confirmed via a direct `curl` showing the CONNECT tunnel itself gets rejected — a network-level block, not a Stripe API error), so the Stripe and Knock API calls themselves could not be exercised live. What *was* verified in that environment:
- Every account (free tier included) reaches the full app with no paywall — confirmed via curl and in the browser.
- Failure handling: hitting "Subscribe — Pro" with Stripe unreachable surfaces a clean error in the UI (button re-enables, error message shown) instead of hanging or crashing the server; the same is true for the Knock sync call on signup, which logs and moves on without blocking account creation.
- The request shapes sent to Stripe (Checkout Session creation with a tier-specific price ID, session retrieval with `expand[]=subscription&expand[]=line_items`) and to Knock (`PUT /v1/users/:id`) match their documented REST APIs.

**AI credits: what was verified live.** Unlike Stripe/Knock, this sandbox *can* reach
`api.anthropic.com`, so the credit math was tested against a real Claude API call, not just
inspected: a fresh signup got 20 free credits, generating one real narrative logged actual token
counts (233 input / 241 output) to `ai_usage`, computed real cost (~$0.00144), applied the 4x
margin, and correctly deducted 6 credits (balance 20 → 14) — matching the formula in `pricing.js`
by hand. Draining the balance to 0 and requesting another narrative correctly returned `429` with
the "out of credits" message instead of calling Claude again. The `ensureColumn` migration was
also verified against a hand-built pre-existing database using the old schema (no `plan_tier`,
`credit_balance`, or `narrative` columns) — it added the missing columns cleanly with no data loss
or crash, confirming a real local database from before this feature existed will upgrade itself
automatically.

**Still needs testing in an environment with real internet access** (i.e., wherever this actually gets deployed, or on your own machine): the full Pro checkout happy path — clicking Subscribe, completing a real Stripe Checkout, landing back on `/api/billing/verify`, and confirming the account flips to `plan_tier: 'pro'` with 500 credits — plus the Knock dashboard actually showing synced users and, once a feedback workflow is built there, actually receiving a feedback notification. Recommend testing checkout against Stripe's **test mode** keys/price first (a live secret key and live price ID are what's configured right now) before trusting it with real cards.

The feedback feature (`POST /api/feedback`) was verified locally end-to-end — the too-short-message validation and a successful submission — in both curl and a real browser. It's not credit-gated (only AI narrative generation spends credits).

**AI narrative and credits.** Confirmed live end-to-end with a real `ANTHROPIC_API_KEY` (see above) — `POST /api/snapshots/:id/narrative` correctly 503s with no key set, 403s when the snapshot belongs to another user, 404s for a nonexistent snapshot, generates a real narrative and deducts the correct credits on success, returns the cached narrative (and no credit charge) on a second call, and 429s once the balance hits zero.

**AI chat.** Confirmed live end-to-end with a real `ANTHROPIC_API_KEY`: asked a question about a real analyzed schedule and got a specific, contextual reply (not generic advice) referencing the actual flagged issues; asked a follow-up ("which one should I fix first?") and confirmed the reply correctly referenced the prior answer, proving conversation history is actually being resent to Claude, not just a single one-shot exchange. `GET /api/snapshots/:id/chat` returns all four turns in the correct order after that exchange. Ownership checks (403 cross-user, 404 nonexistent snapshot) and the 429 out-of-credits path were all verified via curl. Credits were deducted correctly per turn based on real token usage, same formula as the narrative feature. The frontend was screenshotted at each stage (empty state before any analysis, empty-conversation prompt after analyzing, and a full exchange with chat bubbles rendering correctly).

**Starter tier and credit top-ups.** `POST /api/billing/topup/checkout` correctly rejects amounts under $10 and non-multiples of $10 (both via curl and the client-side check in the UI) before ever calling Stripe. The credit math (`pricing.creditsForTopupAmount`) was verified directly: $10 → 50 credits, $20 → 100, $50 → 250, matching the $0.20/credit retail rate exactly. Since Stripe itself is unreachable from this sandbox (same network block as the rest of billing), the `/api/billing/topup/verify` route's core logic — grant credits once per Stripe session, do nothing on a repeat call for the same session — was verified by driving `db.js` directly the way the route does: a simulated $20 top-up correctly took a user from 20 → 120 credits, and calling the same "verify" logic again for the identical session ID left the balance unchanged at 120. The `credit_purchases.stripe_session_id` `UNIQUE` constraint was also confirmed to reject a raw duplicate insert as a second line of defense. The 5-tier Plan view (Free/Starter/Pro/Teams/Enterprise) and the top-up card were both screenshotted and confirmed rendering correctly, including the "Starter" and "Pro" credit-pill labels.

**Email verification.** Both configuration states were tested end-to-end: with `KNOCK_VERIFICATION_WORKFLOW_KEY` unset, a fresh signup gets `emailVerified: true` immediately and full access, confirming local dev stays frictionless. With it set, a fresh signup gets `emailVerified: false`, and every core route correctly returns `403 {code: "EMAIL_NOT_VERIFIED"}` while `/api/auth/me` still works. The real token generated at signup was pulled from the database and POSTed to `/api/auth/verify`, which correctly flipped the account to verified and unblocked access — and a second attempt with the same (now-consumed) token correctly failed with "invalid or expired," confirming single-use enforcement. Both post-verification UX paths were screenshotted: clicking the link in the same browser session that signed up unlocks the app directly; clicking it from a fresh browser (simulating a different device) correctly shows a "verify your email" screen. The `?verify=TOKEN` link handling in the frontend routes each case correctly. The migration's `DEFAULT 1` behavior was independently re-confirmed for this feature specifically (a hand-built database simulating a real pre-existing account came back `email_verified: 1`, not `0`) — critical since this app has real users on a live deployment, and a `DEFAULT 0` here would have retroactively locked all of them out.

**Dark theme and health dashboard.** Sub-score math was verified directly against a hand-built schedule with known issues in each category: 5 missing-logic issues across 5 activities correctly produced `logic_quality: 0`, 2 float issues (1 negative, 1 excessive) out of 5 produced `float_distribution: 60`, and 2 constraint-hygiene issues (1 hard constraint, 1 long duration) produced `constraint_hygiene: 60` — matching the `100 - (issueCount/total)*100` formula by hand. The activity feed endpoint was tested via curl before and after resolving an issue: the resolution event correctly appeared at the top of the feed (most recent), and the resolved issue correctly dropped out of the "new critical issue" list. The full dashboard — gauge, sub-score bars, metric cards, activity feed with relative timestamps — was screenshotted end-to-end in a real browser, including the trend-delta indicator correctly showing "unchanged since last analysis" when re-analyzing identical data. Every other view (Issues, Report, Trends, Portfolio, Plan, Ask Ordo, auth/verify screens) was re-screenshotted after the theme conversion to confirm no leftover light-theme colors; the one exception (`@media print`) was independently confirmed to force light colors regardless of the on-screen theme.

**Social sign-in (OAuth).** Every provider's request construction was verified against a mocked `fetch` before any real credentials existed: correct authorization-URL parameters and scopes for all four providers, PKCE `code_challenge`/`code_challenge_method` present only for X, the right token-exchange shape per provider (Google/LinkedIn as a POST body, Facebook as GET query params, X via HTTP Basic auth instead of a body secret), and correct profile parsing for each provider's real response shape (including X's nested `data.data.id`). Once real Google credentials were available, the full `start` → provider redirect → `callback` round trip was driven end-to-end against the actual running server (mocking only the outbound calls to Google, not any of this app's own code): a state-cookie mismatch is correctly rejected before any token exchange happens, a first-time sign-in creates a new account with the free-tier signup credits, and signing in again via the same provider reuses the existing linked account rather than creating a duplicate (verified by asserting the user count doesn't change). X's no-email path was verified separately end-to-end, including in a real browser via Playwright: the callback correctly detects the missing email and redirects to the "finish signing up" screen, submitting a fresh email creates the account and lands in the logged-in app state, and — the important security case — submitting an email that already belongs to another account is rejected with `409` rather than silently linking the sign-in to that account, since a self-typed email (unlike an email from Google/LinkedIn/Facebook's authenticated API) carries no proof of ownership.

Not yet covered by an automated test suite — that's a reasonable next addition.
