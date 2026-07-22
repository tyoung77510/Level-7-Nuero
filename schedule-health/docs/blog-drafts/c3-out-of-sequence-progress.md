---
status: DRAFT — pending founder approval
slug: /blog/out-of-sequence-progress
title tag: Out-of-Sequence Progress: Causes and Fixes
meta description: "Out-of-sequence progress means an activity is reported ahead of what its predecessor logic allows. Here's why it happens in P6, why it distorts float, and how to fix it."
target query: out of sequence progress
word count: ~1,010
---

# Your Schedule Says This Can't Start Yet. The Field Says It Already Did.

Out-of-sequence progress is what happens when an activity gets marked started or complete before its predecessor's logic says it's allowed to — a concrete pour reported "in progress" while the excavation it depends on hasn't finished, a wall going up before the inspection that's supposed to gate it. The schedule's network logic says one thing has to happen before another; the field update says it didn't work out that way. That gap is out-of-sequence progress, and it's one of the more common ways a schedule that looks fine on a status report is quietly lying to you.

## What out-of-sequence progress actually means

Every activity in a well-built schedule sits inside a chain of logic: a predecessor that has to happen first, a successor that depends on it finishing. Out-of-sequence progress shows up specifically on Finish-to-Start relationships — the most common link type, where Activity B isn't supposed to start until Activity A finishes. When B gets an actual start date while A is still open, the two don't agree anymore. Primavera P6 (Oracle's project-scheduling software, the standard on most capital construction and DCMA-compliant programs) and the DCMA 14-point assessment (a set of schedule-health checks originally developed by the Defense Contract Management Agency, now used broadly across construction and project controls) both treat this as a real defect, not a rounding error — it's one of the 14 checks in that assessment.

**Takeaway:** if an activity has an actual start date but its Finish-to-Start predecessor doesn't have an actual finish date yet, you're looking at out-of-sequence progress — full stop, regardless of how good the rest of the schedule looks.

## Why it happens: the field doesn't wait for the network diagram

Out-of-sequence progress isn't usually a data-entry mistake. It's what happens when field reality moves faster, or in a different order, than the logic anticipated. A sub gets ahead on rough-in because access opened up early. A punch item nobody counted on holding up the finish crew gets waived so work can keep moving. The plan assumed a strict order; the job site found a faster or just different one.

P6 has two settings that decide what the schedule *does* with that gap when it recalculates, and picking the wrong one for your situation makes the distortion worse, not better:

- **Retained logic** keeps the predecessor relationship in force for whatever *remaining* duration is left on the predecessor — even though the successor already started. It's conservative, but it can produce dates that don't match what's actually happening in the field.
- **Progress override** lets the successor's actual progress stand and effectively ignores the unfinished predecessor relationship for scheduling purposes going forward.

Neither setting fixes the underlying problem — they just decide how the schedule copes with it. (Oracle's own Primavera P6 documentation covers this scheduling option in detail if you want the full mechanics.)

**Takeaway:** don't just toggle retained logic vs. progress override to make the dates look better — go find out *why* the field got out of sequence in the first place. The setting is a symptom-management tool, not a fix.

## Why it distorts your critical path and float

This is the part that actually costs you. Total float and the critical path are both calculated from the network logic — what's actually driving what. When an activity's real-world progress no longer matches its logic, the float and critical-path calculations downstream of it are being computed against a network that no longer reflects what's true. An activity might show healthy float it doesn't really have, because the calculation still assumes a predecessor relationship that field progress has already broken. Or the reported critical path quietly shifts to a chain of activities that isn't actually what's driving the finish date anymore.

Left uncorrected, out-of-sequence progress compounds. Every recalculation after the first out-of-sequence update inherits the same distortion, and a scheduler trusting the critical path at face value ends up managing the wrong activities.

**Takeaway:** treat every out-of-sequence flag as a signal to re-verify float and critical path on everything downstream of it, not just the one flagged activity.

## How to find it in P6

In P6, run the schedule log or a filter for activities with an actual start date whose Finish-to-Start predecessor has no actual finish date — that combination is the definition of out-of-sequence progress, and it's exactly what a DCMA-style check 4 (Relationship Types) pass is looking for. Most schedulers catch it during the routine update review, activity by activity, which is exactly the kind of check that's easy to skip when there are 2,000 activities and a status meeting in twenty minutes.

This is currently where Ordo7 fits in: today, Ordo7's out-of-sequence check runs specifically on **Primavera P6 `.xer` files** (P6's native export format). It looks for the exact pattern above — a Finish-to-Start predecessor relationship where the predecessor has no actual finish date but the successor already has an actual start date — and flags it as a critical issue. That check is not yet implemented for the CSV or Microsoft Project XML import paths Ordo7 also accepts; if you're working from one of those formats, this specific check won't run on your file yet. We're saying that plainly rather than letting you assume broader coverage than what's actually built.

**Takeaway:** if you're scheduling in P6 and exporting `.xer`, this is a check you can automate instead of eyeballing row by row. If you're on CSV or MSP XML today, keep doing this one manually until that coverage lands.

## How to fix it

Fixing out-of-sequence progress means going back to the logic, not just the dates. Talk to the field about why the sequence didn't hold — was the original logic wrong, was there a real acceleration, was a step skipped that shouldn't have been? Then either correct the relationship (add a lag, change the relationship type, or split the activity to reflect what actually happens in what order) or correct the field process so the real sequence matches the plan going forward. A schedule that's been "fixed" by just picking retained logic or progress override without addressing the why will keep generating the same distortion on the next update.

For the rest of the DCMA-style checks Ordo7 runs — missing logic, negative float, hard constraints, and more — see the full walkthrough in our [DCMA 14-point check guide](/blog/dcma-14-point-check-guide).

If you're carrying a P6 schedule right now and want to see where your own out-of-sequence flags are, upload the `.xer` file to Ordo7 and get a plain-language read on it in a few minutes.

---

## Claim → source table

| Claim | Source |
|---|---|
| Ordo7's out-of-sequence check runs on Finish-to-Start (`PR_FS`) predecessor relationships, flagging an activity as out-of-sequence when its predecessor has no `act_end_date` but the activity itself has an `act_start_date` | `backend/src/analyze.js:209-217` |
| This check exists only in `analyzeXER` (the `.xer`/Primavera P6 parser) — `analyzeCSVTasks` and `analyzeMspXml` contain no equivalent out-of-sequence logic | `backend/src/analyze.js:227-319` (CSV parser, no out-of-sequence check present), `backend/src/analyze.js:368-462` (MSPDI/MS Project XML parser, no out-of-sequence check present) |
| Out-of-sequence progress is flagged as a critical-severity issue (`sev: 'crit'`) | `backend/src/analyze.js:213-214` |
| Out-of-sequence work is grouped under Ordo7's "logic quality" sub-score alongside missing logic | `backend/src/analyze.js:76` |
| DCMA 14-point assessment includes Relationship Types (Finish-to-Start dominance) as one of its 14 checks | Defense Contract Management Agency, DCMA 14-Point Assessment methodology — publicly documented industry-standard schedule-health checklist, referenced generically per brand guidelines (no specific numbered citation fabricated) |
| P6's retained logic vs. progress override scheduling options govern how remaining duration is calculated for an out-of-sequence successor | Oracle Primavera P6 Professional/EPPM documentation, "Scheduling Options" (retained logic / progress override) — Oracle's own product documentation, not independently re-verified line-by-line in this draft; flag for founder to confirm exact current-version wording before publish if precision matters |
