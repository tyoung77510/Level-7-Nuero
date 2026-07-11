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
| `POST` | `/api/auth/signup` | `{email, password}` (password ≥ 8 chars) — creates a user, starts a session, sets the session cookie |
| `POST` | `/api/auth/login` | `{email, password}` — verifies credentials, starts a session, sets the session cookie |
| `POST` | `/api/auth/logout` | Deletes the current session and clears the cookie |
| `GET` | `/api/auth/me` | Returns `{user}` (or `{user: null}`) for the current session — used by the frontend on load to decide whether to show the login screen or the app |

The frontend (`public/index.html`) gates the whole app behind a login/signup
screen: on load it calls `/api/auth/me`; if there's no valid session it shows
a small login/signup form (toggle between the two), otherwise it shows the
normal Upload → Health → Issues → Trends → Portfolio → Report flow with the
logged-in user's email and a "Log out" button above the nav.

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

SQLite, stored at `data/schedule-health.db`. Five tables:
- `users` — one row per account (email, hashed password + salt)
- `sessions` — one row per active login (token, user, expiry)
- `projects` — one row per project name, scoped to the user who created it (`UNIQUE(user_id, name)` — two users can each have a project called "River Bridge")
- `snapshots` — one row per analysis run, with the score and breakdown
- `issues` — one row per flagged issue, linked to the snapshot it came from, with a status field for tracking resolution

This is genuinely persistent (survives restarts, unlike the browser-storage version) but is still a single SQLite file on one machine — see `docs/infrastructure-roadmap.md` in the main repo for what's needed to make this properly multi-tenant at scale (real Postgres, hosted, role-based access).

## What this does NOT yet include

- **Role-based access / orgs** — every user only sees their own projects; there's no team/workspace concept yet where multiple people share the same project (see the roadmap's "Authentication and multi-tenancy" section).
- **Password reset / email verification** — signup and login only. No email sending is wired up.
- **File upload size limits / virus scanning** — the multipart parser here is intentionally minimal; swap in a real library (e.g., `busboy`) before accepting uploads from untrusted users.
- **MPP (MS Project) parsing** — still XER and CSV only. MPP needs a library like `mpxj`.

## Frontend

`public/index.html` is the real, wired frontend — open `http://localhost:3000/` after starting the server and it's fully live: uploads go to `/api/analyze`, trends and portfolio pull from the real database, and issues can be marked resolved with a button that calls `PATCH /api/issues/:id`. This has been tested end-to-end (screenshotted and verified working, not just written).

The original `app/index.html` in the repo root is the earlier browser-storage-only version — kept for reference, but `backend/public/index.html` is the one to actually use and build on from here.

## Tested

Verified working end-to-end during development: XER upload → snapshot + issues saved correctly (matches the browser prototype's DCMA-style checks), CSV upload path, project history endpoint, portfolio rollup, and issue status updates. Auth was verified end-to-end too: signup, login (including wrong-password rejection and duplicate-email rejection), logout, and — the important one — that a second user cannot see or modify a first user's projects or issues (`/api/projects`, `/api/portfolio`, and `PATCH /api/issues/:id` were all confirmed to reject or 403 cross-user access), tested both via curl and by driving the actual login/signup/upload/logout flow in a real browser. Not yet covered by an automated test suite — that's a reasonable next addition.
