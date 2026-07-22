---
status: DRAFT — pending founder approval
slug: /blog/what-is-schedule-health-scoring
title_tag: "What Is a Schedule Health Score? | Ordo7"
meta_description: "A schedule health score is a 0-100 number built from real DCMA-style checks on your P6 or MS Project file. Here's exactly what it measures, dimension by dimension."
target_query: schedule health score
word_count: 1406
---

# What Is a Schedule Health Score? (And Why One Number Actually Helps)

A schedule health score is a single 0-100 number that tells you how structurally sound your project schedule is, computed from a set of objective checks run against the actual logic, float, constraints, and milestones in your Primavera P6 or MS Project file — not a gut-check, and not a grade on whether the project itself is going well. It's a grade on whether the *schedule* is built the way a schedule is supposed to be built, so that everything else you read off it (dates, float, the critical path) is trustworthy in the first place.

## Why One Number, When Schedule Quality Is So Many Things

A real schedule review means running a stack of separate checks — is the logic connected, is float behaving, are there hard constraints lying around, are milestones anchored to anything — and then holding all of that in your head at once. That's fine if you're a full-time project controls analyst with an afternoon free. It's not fine if you're a PM with fifteen minutes before a status meeting who just needs to know: is this schedule okay, or is it hiding something?

That's the job a single score does. It's not a replacement for the detail — it's a triage signal. A low score tells you to stop and look before you trust anything else in the file. A high score tells you the foundation is sound enough to move on to the parts of the conversation that actually matter, like whether the work itself is on track.

**Takeaway:** treat the score as a "should I dig in" signal, not a final verdict — the dimension breakdown underneath it is where the real diagnosis happens.

## Logic Quality — Is the Network Actually Connected?

Logic quality asks the most basic question a schedule can be asked: is every activity actually wired into the network, with something driving it and something depending on it? It's built from two checks: activities with no predecessor and no successor at all (schedulers call these "open ends"), and activities that started before their predecessor actually finished — a sign the plan's sequencing has quietly come apart from reality.

A good result means almost nothing in the file is floating free of the network. A bad result usually means a chunk of activities were added late, copy-pasted from a template, or updated by hand without anyone re-linking them.

**Construction example:** a "submittal review — HVAC equipment" activity sitting in the schedule with no predecessor and no successor. It can slip by three weeks and nothing downstream reacts, because nothing downstream is actually watching it — the finish date won't move even though real work behind it is late.

**Takeaway:** open ends are the cheapest fix in the whole schedule — find them and tie them into the network before anything else.

## Float Distribution — Is Slack Spread Sensibly?

Total float (TF) — the number of days an activity can slip before it delays the project finish — is supposed to sit in a reasonable middle range. Float distribution checks both edges of that range: activities that have already gone negative (meaning they're already behind and eating into the project finish date), and activities carrying an unusually large amount of float, more than roughly 44 working days, the general DCMA scheduling guidance threshold for "high float."

Negative float is an urgent, already-happening problem. Excessive float is a quieter one — it usually doesn't mean an activity genuinely has two months of slack, it means logic is missing somewhere and the schedule engine can't see what should actually be constraining it.

**Construction example:** a foundation pour activity sitting at -12 days of float means the whole project finish is already slipping. An "interior finishes — level 3" activity sitting at 210 days of float almost certainly isn't really that flexible — it's more likely missing a tie to the activities that should be driving it.

**Takeaway:** don't just watch the critical path — a pile of suspiciously high-float activities is often the same missing-logic problem wearing a different disguise.

## Constraint Hygiene — Not Just About Constraints

This one is worth being precise about, because the name undersells what it actually measures: it's built from *two* separate checks — hard, date-locking constraints (a "mandatory start" or "mandatory finish" date, sometimes labeled MSO/MEO in P6), and activities with unusually long durations, again using the same roughly 44-working-day guidance threshold. Both are DCMA-style checks about how an activity is *built*, but only one of them is technically a "constraint" — the long-duration check is really about whether work is broken down into pieces small enough to actually track, and it's grouped in here because both problems come from the same root cause: activities built the way a scheduler found convenient in the moment, rather than the way good scheduling practice recommends.

A hard constraint overrides the schedule's own logic — the date holds regardless of what upstream work actually does, which defeats the entire point of a logic-driven network. A long-duration activity hides progress: if "structural steel erection" is one 90-day line item, you have no idea whether it's 10% or 90% done until someone tells you directly, because the schedule itself can't show partial progress on something that granular.

**Construction example:** a "final inspection" activity with a mandatory finish constraint locking it to a date set in a contract, disconnected from whether the work driving up to it is actually going to be done by then.

**Takeaway:** hunt for hard constraints first — they're usually a handful of activities and each one is a specific, findable override. Long-duration activities take more work to break down, but flag them the same way.

## Milestone Health — the Optional Fourth Dimension

Milestones get their own check, separate from ordinary activities, because a zero-duration point in time doesn't have a "duration" or "float" the same way a task does — so the long-duration and excessive-float checks don't apply to them. A milestone gets flagged if it has no predecessor or successor (it's not actually anchored to anything real happening around it), or if it's carrying negative float (it's already behind).

This is the one dimension that's genuinely optional: if a given schedule file has zero milestones in it, there's nothing to score, and Ordo7 shows a dash rather than inventing a number that implies "milestones are fine" when there simply aren't any to check.

**Construction example:** a "Substantial Completion" milestone sitting with no logic tying it to any of the actual finishing work — it exists in the schedule as a date, not as something the rest of the plan is actually building toward.

**Takeaway:** if your schedule has milestones, check that every one of them is actually load-bearing — connected to real logic, not just placed on a calendar.

## How the Four Pieces Add Up to One Score

Here's the part that's easy to assume and worth getting exactly right: the overall 0-100 score is **not** a simple average of the four dimension scores above. It's calculated independently, directly from the full list of issues found across every check, weighting critical-severity issues (negative float, missing logic, out-of-sequence work) four times as heavily as risk-level issues (excessive float, hard constraints, long duration), as a share of total activity count. The four dimension breakdowns are a separate, plainer read of the same underlying issues — each one is just "what percentage of relevant activities are clean" for that group, with no severity weighting at all.

The practical effect: it's possible for the overall score to look worse than any single dimension score suggests, because a small number of critical issues concentrated in one dimension pull the overall number down hard, even while the dimension breakdown for that same category still shows a reasonably high percentage clean. Use the overall score to decide whether to look closer. Use the four dimensions — and the DCMA-14 checks behind them — to find out exactly where.

For the full picture of what a real DCMA-style schedule assessment checks (this covers four of the core concerns; the complete methodology runs fourteen points), see [the DCMA 14-point check guide](/blog/dcma-14-point-check-guide).

## See Your Own Score

The fastest way to know where your schedule actually stands on all four of these is to run it through the checks yourself. Upload a `.xer`, MS Project XML, or CSV export to Ordo7 and get the breakdown — logic, float, constraints, and milestones — in plain language, in the time it takes to read this sentence.

---

## Claim → Source Table

| Claim in article | Source |
|---|---|
| Overall 0-100 score formula: critical issues weighted 4x, risk issues weighted 1.5x, as a share of total activity count | `analyze.js`, `scoreFrom()`, lines 47–53 |
| Overall score is computed independently, not as an average of the four dimension sub-scores | `analyze.js`, lines 220–224 (`analyzeXER`) — `scoreFrom()` and `subScoresFrom()`/`milestoneHealthFrom()` are separate, sibling calls on the same `issues`/`total`, not composed from each other |
| Each dimension score = percentage of activities "clean" for that group, no severity weighting | `analyze.js`, `pct()`, lines 55–58 |
| Logic quality = missing logic (open ends) + out-of-sequence issues | `analyze.js`, `subScoresFrom()`, lines 74–83 (`logicIssues`, line 76 and 80); underlying checks at lines 192–195 (missing logic) and 209–217 (out of sequence) |
| Float distribution = negative float ("already behind") + excessive float (>44 working days) | `analyze.js`, `subScoresFrom()`, lines 74–83 (`floatIssues`, line 77 and 81); underlying checks at lines 188–191 (negative float) and 196–199 (excessive float, `tf / 8 > 44`) |
| Constraint hygiene = hard constraints (MSO/MEO) + long-duration activities (>44 days) — bundles two distinct concerns under one name | `analyze.js`, `subScoresFrom()`, lines 74–83 (`constraintIssues`, line 78 and 82) and code comment lines 72–73; underlying checks at lines 205–208 (hard constraint) and 200–204 (long duration, `drtn / 8 > 44`) |
| Milestone health is optional/nullable — shows "—" (not a fabricated 100) when a file has zero milestones | `analyze.js`, `milestoneHealthFrom()`, lines 60–64; called at line 222 with `totalMilestones` from the per-file milestone loop (e.g. lines 163–181 in `analyzeXER`) |
| Milestone flags = no predecessor/successor OR negative float, not the ordinary-activity checks | `analyze.js`, milestone branch, lines 163–181 (`analyzeXER`); mirrored at lines 279–293 (`analyzeCSVTasks`) and lines 419–432 (`analyzeMspXml`) |
| 44-working-day threshold used for both excessive float and long duration | `analyze.js` lines 196, 202 (XER); same threshold reused at lines 305, 309 (CSV) and 447, 451 (MSPDI) |
| DCMA 14-point schedule assessment is the named external standard behind these checks | Defense Contract Management Agency, publicly documented 14-point schedule health assessment methodology (industry-standard reference for float/logic/constraint/duration checks; no specific external URL cited here — see cornerstone post for full methodology) |
| Cornerstone link target | `/blog/dcma-14-point-check-guide` — per task instruction; not yet a live post in `blog-content.js` as of this draft (planned per `docs/founder-log-calendar.md`, Slot C / SEO backlog note) — flagging so the founder can confirm it's live before this post publishes |
