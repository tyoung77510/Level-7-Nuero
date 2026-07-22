---
status: DRAFT — pending founder approval
slug: /blog/missing-logic-open-ends
title tag: Missing Logic: Finding Open Ends
meta description: An open end in a P6 schedule is an activity with no predecessor or successor. Here's why it breaks float and the critical path, and how to find and fix it.
target query: open ends p6 schedule
word count: ~980 words (body only, excludes this header and the source table)
---

# Missing Logic: Finding Open Ends

An open end in a Primavera P6 (the scheduling software most capital-projects teams run on) schedule is an activity or milestone that's missing a predecessor, a successor, or both — a task sitting in the network with nothing driving it and nothing depending on it. It looks like part of the plan. It isn't actually connected to it.

## What Counts as an Open End

Every activity in a sound schedule should have two things: something that has to happen before it can start (a predecessor), and something that depends on it finishing (a successor). When either one is missing, the industry term is "open end," sometimes called a "dangling" activity.

This is DCMA Check 1 — Logic, the first of the 14 checks in the DCMA (Defense Contract Management Agency) 14-point schedule assessment, a widely used schedule-quality standard in government and capital-projects work. The way DCMA defines it, an activity is flagged the moment it's missing *either* a predecessor *or* a successor — not only when it's missing both. As ScheduleReader's summary of the standard puts it: "Logic measures the percentage of incomplete tasks missing a predecessor or successor — called 'dangling' activities."

**Takeaway:** if you're checking your own schedule against the DCMA standard by hand, the bar is "missing one end," not "missing both ends."

## Why Open Ends Break Float and the Critical Path

Float — more precisely total float (TF), the number of days an activity can slip before it delays the project finish — is calculated by walking the network forward and backward through every logic tie. An activity with no successor has nowhere for that backward pass to land. P6 has no choice but to treat its late finish as the project finish date itself, which usually hands it a huge, meaningless float number. An activity with no predecessor has the mirror problem on the forward pass.

Either way, the float number you're looking at stops meaning anything, and so does the critical path built from it. An open-ended activity can slip for weeks and the schedule won't react — nothing downstream is watching it, because nothing downstream is *tied* to it. The finish date stays green while the real work behind it quietly falls behind.

**Takeaway:** if a total float number looks suspiciously large, check the activity's logic before you trust the float.

## How to Find Open Ends in P6

You don't need a script for this — P6 already has the columns. In the Activities view:

1. Add the **Predecessors** and **Successors** columns (or use the Predecessors/Successors tabs in Activity Details for a single activity).
2. Group or sort by whichever column is blank. An activity with an empty Predecessors cell, an empty Successors cell, or both, is an open end.
3. Cross-check against Total Float: activities with unusually high float (well beyond what the rest of the schedule shows) are worth a second look even if a column isn't literally blank — a bad relationship type can produce the same symptom as a missing one.

On a schedule of any real size — a few hundred activities or more — this is a five-minute scan, not a research project. The bug is almost always the same shape: a handful of activities quietly floating free while everything else in the network is tied together correctly.

**Takeaway:** sort by blank Predecessors, then blank Successors — that's the whole check.

## Fixing Open Ends With Sound Logic

The fix is always the same: give the activity a real relationship, in the direction the work actually flows — not just any link that makes the blank cell go away.

Two examples that show up constantly in construction schedules:

- **A permit or approval activity with no successor.** "Permit Approval" finishes, and nothing in the schedule is waiting on it — but the foundation pour obviously can't start until the permit's in hand. The fix is a finish-to-start (FS) relationship, the most common link type in a schedule — meaning the successor can't start until the predecessor finishes — from "Permit Approval" to "Foundation Pour."
- **A long-lead procurement activity with no successor.** "Switchgear Procurement — Long Lead" gets entered so the schedule shows when the order goes in, but nobody ties the delivery to the installation activity that actually needs the equipment. If that link is missing, the schedule can show "on track" right up until the switchgear doesn't show up and installation has nothing to start from.

In both cases the missing link isn't a data-entry afterthought — it's the one piece of information that makes the float number, and the critical path, mean something. Add the relationship, and the schedule can finally tell you whether that permit or that delivery is actually threatening the finish date.

**Takeaway:** every open end you close should tie to the specific downstream activity that depends on it — not just to the nearest convenient neighbor.

## What Ordo7 Actually Checks Today

In the interest of not overselling this: Ordo7's engine applies the full DCMA "missing either end" threshold to milestones — a milestone is flagged if it's missing a predecessor *or* a successor. For regular activities, the current check is narrower: it only flags an activity when it's missing *both* a predecessor *and* a successor. That means an activity with a predecessor but no successor (like the procurement example above) won't currently get flagged by Ordo7 as an open end, even though it is one by the DCMA standard. This is a known gap on our list to close, not a design choice — worth knowing if you're using Ordo7 alongside a manual DCMA check rather than in place of one.

If you want the full walkthrough of all 14 DCMA checks, start with [the DCMA 14-point check guide](/blog/dcma-14-point-check-guide) — Logic is check 1, and it's the one everything else depends on.

Upload a schedule to Ordo7 and see what it finds in yours — no Primavera analyst required.

---

## Claim → Source Table

| Claim in post | Source |
|---|---|
| DCMA Check 1 (Logic) flags an activity/task missing *either* a predecessor *or* a successor ("dangling" activity) | ScheduleReader, "What is the DCMA 14-Point Assessment? [Metrics & Formulas]" — https://schedulereader.com/dcma-14-point-assessment-project-schedule-quality-analysis/ — quoted: "Logic measures the percentage of incomplete tasks missing a predecessor or successor — called 'dangling' activities." |
| Ordo7 flags a **milestone** as an open end if it's missing a predecessor **or** a successor | `backend/src/analyze.js`, `analyzeXER()`, lines 170–174: `if (!hasPredecessor \|\| !hasSuccessor) { issues.push({ name: activityName + ' milestone has no predecessor or successor', ... }); }` |
| Ordo7 flags a **regular activity** as an open end only if it's missing a predecessor **and** a successor (narrower than the DCMA standard) | `backend/src/analyze.js`, `analyzeXER()`, lines 192–195: `if (!predCount[t.task_id] && !succCount[t.task_id]) { issues.push({ name: name + ' has no predecessor or successor', sub: 'Activity ' + code + ' · missing logic', sev: 'crit' }); ... }` |
| DCMA (Defense Contract Management Agency) 14-point schedule assessment is the standard being referenced | ScheduleReader, same article as above, and general public documentation of the DCMA 14-Point Assessment (a standard used across DoD and capital-projects scheduling practice) |

