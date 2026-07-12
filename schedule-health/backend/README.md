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
| `POST` | `/api/auth/signup` | `{name, email, phone, password}` (password ≥ 8 chars; name and phone required) — creates a user, starts a session, sets the session cookie, and fires a (non-blocking) Knock lead sync |
| `POST` | `/api/auth/login` | `{email, password}` — verifies credentials, starts a session, sets the session cookie |
| `POST` | `/api/auth/logout` | Deletes the current session and clears the cookie |
| `GET` | `/api/auth/me` | Returns `{user}` (or `{user: null}`) for the current session — used by the frontend on load to decide whether to show the login screen, the paywall, or the app |

The frontend (`public/index.html`) gates the whole app behind a login/signup
screen: on load it calls `/api/auth/me`; if there's no valid session it shows
a small login/signup form (toggle between the two — signup additionally asks
for name and phone), otherwise it routes to either the subscribe screen or
the normal Upload → Health → Issues → Trends → Portfolio → Report flow,
depending on `subscriptionStatus`, with the logged-in user's email and a
"Log out" button above the nav.

## Billing (Stripe subscription)

Once `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID` are set, every route except
`/api/auth/*` and `/api/billing/*` starts requiring an **active or trialing**
subscription (`402 Payment Required` otherwise) — this is the actual paywall.
Without those env vars set, the paywall is off entirely (useful for local
dev before billing is configured).

Implemented via plain calls to Stripe's REST API (`node:https`/`fetch`), no
`stripe` npm SDK — consistent with the zero-dependency approach used for auth.

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/billing/checkout` | Creates a Stripe Checkout Session (`mode: subscription`) for the logged-in user and returns `{url}` to redirect the browser to Stripe's hosted checkout page |
| `GET` | `/api/billing/verify?session_id=...` | Called by the frontend after Stripe redirects back on success; retrieves the Checkout Session server-side, confirms it belongs to the current user, and activates their subscription |
| `POST` | `/api/billing/webhook` | Stripe webhook receiver for subscription lifecycle events (renewals, cancellations). Verifies `Stripe-Signature` against `STRIPE_WEBHOOK_SECRET`. **Inert (204, no-op) until that secret is set** — see below |

**Why verification happens on redirect, not just via webhook:** Stripe webhooks require a
publicly reachable HTTPS URL registered in the Stripe Dashboard, which `localhost` isn't. So the
primary way a subscription gets activated is the `/api/billing/verify` call the frontend makes
right after the successful-checkout redirect (Stripe embeds a `{CHECKOUT_SESSION_ID}` in the
`success_url`, which the frontend then verifies server-side against the Stripe API — not just
trusting the redirect happened). The webhook handler is written and ready for when this is
deployed somewhere with a public URL: register the endpoint in Stripe Dashboard → Developers →
Webhooks, put the resulting signing secret in `STRIPE_WEBHOOK_SECRET`, and cancellations/renewals
will then update `subscription_status` automatically too.

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

## API reference

All routes below require an authenticated session (see Authentication) and are scoped to the current user's own projects.

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/analyze` | Upload a schedule (JSON body: `{project, filename, content}`, or multipart form with a file field) — parses it, runs the health checks, and saves a snapshot under the current user |
| `GET` | `/api/projects` | List the current user's analyzed projects |
| `GET` | `/api/portfolio` | Latest health score for each of the current user's projects, for the portfolio view |
| `GET` | `/api/projects/:name/history` | Full snapshot history for one of the current user's projects, for the trends view |
| `GET` | `/api/projects/:name/latest` | Latest snapshot + its issues for one of the current user's projects |
| `PATCH` | `/api/issues/:id` | Update an issue's status (`open`, `acknowledged`, `resolved`) — 403s if the issue doesn't belong to one of the current user's projects |

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

SQLite, stored at `data/schedule-health.db`. Six tables:
- `users` — one row per account (name, email, phone, hashed password + salt, Stripe customer/subscription IDs, subscription status)
- `sessions` — one row per active login (token, user, expiry)
- `projects` — one row per project name, scoped to the user who created it (`UNIQUE(user_id, name)` — two users can each have a project called "River Bridge")
- `snapshots` — one row per analysis run, with the score and breakdown
- `issues` — one row per flagged issue, linked to the snapshot it came from, with a status field for tracking resolution
- `feedback` — one row per feature suggestion/improvement submitted through the app, linked to the user who submitted it

This is genuinely persistent (survives restarts, unlike the browser-storage version) but is still a single SQLite file on one machine — see `docs/infrastructure-roadmap.md` in the main repo for what's needed to make this properly multi-tenant at scale (real Postgres, hosted, role-based access).

## What this does NOT yet include

- **Role-based access / orgs** — every user only sees their own projects; there's no team/workspace concept yet where multiple people share the same project (see the roadmap's "Authentication and multi-tenancy" section).
- **Password reset / email verification** — signup and login only. No email sending is wired up.
- **File upload size limits / virus scanning** — the multipart parser here is intentionally minimal; swap in a real library (e.g., `busboy`) before accepting uploads from untrusted users.
- **MPP (MS Project) parsing** — still XER and CSV only. MPP needs a library like `mpxj`.
- **Failed-payment / dunning handling** — a `past_due` or `unpaid` Stripe status just falls through to "no access" (not `active`/`trialing`); there's no dedicated "your payment failed, update your card" screen yet.
- **Webhook-driven subscription updates** — written and ready, but inert until this is deployed with a public URL and registered in the Stripe Dashboard (see Billing section above). Until then, cancellations/renewals won't reflect here automatically.
- **No in-app feedback review screen** — submissions land in the `feedback` table and (once configured) trigger a Knock notification, but there's no admin view in the app itself yet; reviewing them today means querying the database directly or reading the Knock notification.

## Frontend

`public/index.html` is the real, wired frontend — open `http://localhost:3000/` after starting the server and it's fully live: uploads go to `/api/analyze`, trends and portfolio pull from the real database, and issues can be marked resolved with a button that calls `PATCH /api/issues/:id`. This has been tested end-to-end (screenshotted and verified working, not just written).

The original `app/index.html` in the repo root is the earlier browser-storage-only version — kept for reference, but `backend/public/index.html` is the one to actually use and build on from here.

## Tested

Verified working end-to-end during development: XER upload → snapshot + issues saved correctly (matches the browser prototype's DCMA-style checks), CSV upload path, project history endpoint, portfolio rollup, and issue status updates. Auth was verified end-to-end too: signup (including the new name/phone-required validation), login (wrong-password and duplicate-email rejection), logout, and that a second user cannot see or modify a first user's projects or issues (`/api/projects`, `/api/portfolio`, and `PATCH /api/issues/:id` all reject or 403 cross-user access) — tested both via curl and by driving the actual signup/login/upload/logout flow in a real browser.

**Billing and lead-sync: what was and wasn't verified.** The environment this was built in has no outbound network access to `api.stripe.com` or `api.knock.app` (sandboxed for security), so the Stripe and Knock API calls themselves could not be exercised live. What *was* verified in that environment:
- The paywall itself: signing up leaves `subscription_status: 'none'`, and every gated route correctly returns `402` until that changes — confirmed via curl and in the browser (new signups land on the $49/month subscribe screen, not the app).
- Failure handling: hitting "Subscribe" with Stripe unreachable surfaces a clean error in the UI instead of hanging or crashing the server; the same is true for the Knock sync call on signup, which logs and moves on without blocking account creation.
- The request shapes sent to Stripe (Checkout Session creation, session retrieval with `expand[]=subscription`) and to Knock (`PUT /v1/users/:id`) match their documented REST APIs.

**Still needs testing in an environment with real internet access** (i.e., wherever this actually gets deployed, or on your own machine): the full happy path — clicking Subscribe, completing a real Stripe Checkout, landing back on `/api/billing/verify`, and confirming the account flips to `subscription_status: 'active'` and unlocks the app — plus the Knock dashboard actually showing synced users and, once a feedback workflow is built there, actually receiving a feedback notification. Recommend testing that against Stripe's **test mode** keys/price first (a live secret key and live price ID are what's configured right now) before trusting it with real cards.

The feedback feature (`POST /api/feedback`) was verified locally end-to-end — including the paywall gate (blocked at `402` pre-subscription), the too-short-message validation, and a successful submission (with a test subscription activated directly in the local database, since real Stripe checkout couldn't be driven from this sandbox) — in both curl and a real browser.

Not yet covered by an automated test suite — that's a reasonable next addition.
