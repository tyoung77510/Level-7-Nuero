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
| `POST` | `/api/auth/signup` | `{name, email, phone, password}` (password ≥ 8 chars; name and phone required) — creates a user, starts a session, sets the session cookie, and fires a (non-blocking) Knock lead sync |
| `POST` | `/api/auth/login` | `{email, password}` — verifies credentials, starts a session, sets the session cookie |
| `POST` | `/api/auth/logout` | Deletes the current session and clears the cookie |
| `GET` | `/api/auth/me` | Returns `{user}` (or `{user: null}`) for the current session — used by the frontend on load to decide whether to show the login screen, the paywall, or the app |

The frontend (`public/index.html`) gates the whole app behind a login/signup
screen: on load it calls `/api/auth/me`; if there's no valid session it shows
a small login/signup form (toggle between the two — signup additionally asks
for name and phone), otherwise it goes straight into the app — every account,
including the free tier, has full access to the core product (see Pricing
and AI credits below for what's actually gated) — with the logged-in user's
email, plan/credit pill, and a "Log out" button above the nav.

## Pricing and AI credits

There is no longer an all-or-nothing paywall. Every account gets full access to uploads, health
scoring, issues, trends, portfolio, and reports regardless of plan. What's metered is **AI
narrative generation** (see below), spent as credits:

- **Free** — every signup gets 20 credits once, free, no card required.
- **Starter — $19.99/month** — 150 credits/month, refilled each billing cycle.
- **Pro — $49/month** — 500 credits/month, refilled each billing cycle.
- **Teams / Enterprise** — shown in the Plan tab for lead-gen ("Contact us", mailing
  `admin@level7data.com`) but not wired up to real checkout — this app doesn't support multiple
  seats on one account yet, so building real billing for a feature that doesn't exist would just
  be dead code. Add real multi-seat support first, then wire these up the same way Starter/Pro
  are wired.
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
| `POST` | `/api/analyze` | Upload a schedule (JSON body: `{project, filename, content}`, or multipart form with a file field) — parses it, runs the health checks, and saves a snapshot under the current user |
| `GET` | `/api/projects` | List the current user's analyzed projects |
| `GET` | `/api/portfolio` | Latest health score for each of the current user's projects, for the portfolio view |
| `GET` | `/api/projects/:name/history` | Full snapshot history for one of the current user's projects, for the trends view |
| `GET` | `/api/projects/:name/latest` | Latest snapshot + its issues for one of the current user's projects |
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

SQLite, stored at `data/schedule-health.db`. Nine tables:
- `users` — one row per account (name, email, phone, hashed password + salt, Stripe customer/subscription IDs, subscription status, `plan_tier`, `credit_balance`)
- `sessions` — one row per active login (token, user, expiry)
- `projects` — one row per project name, scoped to the user who created it (`UNIQUE(user_id, name)` — two users can each have a project called "River Bridge")
- `snapshots` — one row per analysis run, with the score and breakdown, plus a cached `narrative` column for the AI-generated summary (null until generated)
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

- **Role-based access / orgs** — every user only sees their own projects; there's no team/workspace concept yet where multiple people share the same project (see the roadmap's "Authentication and multi-tenancy" section).
- **Password reset / email verification** — signup and login only. No email sending is wired up.
- **File upload size limits / virus scanning** — the multipart parser here is intentionally minimal; swap in a real library (e.g., `busboy`) before accepting uploads from untrusted users.
- **MPP (MS Project) parsing** — still XER and CSV only. MPP needs a library like `mpxj`.
- **Failed-payment / dunning handling** — a `past_due` or `unpaid` Stripe status isn't specially handled; there's no dedicated "your payment failed, update your card" screen yet, and credits aren't clawed back if a renewal fails.
- **Webhook-driven subscription updates** — written and ready, but inert until this is deployed with a public URL and registered in the Stripe Dashboard (see Billing section above). Until then, cancellations/renewals (and the credit refill on renewal) won't reflect here automatically — only the post-checkout verify call keeps things in sync.
- **No in-app feedback review screen** — submissions land in the `feedback` table and (once configured) trigger a Knock notification, but there's no admin view in the app itself yet; reviewing them today means querying the database directly or reading the Knock notification.
- **Teams/Enterprise tiers aren't real plans** — they're "Contact us" cards in the Plan tab with no checkout behind them, because this app has no multi-seat/org support to sell yet (see Pricing and AI credits above).

## Frontend

`public/index.html` is the real, wired frontend — open `http://localhost:3000/` after starting the server and it's fully live: uploads go to `/api/analyze`, trends and portfolio pull from the real database, and issues can be marked resolved with a button that calls `PATCH /api/issues/:id`. This has been tested end-to-end (screenshotted and verified working, not just written).

The original `app/index.html` in the repo root is the earlier browser-storage-only version — kept for reference, but `backend/public/index.html` is the one to actually use and build on from here.

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

Not yet covered by an automated test suite — that's a reasonable next addition.
