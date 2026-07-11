# Schedule health

A tool that tells project controls analysts and PMs what's actually wrong with their schedule, in plain language, in one upload.

## The problem

Schedule quality checks (DCMA 14-point, EVM metrics) live in expensive, clunky tools like Primavera Risk Analysis and Acumen Fuse. Most analysts either don't run these checks or do them by hand in Excel every reporting cycle. The tools that exist are built for auditors, not for someone trying to get a status report out by 5pm.

## The bet

Make it radically easier to use than anything else in the category:
- Drag a file in, get a plain-language answer back. No setup, no field mapping, no config screens.
- Translate jargon into sentences ("you're running 2 weeks behind") with the technical numbers one click away for people who want them.
- One primary action per screen: Upload → Health → Issues → Report.

See `docs/design-notes.md` for the full reasoning behind the UX decisions.

## What's in this repo right now

`app/index.html` is a working, single-file prototype. Open it in any browser — no build step, no server.

It currently:
- Parses real Primavera `.xer` exports (TASK and TASKPRED tables) directly in the browser
- Runs genuine schedule-health checks: negative float, missing logic, excessive float (>44 days), long durations, hard constraints, out-of-sequence progress
- Computes a 0–100 health score and a healthy/at-risk/critical breakdown
- Accepts a fallback `.csv` format for schedules not exported from P6
- Persists analysis history per project (via browser storage) to show trends over time
- Rolls multiple projects up into a portfolio view
- Generates a printable/exportable status report

This is a **prototype**, not production software. See "Known limitations" below before extending it.

## Architecture (current state)

Everything lives in one HTML file for now — deliberately, to keep the prototype trivially shareable and runnable with zero setup:

- Vanilla JS, no framework, no build step
- `parseXER()` / `parseCSV()` — file parsing
- `analyzeXER()` / `analyzeCSV()` — the rules engine that produces issues + score
- `render*()` functions — DOM rendering for each screen
- Browser storage (`window.storage` in the Claude artifact environment, or `localStorage` if run standalone) for snapshot history

## Known limitations (read before building further)

- **CPI/SPI are not computed.** True EVM metrics need budgeted cost and actual cost data, which most schedule-only exports (XER) don't include. That needs either a cost-system integration (e.g., SAP, Oracle) or the user entering cost data separately. Don't fake these numbers — flag them as unavailable until real cost data is wired in.
- **Out-of-sequence detection is a simplified heuristic** (checks presence/absence of actual dates, not full date-logic validation). A production version should compare actual dates against the network logic properly.
- **The CSV fallback expects specific column names.** It's a stopgap for schedules that don't come from P6, not a general-purpose importer.
- **No auth, no multi-user, no backend.** Storage is local to the browser/session. This is fine for a prototype, not for a real product with more than one user per org.
- **The XER parser handles the common case**, not every P6 configuration (e.g., custom fields, resource-loaded schedules aren't parsed yet).

## Infrastructure needed beyond the prototype

See `docs/infrastructure-roadmap.md` for the full plan: auth, real EVM/cost integration, automated ingestion, notifications, audit trail, and security/compliance.

**Step 1 (real backend + database) is done, tested, and wired end-to-end.** `backend/` has a working API with a persistent SQLite database, and `backend/public/index.html` is the real frontend talking to it live — upload, health score, issues (with a working "mark resolved" button), trends, and portfolio all pull from the real server. Run `node backend/src/server.js` and open `http://localhost:3000/`.

The original `app/index.html` (browser-storage-only) is kept for reference but is no longer the one to build on — start from `backend/` instead.

## Suggested next iterations, roughly in order

1. **Harden the XER parser** against real-world exports (multiple projects per file, resource assignments, calendars for accurate float-to-days conversion instead of assuming 8-hour days).
2. **Real EVM support** — accept a cost import (CSV from the org's ERP) and compute actual CPI/SPI/EAC instead of schedule-only proxies.
3. **Move state off the browser** — a real backend (even lightweight, e.g. Postgres + a thin API) so trend history survives across devices/users and multiple people on a team can see the same portfolio.
4. **Auth + multi-tenant** — once more than one person needs to see the same projects.
5. **MPP (MS Project) support** — likely via a library like `mpxj` server-side, since MPP is a binary format that's much harder to parse in-browser.
6. **Monte Carlo risk simulation** — a v2 feature per the original product brainstorm; needs the schedule network graph, which the XER parser already extracts.

## Getting this into git

```bash
git init
git add .
git commit -m "Initial schedule health prototype"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

## For agents/contributors picking this up

Read `docs/design-notes.md` first — the UX principles (plain language over jargon, one action per screen, progressive disclosure) aren't optional polish, they're the actual product thesis. Any new feature should be evaluated against "does this stay out of the way until someone needs it."
