---
status: DRAFT — pending founder approval
slug: /blog/negative-float-p6
title tag: How to Fix Negative Float in Primavera P6
meta description: Negative float in P6 means your schedule can't hit its finish date as currently logic-driven. Here's why it shows up, how to find it, and how to fix it.
target query: negative float p6
word count: ~1,230 words (body only, excludes header/footer/table)
---

# How to Fix Negative Float in Primavera P6 (Before It Fixes Your Finish Date for You)

Negative float in Primavera P6 (P6) means one or more activities have a total float (TF) value below zero — the schedule's math is telling you that, given the logic and dates sitting in the file right now, the project (or some milestone inside it) is forecast to finish *after* the date it's supposed to. It's DCMA (Defense Contract Management Agency) schedule-health check #7 out of 14, and it's the bluntest one on the list: there's no version of "a little negative float is fine." If it's there, the schedule as currently built can't produce an on-time finish.

I've been staring at P6 schedules for 8+ years, and negative float is the one number that never lies to you gently. Everything else in a schedule review can get argued about — is 40 days of float too much, is a lag defensible, is a constraint reasonable. Negative float doesn't leave room for that conversation. It just says: as logic-driven, this is late.

## What negative float means for your finish date

Total float (TF) is the amount of time an activity can slip before it pushes out the project finish date (or the next constrained milestone downstream of it). Positive float means there's room. Zero float means the activity is on the critical path — any slip there is a day-for-day slip on the finish. Negative float means there's no room left and some slip has *already* happened, at least according to the schedule's own logic and dates.

The direct consequence: if nothing changes, the activity — and by extension the milestone or finish date it drives — is calculated to land after its required date. Not "at risk of." Actually forecast to. That's the whole reason DCMA treats it as a fail-condition rather than a warning: it's not measuring risk, it's measuring a schedule that's mathematically already behind.

**Takeaway:** the first thing to check isn't the individual activity with the worst TF number — it's whether the project finish milestone itself has negative float. That tells you whether this is a local problem or the whole schedule is off the rails.

## Why negative float shows up in a P6 schedule

Negative float isn't random. In a real P6 file it almost always comes from one of three places:

**Date constraints fighting logic.** A hard constraint — Must Finish On, Start On or Before, Finish On or Before — forces an activity or milestone to a fixed date regardless of what the network logic calculates. If the logic-driven path to that point actually needs more time than the constraint allows, P6 doesn't move the constraint. It shows you negative float instead, as its way of saying "the plan and the deadline disagree."

**Imposed finish dates.** Related but worth calling out separately: a contract milestone, a regulatory date, or a client-mandated finish gets typed in as a constraint before the underlying activities are actually sequenced to support it. The date goes in first, the logic gets built (or half-built) after. Negative float shows up the moment the two don't match.

**Out-of-sequence work.** An activity gets marked in-progress or complete before its predecessor logic says it's allowed to start — common on fast-moving field work where the schedule update lags the actual work by a few days. P6's out-of-sequence logic options (retained vs. progress override) can quietly manufacture negative float on downstream activities that never had a real problem, just a scheduling artifact.

**Takeaway:** before you touch a single date, filter your activities by constraint type. If the negative float clusters around Must Finish On or Finish On or Before constraints, you've probably found the actual cause in under five minutes.

## How to diagnose negative float in P6

Diagnosis is mechanical, which is the good news:

1. Add the **Total Float** column to your activity table (or use the built-in filter for it) and sort ascending. Everything below zero is your list.
2. **Group by** the project finish milestone's driving path — trace backward from the finish (or the nearest constrained milestone) rather than starting from a random negative-float activity in the middle of the network. The root cause is usually upstream of where the worst number shows up.
3. Cross-reference against the **constraint type** and **relationship type** columns for every activity on that list. A hard constraint sitting a few activities downstream of a long chain of logic is the single most common pattern.
4. Check whether the negative float is new this update or has been there for several — a persistent negative float that nobody's addressed is a different conversation than one that just appeared.

**Takeaway:** trace from the finish backward, not from the worst number forward. It's faster and it actually finds the driver instead of a symptom.

## How to fix negative float

Once you know *why* it's there, the fix is usually one of a few moves — not a mystery, just a decision.

**Example 1 — concrete cure vs. a constrained milestone.** Say a foundation pour has a 7-day cure activity before the next trade can mobilize, but the schedule has a Finish On or Before constraint on the steel-erection milestone that assumes cure finishes in 3. The logic is honest — cure takes 7 days no matter what the schedule says — so the fix isn't to shrink the cure activity, it's to either move the constraint to reflect reality or resequence upstream work to buy back the 4 days some other way (earlier pour date, overlapping prep work that doesn't depend on cure).

**Example 2 — steel erection pushed past a constrained milestone.** A steel package is logically ready to start on day 40, but a Must Start On constraint on a downstream inspection milestone was set based on an earlier plan where steel started on day 30. The steel activity itself isn't the problem — the constraint is stale. Update the constraint to match the current logic-driven plan, or if the date really is fixed contractually, that's your signal to fast-track (overlap steel and inspection prep) or crash (add a shift, add a crew) the activities between now and that date.

In both cases the pattern is the same: negative float is the schedule telling you where the plan and a fixed date disagree. The fix is either changing the plan (resequence, fast-track, crash) or changing the date (renegotiate, correct a stale constraint) — never deleting the float by quietly loosening logic just to make the number look better. That just hides the problem from the next person who opens the file.

**Takeaway:** decide explicitly whether you're fixing the plan or fixing the date. Don't let a constraint edit be the accidental answer to that question.

Negative float is one of 14 checks in the DCMA schedule-health framework — if you want the full picture of what the other 13 catch, I put together a complete walkthrough: [The DCMA 14-Point Check Guide](/blog/dcma-14-point-check-guide).

If you want to see where negative float is actually sitting in your own schedule instead of hunting for it column by column, upload your P6, MS Project, or CSV export to Ordo7 and it'll flag every activity with negative total float automatically, in plain language, no analyst required.

---

## Claim → source table

| Claim in post | Source |
|---|---|
| Ordo7 detects negative float as total float (TF) below zero, on every activity across all three supported parsers (.xer, CSV, MSPDI) | `backend/src/analyze.js` — XER: line 186 (`const tf = parseFloat(t.total_float_hr_cnt);`) and line 188 (`if (!isNaN(tf) && tf < 0)`); milestone variant line 175 (`if (floatDays !== null && floatDays < 0)`). CSV: line 250 (`const tf = parseFloat(t.total_float_days);`) and line 297 (`if (!isNaN(tf) && tf < 0)`); milestone variant line 287. MSPDI: line 384 (`const floatDays = t.totalSlackMinutes != null ? ... `) and line 439 (`if (floatDays !== null && floatDays < 0)`); milestone variant line 427. |
| Negative float is DCMA check #7 of 14, defined as "if any of the Total Tasks have negative Total Float, then this metric awards the schedule a failing grade" | Ron Winter, PSP, *DCMA 14-Point Schedule Assessment* (Jan 7, 2011), p.11, "DCMA Check 7: Negative Float" — https://www.ronwinterconsulting.com/DCMA_14-Point_Assessment.pdf |
| The full 14-point list and that Negative Float is item #7 in sequence (Logic, Leads, Lags, Relationship Types, Hard Constraints, High Float, Negative Float, High Duration, Invalid Dates, Resources, Missed Tasks, Critical Path Test, CPLI, BEI) | Same source, p.3–4 |
| Total float definition (time an activity can slip before affecting the project finish or a constrained milestone), and hard-constraint types (Must Finish On, Must Start On, Start/Finish No Later Than) forcing dates regardless of logic | Same source, p.8 ("DCMA Check 5: Hard Constraints") — general CPM/P6 mechanics, consistent with standard P6 documentation |
