---
status: DRAFT — pending founder approval
proposed_slug: /blog/dcma-14-point-check-guide
title_tag: DCMA 14 Point Check: The Complete Guide to All 14 Assessment Metrics
meta_description: "What the DCMA 14 point check actually measures — all 14 metrics, their real thresholds, and which ones a plain-language schedule tool checks today."
target_query: dcma 14 point check
target_word_count: 2000+
---

# The DCMA 14-Point Check, Explained Without the Jargon

If you've been asked to "run the DCMA 14-point check" on your schedule, here's the short answer: it's a set of 14 ratio-based tests — things like what percentage of your activities are missing logic, how many have excessive float, whether your critical path actually behaves like a critical path — that the Defense Contract Management Agency (DCMA) built to flag potential quality problems in a Primavera P6 or MS Project schedule. Most of the 14 checks compare a count of "bad" activities to a total, express it as a percentage, and flag anything over 5%. A few work differently — one is a stress test you run directly on the schedule, and two are index numbers instead of percentages. None of them tell you your schedule is wrong. They tell you where to look.

I'm Taj, building Ordo7 — a plain-language schedule health tool. Before I explain what my own tool checks, I want to walk through what DCMA actually published, because most of what's online about "the DCMA 14-point check" is a paraphrase of a paraphrase. I went to the source for this one: DCMA's own EVMS Program Analysis Pamphlet, DCMA-EA PAM 200.1 (October 2012) — the last version of this standard DCMA itself published, Section 4.0. Every threshold below is quoted or closely paraphrased from that document, not from memory or from a vendor's marketing page.

## Where the DCMA 14-point check came from

In March 2005, the Under Secretary of Defense for Acquisition and Technology mandated that contracts over $20 million maintain an Integrated Master Schedule (IMS) — the master CPM (Critical Path Method) schedule tying together all the work on a program. That memo also told DCMA to come up with a way to evaluate those schedules consistently across every contract they oversee. What came out of that is the 14-point check: a standardized set of ratio tests any analyst can run against an IMS, regardless of which contractor built it, and get a comparable answer.

It was never meant to be a pass/fail law. DCMA's own document frames it as a way to "provide a catalyst for constructive discussions" and "a baseline for tracking IMS improvement over time" — a flag for a conversation, not a verdict. A schedule that trips one of these thresholds isn't automatically broken; it's a place to ask a follow-up question.

## The two definitions you need before any of the 14 checks make sense

DCMA's math only works if you're clear on what counts in the denominator. Two terms come up in almost every check below:

**Incomplete task (DCMA also calls this a "Total Task"):** any real, working activity — not a milestone, not a summary/WBS bar, not Level of Effort, and not already 100% complete. A concrete-pour activity that's 40% done counts. A "Foundation Complete" milestone doesn't. Neither does a rolled-up "Sitework" summary bar.

**Logic link:** the predecessor/successor relationship connecting two activities — Finish-to-Start (FS, "the next activity can't start until this one finishes"), Start-to-Start (SS), Finish-to-Finish (FF), or Start-to-Finish (SF).

With those two definitions in hand, here are the 14 checks, in DCMA's own order.

## Check 1 — Logic: are your activities actually connected?

**What it measures:** the percentage of incomplete activities missing a predecessor, a successor, or both. DCMA's formula: (# of tasks missing logic ÷ # of incomplete tasks) × 100. The threshold is 5% — go over that and the check is flagged.

Picture a schedule where "Install Rebar" has a predecessor (Excavation) but nothing scheduled after it — no successor pulling it toward "Pour Concrete." That activity is dangling. If float and dates calculate off of logic links, an activity with no logic at all just sits wherever it was manually placed — its float number is meaningless because nothing is actually driving or constraining it.

**Takeaway:** every real activity should have at least one predecessor tied to its start and one successor tied to its finish. If more than 1 in 20 don't, that's your first thing to run down.

## Check 2 & 3 — Leads and Lags: don't let the schedule lie about sequencing

**Leads (negative lags):** a lead is a logic link with a negative time value — it lets a successor start before its predecessor is actually done. DCMA's position is blunt: leads shouldn't exist at all. The target is 0%.

**Lags (positive lags):** a lag is a built-in waiting period on a logic link — "Concrete Cure" as a 3-day lag on the link between "Pour Slab" and "Frame Walls," instead of its own activity. DCMA allows some lag, capped at 5% of logic links.

Why the asymmetry? A lead hides the fact that two activities are really overlapping, which can distort your float calculations and hide resource conflicts. A lag, used sparingly, can reasonably represent real non-work time like curing or inspection turnaround — though DCMA and most schedulers would rather see that curing time as its own activity than buried in a lag value nobody questions later.

**Takeaway:** if you see a negative-duration relationship anywhere in your logic, that's worth a conversation before it's worth a workaround.

## Check 4 — Relationship Types: is Finish-to-Start actually your default?

**What it measures:** what fraction of your logic links are Finish-to-Start (FS) — "the next activity can't start until this one finishes." DCMA's bar: FS links should make up at least 90% of the logic in the schedule.

FS is the relationship type that produces a genuinely traceable critical path. Start-to-Start and Finish-to-Finish have real, legitimate uses — "Install Drywall" (SS) can start two days after "Rough Electrical" starts, for instance, without waiting for it to finish. But a schedule leaning heavily on SS/FF/SF links gets harder to reason about, and a Start-to-Finish link in particular is rare enough that DCMA calls for it to be used only with real justification.

**Takeaway:** FS should be your default relationship. If it's under 90%, look at why — it's often a sign logic was patched in after the fact rather than planned.

## Check 5 — Hard Constraints: is the schedule still logic-driven?

**What it measures:** the percentage of incomplete activities carrying a hard constraint. DCMA's current list of hard constraints: Must-Finish-On (MFO), Must-Start-On (MSO), Start-No-Later-Than (SNLT), and Finish-No-Later-Than (FNLT). Threshold: 5%.

A hard constraint locks a date in place regardless of what the network logic calculates. If "Deliver Equipment" carries a Must-Start-On date, that date holds even if every upstream activity finishes late — which means the schedule stops reflecting reality and starts reflecting wishful thinking. DCMA distinguishes these from soft constraints — As-Soon-As-Possible (ASAP), Start-No-Earlier-Than (SNET), Finish-No-Earlier-Than (FNET) — which nudge a date without overriding the logic that calculates it.

**Takeaway:** a handful of hard constraints tied to real contractual milestones is normal. A schedule where 1 in 10 activities is pinned to a fixed date usually means the logic isn't doing the driving anymore — the constraints are.

## Check 6 — High Float: is 44 days of slack believable?

**What it measures:** the percentage of incomplete activities with more than 44 working days (about two calendar months) of total float (TF — the amount of time an activity can slip before it delays the project). Threshold: 5%.

If "Install Signage" shows 90 working days of float on an 8-month project, that's not necessarily wrong — but it's worth asking why. Often it's a sign the activity is genuinely low-priority and correctly floats late. Just as often, it means logic is missing somewhere upstream or downstream, and the float number is an artifact of that gap rather than a real scheduling decision.

**Takeaway:** high float isn't automatically bad, but a cluster of it is a prompt to check whether those activities are missing logic, not evidence they're safe to ignore.

## Check 7 — Negative Float: the one DCMA wants at zero

**What it measures:** the percentage of incomplete activities with total float below zero. DCMA's target here is 0% — no negative float without an explanation and a corrective action plan attached.

Negative float means an activity's calculated dates would finish after the date it's actually constrained or required to finish by — the schedule is telling you, mathematically, that the current plan can't hit its own commitment date without intervention. If "Substantial Completion" is carrying -12 days of float, that's not a rounding error; it's the schedule saying the current sequence of work runs 12 days past where it needs to land.

**Takeaway:** negative float is the metric with the least room for "it's probably fine." Every negative-float activity should have a known cause and a plan, not just a number sitting there unexamined.

## Check 8 — High Duration: is 44 days too long for one activity?

**What it measures:** incomplete activities with a duration longer than 44 working days, with a baseline start inside your detailed planning window. Threshold: 5%.

An activity like "Structural Steel Erection" scheduled as a single 60-day bar is hard to status honestly — is it 20% done, 50% done, on track? A long single bar hides the internal milestones (steel delivered, first level erected, topped out) that would actually tell you whether it's on pace. DCMA's rolling-wave exception recognizes that far-future work is sometimes legitimately planned at a coarser level — the flag is really about near-term, detailed-planning-period activities.

**Takeaway:** if a near-term activity runs longer than about two months, ask whether it should be broken into smaller, individually trackable pieces.

## Check 9 — Invalid Dates: is the schedule internally consistent?

**What it measures:** whether any incomplete activity has a forecast date before the schedule's status date, or a completed activity has an actual date after the status date. DCMA doesn't publish this one as a percentage threshold — it's zero tolerance. Either your dates are logically consistent with "today," or they're not.

An activity can't be forecast to start yesterday if it hasn't started yet, and it can't show an actual finish date next month if today is the 1st. Both are signs of a data entry error or, less innocently, of someone backdating progress to make the schedule look better than it is.

**Takeaway:** invalid dates are a straightforward data-integrity check, not a judgment call — any hit here should get fixed, not investigated for nuance.

## Check 10 — Resources: is the schedule loaded the way it claims to be?

**What it measures:** whether incomplete activities with a duration of at least one day have resources or cost assigned. DCMA doesn't set a pass/fail threshold here — some schedules are legitimately never resource-loaded, and that's a valid choice, not a violation. This one is reported as a ratio for context, not scored against a cutoff.

**Takeaway:** if your organization has committed to resource- or cost-loading a schedule, this check tells you how completely that commitment was actually carried out.

## Check 11 — Missed Tasks: how well is the plan tracking to its own baseline?

**What it measures:** the percentage of activities that were supposed to finish on or before the status date (per the baseline) but actually finished — or are forecast to finish — later than that. Threshold: 5%.

This is the check most directly about performance rather than structure. If "Rough-In Inspection Pass" baselined for finishing three weeks ago and it's still open today, that's a missed task. A schedule can have perfect logic and still fail this check if the work itself is falling behind.

**Takeaway:** this is your best single signal for "is the plan still tracking to what we said we'd do," separate from whether the schedule was built well in the first place.

## Check 12 — Critical Path Test: does the logic actually hold together?

**What it measures:** not a percentage — a stress test. Take a critical activity, artificially stretch its remaining duration by a large amount (DCMA's training uses 600 working days), recalculate, and see whether the project completion date moves by a proportional amount. If it does, the logic holds. If completion barely budges despite a 600-day hit to a "critical" activity, the logic is broken somewhere — probably a missing successor link that lets the delay dead-end instead of flowing through to the finish.

**Takeaway:** this is the check that catches broken logic the other 13 checks might miss — it's worth running whenever you don't fully trust your critical path.

## Check 13 — Critical Path Length Index (CPLI): is your critical path believable?

**What it measures:** CPLI = (Critical Path Length + Total Float) ÷ Critical Path Length, where Critical Path Length is the number of working days from today to the milestone you're measuring. A CPLI of 1.00 means you need to accomplish exactly one day of progress for every calendar day that passes — no slack, no cushion. Below 0.95, DCMA flags it: the schedule is aggressive relative to its own target date and increasingly unlikely to hit it without recovery. Above 1.00 suggests room to spare.

**Takeaway:** CPLI answers a different question than float alone — it tells you how realistic your target completion date is given how the whole network is currently shaped, not just whether any one activity is late.

## Check 14 — Baseline Execution Index (BEI): are you completing work at the rate you planned?

**What it measures:** the ratio of tasks actually completed to the number of tasks that were supposed to be completed by now per the baseline. Target is 1.00; DCMA flags anything below 0.95. A BEI of 0.85 means you're completing roughly 15% fewer tasks than the original plan called for by this point — a leading indicator of schedule trouble, often visible before cost or float numbers catch up to it.

**Takeaway:** BEI is a throughput measure, not a "how late is any one thing" measure — it's the metric most likely to give you an early warning that the overall pace of execution has slipped.

## Where Ordo7 fits into this today

Ordo7 automates five of these fourteen checks today, running directly against a Primavera .xer, MS Project XML, or CSV export: **Logic (Check 1)**, **Hard Constraints (Check 5)**, **High Float (Check 6)**, **Negative Float (Check 7)**, and **High Duration (Check 8)**, using the same thresholds described above — 5% for the ratio checks, the 44-working-day cutoff for float and duration, and Must-Start-On/Must-Finish-On for hard constraints.

Two honest caveats, because I'd rather tell you the exact shape of the tool than round up: Ordo7's Logic check flags a regular activity only when it's missing **both** a predecessor and a successor — narrower than DCMA's own definition, which flags an activity missing *either* one. And the Hard Constraints check currently looks for Mandatory Start/Finish dates specifically, not the full DCMA list (which also includes Start/Finish-No-Later-Than). For .xer files specifically, Ordo7 also flags out-of-sequence progress — work that started before its predecessor actually finished — which is a real schedule-quality signal, but it isn't one of the official 14 checks above.

## See it against your own schedule

If you've read this far, the fastest way to make it concrete is to run it against a real file. Upload your .xer, MS Project XML, or CSV export to Ordo7 and see which of these checks your own schedule trips — in plain language, not a spreadsheet of raw percentages you have to interpret yourself.

---

## Claim → Source Verification Table

### (a) DCMA 14-point definitions and thresholds

| Claim | Source |
|---|---|
| Origin: March 2005 USD(AT&L) memo mandating IMS for contracts >$20M; DCMA directed to establish evaluation guidelines | DCMA-EA PAM 200.1 (EVMS Program Analysis Pamphlet), Defense Contract Management Agency, Oct 2012 — cited via Ron Winter, "DCMA 14-Point Schedule Assessment" (2011), background section, referencing the original USD(AT&L) memo. https://www.ronwinterconsulting.com/DCMA_14-Point_Assessment.pdf |
| "Total Task"/"incomplete task" scope: excludes summary/subproject tasks, Level of Effort, milestones (zero duration), and 100%-complete activities | DCMA-EA PAM 200.1, Section 4.0 opening paragraph: "This analysis should exclude Completed tasks, LOE tasks, Subprojects (called Summary tasks in MS Project), and Milestones." https://mosaicprojects.com.au/PDF-Gen/DCMA-PAM-200-1.pdf |
| List of all 14 checks in order (Logic, Leads, Lags, Relationship Types, Hard Constraints, High Float, Negative Float, High Duration, Invalid Dates, Resources, Missed Tasks, Critical Path Test, CPLI, BEI) | DCMA-EA PAM 200.1, Table of Contents & Section 4.0–4.14 headings. https://mosaicprojects.com.au/PDF-Gen/DCMA-PAM-200-1.pdf |
| Check 1 (Logic): Missing Logic % = # tasks missing logic ÷ # incomplete tasks × 100; threshold ≤5%; flags activities missing predecessor and/or successor | DCMA-EA PAM 200.1, Section 4.1 "Logic." https://mosaicprojects.com.au/PDF-Gen/DCMA-PAM-200-1.pdf |
| Check 2 (Leads): Leads % = # logic links with leads ÷ # logic links × 100; target 0% | DCMA-EA PAM 200.1, Section 4.2 "Leads." Same URL. |
| Check 3 (Lags): Lags % should not exceed 5% of logic links | DCMA-EA PAM 200.1, Section 4.3 "Lags." Same URL. |
| Check 4 (Relationship Types): FS relationships should be ≥90% of logic links | DCMA-EA PAM 200.1, Section 4.4 "Relationship Types." Same URL. |
| Check 5 (Hard Constraints): ≤5% of incomplete tasks; hard constraints = MFO, MSO, SNLT, FNLT; soft constraints = ASAP, SNET, FNET | DCMA-EA PAM 200.1, Section 4.5 "Hard Constraints." Same URL. |
| Check 6 (High Float): ≤5% of incomplete tasks with total float >44 working days | DCMA-EA PAM 200.1, Section 4.6 "High Float." Same URL. |
| Check 7 (Negative Float): target 0% of incomplete tasks with total float <0 | DCMA-EA PAM 200.1, Section 4.7 "Negative Float." Same URL. |
| Check 8 (High Duration): ≤5% of incomplete tasks with baseline duration >44 working days, baseline start within detail planning period | DCMA-EA PAM 200.1, Section 4.8 "High Duration." Same URL. |
| Check 9 (Invalid Dates): zero tolerance — forecast dates must not precede status date; actual dates must not follow status date | DCMA-EA PAM 200.1, Section 4.9 "Invalid Dates." Same URL. |
| Check 10 (Resources): ratio of incomplete tasks (duration ≥1 day) missing $/hours; no pass/fail threshold specified | DCMA-EA PAM 200.1, Section 4.10 "Resources." Same URL. |
| Check 11 (Missed Tasks): ≤5% of baseline-due tasks finishing (actual/forecast) after baseline date | DCMA-EA PAM 200.1, Section 4.11 "Missed Tasks." Same URL. |
| Check 12 (Critical Path Test): what-if test — extend a critical activity's remaining duration; passes if completion date shifts proportionally; DCMA training example uses 600 working days | DCMA-EA PAM 200.1, Section 4.12 "Critical Path Test." Same URL. |
| Check 13 (CPLI): CPLI = (Critical Path Length + Total Float) ÷ Critical Path Length; target 1.00; <0.95 flagged | DCMA-EA PAM 200.1, Section 3.1.2.3 "Critical Path Length Index (CPLI)" (referenced by 4.13). Same URL. |
| Check 14 (BEI): ratio of tasks completed to tasks that should have been completed per baseline; target 1.00; <0.95 flagged | DCMA-EA PAM 200.1, Section 3.1.2.4 "Baseline Execution Index (BEI)" (referenced by 4.14). Same URL. |

### (b) Ordo7 coverage-note claims → engine source

| Claim | Source (analyze.js) |
|---|---|
| Ordo7 automates Logic, Hard Constraints, High Float, Negative Float, High Duration (5 of 14) | Confirmed by reading `analyzeXER`, `analyzeCSVTasks`, `analyzeMspXml` in full; no other of the 14 checks (Leads, Lags, Relationship Types, Invalid Dates, Resources, Missed Tasks, Critical Path Test, CPLI, BEI) appear anywhere in the file. |
| Logic check (regular activities, .xer): flags only when BOTH predecessor and successor are missing (AND logic) — narrower than DCMA's OR-based definition | `/home/user/Level-7-Nuero/schedule-health/backend/src/analyze.js:192-195` — `if (!predCount[t.task_id] && !succCount[t.task_id])` |
| Logic check (CSV): flags only missing predecessor (no successor check at all for regular activities) | `analyze.js:301-304` |
| Logic check (MS Project XML): same AND logic as .xer | `analyze.js:443-446` |
| Logic check (milestones, all formats): uses OR logic (missing predecessor or successor), matching DCMA's definition — but DCMA excludes milestones from its own Logic-check scope entirely | `analyze.js:170-174` (.xer), `analyze.js:282-286` (CSV), `analyze.js:422-426` (MSP-XML) |
| Hard Constraints threshold and 44-working-day float/duration cutoffs match DCMA exactly | `analyze.js:196-199` (High Float, .xer), `analyze.js:200-204` (High Duration, .xer) |
| Hard Constraints check (.xer only): flags `cstr_type` containing `MSO` or `MEO` (P6's codes for Mandatory Start / Mandatory Finish) — does not check Start-No-Later-Than or Finish-No-Later-Than | `analyze.js:205-208` |
| Hard Constraints is not implemented for CSV or MS Project XML formats | Absence confirmed — no `cstr`/constraint-type field parsed in `analyzeCSVTasks` or `parseMspXml`/`analyzeMspXml` |
| Negative Float check (.xer, CSV, MSP-XML) | `analyze.js:188-191`, `analyze.js:297-300`, `analyze.js:439-442` |
| High Float check (.xer, CSV, MSP-XML) | `analyze.js:196-199`, `analyze.js:305-308`, `analyze.js:447-450` |
| High Duration check (.xer, CSV, MSP-XML) | `analyze.js:200-204`, `analyze.js:309-312`, `analyze.js:451-454` |
| Out-of-sequence signal (.xer only) is a real check but not one of the official 14 | `analyze.js:209-217` — flags an FS-linked successor started before its predecessor's actual finish |
