---
status: DRAFT — pending founder approval
slug: /blog/reviewing-contractor-baseline
title_tag: How to Review a Contractor's Baseline Schedule
meta_description: "A step-by-step way to review a contractor's baseline schedule before you accept it — open ends, hard constraints, float, durations, and the critical path."
target_query: reviewing contractor schedule
target_word_count: ~1,500 words (body only, excludes this header and the closing source table)
---

# How to Review a Contractor's Baseline (Before You Sign It)

A contractor's baseline schedule just landed in your inbox, and you're being asked to accept it — which means reviewing it isn't optional. Reviewing a contractor schedule comes down to five questions, checked in order: is it internally consistent (does every activity have logic tying it to the rest of the plan), are its dates coming from real logic or from constraints someone typed in, does the float distribution make sense, are the activities broken into pieces you can actually measure, and does the critical path tell a story that matches how the job gets built. Walk those five in sequence and you'll catch the large majority of baselines that are quietly unrealistic on the day they're submitted — no scheduling certification required.

This is the sequel to [the Non-Scheduler's Survival Guide](/blog/contractor-baseline-red-flags-checklist), which covers five fast red flags you can check in a few minutes. This post is the longer walkthrough behind those same five ideas — the actual sequence to work through when you have twenty minutes with the schedule open instead of five, and you want to understand *why* each check matters, not just that it exists.

A quick vocabulary note before the walkthrough: **P6** is Primavera P6, the scheduling software most capital-projects contractors run on. **TF** (total float) is how many days an activity can slip before it delays the project finish. **FS** (finish-to-start) is the most common logic relationship — "the next activity can't start until this one finishes." **DCMA** is the Defense Contract Management Agency, whose 14-point schedule assessment is the closest thing this industry has to a shared standard for what "healthy" means — see [the full DCMA 14-point guide](/blog/dcma-14-point-check-guide) if you want the complete list. This post walks through five of those checks, applied specifically to a baseline you're about to accept.

## Is the baseline complete and internally consistent?

Before you look at a single date, check whether the network is actually connected. Every real activity should have a predecessor (something that has to happen before it can start) and a successor (something waiting on it to finish). When one or both is missing, schedulers call it an "open end" — the activity is sitting in the plan but isn't actually wired into it.

Picture a baseline where "Procure Structural Steel" has a predecessor (the steel submittal being approved) but nothing scheduled after it — no successor pulling it toward "Steel Erection." That long-lead procurement activity can slip by weeks and nothing downstream reacts, because nothing downstream is tied to it. The finish date stays the same. The plan still looks on track. It isn't.

The practical version of this check: scan for activities with an empty predecessor or successor column, and ask about every one you find. If you're running an automated check instead of eyeballing a few hundred rows by hand, know what it's actually catching — Ordo7's current logic check, for a regular (non-milestone) activity, flags it as missing logic when it's missing **both** a predecessor and a successor from a `.xer` or MS Project XML export, or when a CSV export shows no predecessor listed at all. An activity missing only one end — say it has a predecessor but no successor — won't trip that specific flag today, so it's still worth a manual scan on top of any automated pass, especially on activities you already have a hunch about. The [Survival Guide's open-ends section](/blog/contractor-baseline-red-flags-checklist) covers the same check at the five-minute-version depth; this is the fuller version of why it matters.

## Are the dates believable, or propped up by hard constraints?

A healthy schedule is driven by logic — dates fall out of the network of relationships, not the other way around. A fragile one is held together by constraints: dates typed directly onto an activity that override whatever the logic would otherwise calculate. A few, tied to real contractual milestones, are normal. A schedule where every major date is pinned by a constraint is a schedule where the logic isn't actually doing the driving.

The two hard-constraint types worth flagging on sight are Mandatory Start On and Mandatory Finish On — in P6, these force a date regardless of what predecessors say, even if every upstream activity finishes late. If "Deliver Long-Lead Switchgear" carries a Mandatory Finish On date sitting on top of a chain of procurement activities that clearly can't hit it, that's not a coincidence — someone locked the date in place to make the schedule match a commitment, not to reflect how the work will actually happen.

Ordo7's hard-constraint check today looks specifically for those two mandatory types, and only in `.xer` exports — it doesn't yet flag the softer-sounding but still restrictive Start-No-Later-Than or Finish-No-Later-Than constraints, and it doesn't run this check at all on MS Project XML or CSV files. If you're reviewing one of those, scan the constraint column by eye for now. Either way: count the hard constraints, and for every one, ask what happens to that date if the activities feeding it slip.

## Does the float make sense?

Float should tell a story you can believe. Two failure modes are worth checking for, and they're opposites of each other.

**Negative float** means an activity is already behind before a single day of work has happened — its calculated finish lands after the date it's required to hit. If "Substantial Completion" is showing negative float in a freshly submitted baseline, the contractor is either submitting a schedule they already know can't hit its own commitment, or a constraint somewhere is fighting the logic hard enough to produce an impossible number. Neither is something to wave off with "we'll make it up later." Ordo7 flags negative float on every activity, across `.xer`, MS Project XML, and CSV formats alike, the moment you upload.

**Excessive float** is the quieter problem. If "Install Signage" shows 90 working days of float on an 8-month project, it might genuinely be low-priority, correctly floating late — or it might mean logic is missing somewhere and the float number is an artifact of that gap rather than a real scheduling decision. Ordo7 flags total float over 44 working days (about two calendar months) as worth a look — the same threshold DCMA's own high-float check uses, chosen because that's roughly the point where "comfortably not urgent" starts to look more like "not actually tied to anything."

## Are activities measurable, or are they black boxes?

An activity with a 60-day duration and no interior milestones is a black box. You can't tell if "Structural Steel Erection," scheduled as one long bar, is 20% done or 50% done or quietly behind — there's nothing inside the bar to check against. Long single activities are exactly where slippage hides, because a contractor can report "in progress" for months without the schedule ever being able to prove otherwise.

The fix on the contractor's side is breaking that kind of activity into pieces you can actually verify against reality — steel delivered, first level erected, topped out — instead of one bar spanning the whole erection sequence. On your side as the reviewer, the practical check is simple: any near-term activity running longer than about 44 working days is worth asking about specifically. Ordo7 flags exactly that — durations over 44 working days — across every format it reads, again matching the threshold DCMA's own check uses for the same reason.

## Does the critical path actually run end to end?

The critical path is the chain of activities that determines your finish date — trace it, and it should tell a story that matches how the job actually gets built. On most vertical construction, that means running through foundations, structure, envelope, MEP rough-in, and commissioning, roughly in that order. If the "longest path" instead runs through landscaping and final signage, something upstream is wrong — either logic is missing on the real driving path, or a constraint somewhere is masking it, and the finish date the critical path is "protecting" isn't actually being protected by anything real.

You don't need to be able to build the network yourself to sanity-check this. Read the critical path activity by activity and ask, at each step, "does this genuinely have to happen before the next thing on this list?" If the answer is no, or if major scope categories are conspicuously absent from the chain that's supposedly driving your finish date, that's the single most important finding of the whole review — everything upstream of it (open ends, constraints, float) is usually the reason the critical path looks wrong in the first place.

## Put it together

Run those five checks in order — logic, constraints, float, duration, critical path — and you've covered the same ground a full manual DCMA-style review would, at the depth a non-scheduler actually needs before signing off on eighteen months of commitments. None of them require you to become a scheduler. They require you to ask five specific questions and not accept "it looks fine" as the answer to any of them.

If you'd rather not do this by hand: upload the contractor's baseline to Ordo7 and it runs the automated parts of this walkthrough for you — negative float, excessive float, long durations, hard constraints (on `.xer` files), and the missing-logic check described above — and hands back a plain-language list of what to ask the contractor about before you sign.

---

## Claim → source table

| Claim in post | Source |
|---|---|
| Ordo7's logic check flags a regular (non-milestone) activity as missing logic only when **both** predecessor and successor are missing, in `.xer` / MS Project XML | `backend/src/analyze.js:192-195` (`analyzeXER`: `if (!predCount[t.task_id] && !succCount[t.task_id])`); `analyze.js:443-446` (`analyzeMspXml`, same AND logic) |
| Ordo7's CSV logic check flags a regular activity only when the predecessor field is empty (successor not checked for this flag) | `backend/src/analyze.js:301-304` (`analyzeCSVTasks`: `if (!preds)`) |
| Milestones are flagged when **either** predecessor or successor is missing (OR rule) — distinct from the regular-activity AND rule above | `backend/src/analyze.js:170-174` (XER), `:282-286` (CSV), `:422-426` (MspXml) |
| Ordo7's hard-constraint check looks for Mandatory Start On / Mandatory (Finish/End) On constraints, `.xer` files only; does not check MS Project XML or CSV, and does not flag Start-No-Later-Than / Finish-No-Later-Than | `backend/src/analyze.js:205-208` (`cstr_type.includes('MSO') \|\| cstr_type.includes('MEO')`); confirmed absent from `analyzeCSVTasks` and `analyzeMspXml` (no `cstr`/constraint reference in either function) |
| Ordo7 flags negative float on every activity across `.xer`, MS Project XML, and CSV | `analyze.js:188-191` (XER), `:297-300` (CSV), `:439-442` (MspXml) |
| Ordo7 flags total float over 44 working days ("excessive float") across all three formats | `analyze.js:196-199` (XER: `tf / 8 > 44`), `:305-308` (CSV: `tf > 44`), `:447-450` (MspXml: `floatDays > 44`) |
| Ordo7 flags durations over 44 working days across all three formats | `analyze.js:200-204` (XER: `drtn / 8 > 44`), `:309-312` (CSV: `dur > 44`), `:451-454` (MspXml: `durationDays > 44`) |
| DCMA's High Float (Check 6) and High Duration (Check 8) checks both use a 44-working-day threshold | `schedule-health/docs/blog-drafts/c1-dcma-14-point-check-guide.md` Check 6 and Check 8 sections, sourced there to DCMA-EA PAM 200.1 (Oct. 2012), §4.0 — note C1 is itself an unpublished draft; verify it has shipped before this claim goes live citing it |
| DCMA's Hard Constraints check (Check 5) covers four constraint types (MFO, MSO, SNLT, FNLT) at a 5% threshold — used here only to contrast against what Ordo7 currently checks, not claimed as something Ordo7 detects | `schedule-health/docs/blog-drafts/c1-dcma-14-point-check-guide.md` Check 5 section |
| P6 = Primavera P6; TF = total float; FS = finish-to-start; DCMA = Defense Contract Management Agency — definitions, no external claim | Standard industry usage, defined on first use per the brief; also consistent with `c1-dcma-14-point-check-guide.md`'s own definitions section |
| Internal link: Non-Scheduler's Survival Guide / red-flags checklist, slug `contractor-baseline-red-flags-checklist` | `backend/src/blog-content.js:117-170` — confirmed live; this single post serves as both the "Survival Guide" and the "red-flags checklist" (same slug, headline references both names) |
| Internal link: DCMA 14-point cornerstone, proposed slug `dcma-14-point-check-guide` | `schedule-health/docs/blog-drafts/c1-dcma-14-point-check-guide.md` header (`proposed_slug: /blog/dcma-14-point-check-guide`) — **not yet in `blog-content.js`**; this link will 404 until C1 is approved and merged. See escalation note in the return summary. |

