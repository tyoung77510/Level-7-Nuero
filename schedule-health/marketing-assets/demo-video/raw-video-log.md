# Raw LinkedIn Video — rotation and log

> **Status:** ✅ Active (5-day trial) | **Purpose:** Dedup ledger and topic rotation for the raw video routine. The routine reads this file first on every run to find the next topic and to check whether the 5-video trial is complete. | **Last Updated:** 2026-07-28

**Rule for the routine:** never re-record a topic already logged below. Take the next unlogged row from the rotation table, in order. If 5 rows are logged, disable the trigger and stop — do not produce a 6th.

## Rotation (planned topics — verify live before recording, don't record from memory)

| # | Topic | What it demonstrates | Verify before recording |
|---|---|---|---|
| 1 | Upload → health score | Empty upload screen, Load Sample Data, real score + flagged issues landing | Already produced (see log below) |
| 2 | Issue Punch List + "How to fix" | Clicking a real flagged issue's "How to fix" guidance | Already produced (see log below). Note for future local recordings: `fixGuidance` is gated to Professional/Team/Enterprise — a fresh local demo account defaults to Free and needs its `plan_tier` upgraded (direct DB write is fine for this local, non-production instance) before "How to fix" will show real guidance instead of an upgrade prompt. |
| 3 | What-if Sandbox | Adjusting float/duration on an activity and watching the health score recalculate live, before committing anything | Confirm the Sandbox tab is reachable on the demo/admin account's current tier and actually recalculates in the browser (client-side, per `index.html`'s `sandboxScoreFrom`) |
| 4 | Ask Ordo | Typing a real plain-language question and getting a real AI-grounded answer back | Requires `ANTHROPIC_API_KEY` configured and AI credits available on the account used — confirm a real answer comes back (not a 429/503) before recording; if AI is unavailable, stop and flag rather than substitute a different topic silently |
| 5 | Finish forecast (Earned Schedule) | The two-scenario IEAC(t) finish-date forecast card on a schedule with real SPI/progress data | Confirm `finishForecast.available` is true for the sample/demo data actually used — needs real planned dates and non-zero progress, which the built-in sample data may or may not have; check before recording, use a different real dataset if the sample doesn't qualify |

## Log (produced videos)

| # | Date | Topic | File | Caption | Posted? |
|---|---|---|---|---|---|
| 1 | 2026-07-26 | Upload → health score | `ordo7-raw-01-upload-to-score.mp4` | "I ran a real project schedule through this. Failed 5 checks. Instantly." / real flagged issues / "This is Ordo7." / "Try it free — link in the comments." (no closing question — produced before this SOP's question requirement; later entries should end on a real question instead of a flat CTA line) | **Posted 2026-07-27, 9:28 AM** — [post](https://www.linkedin.com/posts/taj-young_projectmanagement-schedulerisk-constructionmanagement-ugcPost-7487544355545718784-J-Z4) (hashtags added at publish time, not part of the original caption). Real analytics pulled shortly after posting: 18 impressions, 11 reached, 6 video views, 22s avg watch time, 1 comment — **that comment is Taj's own first-comment CTA link, not an organic reply**, so organic engagement so far is actually 0/0/0/0 (reactions/comments/reposts/saves), same pattern as everything else tracked. Sample is tiny and very early (pulled roughly an hour after posting) — too early to read anything into the reach numbers or conclude the format isn't working yet. |

| 2 | 2026-07-28 | Issue Punch List + "How to fix" | `ordo7-raw-02-issue-fix-guidance.mp4` | "A schedule fails 5 checks." / "Ordo7 doesn't just flag it — it tells you how to fix each one." / "Real, specific guidance per issue. Not one generic tip." / "What's the first fix you'd make here?" | not yet — staged, awaiting manual post |

**Note on entry 1:** produced during the same session that diagnosed Day 009 and designed this format, before the formal SOP (this file, `raw-linkedin-video-sop.md`) was written down. Its caption doesn't yet end on a question, unlike the blueprint this SOP locks in — future entries (2 onward) should. Not re-cut retroactively; it's still a valid, real, un-fabricated raw video and is fine to post as-is if the owner wants variety in what "close" looks like, but the routine's own output going forward should follow the SOP exactly.

**Note on entry 2:** produced manually (not by the automated trigger, which had not fired as of request time) after verifying live that "How to fix" needed a Professional-tier account to show real guidance — confirmed non-generic, issue-specific content (negative float vs. long-duration guidance differ substantively) before recording, per the SOP's hard rule. Owner asked for bigger, bolder captions after seeing the first cut — re-rendered with `FontSize` 34→46 and caption color changed from white to Ordo7 brand orange `#f37443`; same 12.4s cut and caption timing, styling only. Full caption text for the LinkedIn post:

> A schedule fails 5 checks in seconds. That's not the interesting part.
>
> Ordo7 doesn't stop at flagging it — click "How to fix" on any issue and it gives you real, specific guidance for that exact problem. Negative float gets a different answer than a 63-day activity with no checkpoints. Not one canned tip copy-pasted across every issue type.
>
> This is Ordo7: upload a schedule, see what's actually wrong, know what to do about it.
>
> What's the first fix you'd make on a schedule like this — the negative float, or the missing logic?
>
> #Ordo7 #ProjectControls #Scheduling #ConstructionManagement

First comment (post immediately after publishing): `Try Ordo7 free → https://ordo7.pro`
