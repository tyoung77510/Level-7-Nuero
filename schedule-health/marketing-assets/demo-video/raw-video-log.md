# Raw LinkedIn Video — rotation and log

> **Status:** ✅ Active (5-day trial) | **Purpose:** Dedup ledger and topic rotation for the raw video routine. The routine reads this file first on every run to find the next topic and to check whether the 5-video trial is complete. | **Last Updated:** 2026-07-26

**Rule for the routine:** never re-record a topic already logged below. Take the next unlogged row from the rotation table, in order. If 5 rows are logged, disable the trigger and stop — do not produce a 6th.

## Rotation (planned topics — verify live before recording, don't record from memory)

| # | Topic | What it demonstrates | Verify before recording |
|---|---|---|---|
| 1 | Upload → health score | Empty upload screen, Load Sample Data, real score + flagged issues landing | Already produced (see log below) |
| 2 | Issue Punch List + "How to fix" | Clicking a real flagged issue's "How to fix" guidance | Confirm "How to fix" renders real, non-generic guidance for at least one issue on the sample data before recording |
| 3 | What-if Sandbox | Adjusting float/duration on an activity and watching the health score recalculate live, before committing anything | Confirm the Sandbox tab is reachable on the demo/admin account's current tier and actually recalculates in the browser (client-side, per `index.html`'s `sandboxScoreFrom`) |
| 4 | Ask Ordo | Typing a real plain-language question and getting a real AI-grounded answer back | Requires `ANTHROPIC_API_KEY` configured and AI credits available on the account used — confirm a real answer comes back (not a 429/503) before recording; if AI is unavailable, stop and flag rather than substitute a different topic silently |
| 5 | Finish forecast (Earned Schedule) | The two-scenario IEAC(t) finish-date forecast card on a schedule with real SPI/progress data | Confirm `finishForecast.available` is true for the sample/demo data actually used — needs real planned dates and non-zero progress, which the built-in sample data may or may not have; check before recording, use a different real dataset if the sample doesn't qualify |

## Log (produced videos)

| # | Date | Topic | File | Caption | Posted? |
|---|---|---|---|---|---|
| 1 | 2026-07-26 | Upload → health score | `ordo7-raw-01-upload-to-score.mp4` | "I ran a real project schedule through this. Failed 5 checks. Instantly." / real flagged issues / "This is Ordo7." / "Try it free — link in the comments." (no closing question — produced before this SOP's question requirement; later entries should end on a real question instead of a flat CTA line) | not yet — staged, awaiting manual post |

**Note on entry 1:** produced during the same session that diagnosed Day 009 and designed this format, before the formal SOP (this file, `raw-linkedin-video-sop.md`) was written down. Its caption doesn't yet end on a question, unlike the blueprint this SOP locks in — future entries (2 onward) should. Not re-cut retroactively; it's still a valid, real, un-fabricated raw video and is fine to post as-is if the owner wants variety in what "close" looks like, but the routine's own output going forward should follow the SOP exactly.
