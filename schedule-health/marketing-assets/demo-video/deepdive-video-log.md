# Deep Dive Video — narrated series log

> **Status:** ✅ Active | **Purpose:** Dedup ledger and build log for the narrated "Deep Dive" video pillar — a distinct format from the silent raw LinkedIn series (`raw-video-log.md`). Deliberately kept as two separate pillars: the raw series' thesis is native/unpolished (no voiceover, on purpose); Deep Dive is a narrated walkthrough format for explaining a specific feature in more depth. | **Last Updated:** 2026-08-03

**Not committed to the repo.** Unlike the raw series (whose `.mp4`/`.ass` files are committed alongside this log), every Deep Dive video so far is a one-off built in an ephemeral session scratchpad and delivered directly to Taj via `SendUserFile` — the files themselves don't persist anywhere durable once a session ends. This log is the durable record of what was built, what it says, and what's real about each one. If any of these get formally adopted as an ongoing series, promote them into the repo (same pattern as the raw series) so the assets survive session churn.

**Production pipeline (established across all three so far):** real ElevenLabs `text_to_speech` narration per beat (never a script read by a human) → each beat's real measured duration (via `ffprobe`, not guessed) paces a Playwright recording of the actual live app → for beats with unpredictable real-action timing (an AI chat reply, a save-and-recompute), real wall-clock timestamp markers are captured during recording and narration is placed via `adelay`/`amix` at the real action's start, allowed to run past the action's completion rather than forcing artificial sync → word-by-word progressive-reveal captions (ASS format), timed proportionally within each beat's real narration duration, weighted by word length → muxed, verified via frame probing, delivered.

## Log (produced videos)

| # | Topic | Beats (narration text) | Real numbers/actions shown | Runtime | Caption style | Posted? |
|---|---|---|---|---|---|---|
| 1 | Issue Punch List + "How to fix" | 1. "This is a real schedule I ran through Ordo7. It failed five checks — scored 2 out of 100." 2. "Here's the punch list. Each issue explained in plain language, not just flagged." 3. "Steel delivery has negative float, and started before its predecessor finished. Here's how to fix it." 4. "Compare that to this one: a 63-day activity with no checkpoints. Completely different guidance." 5. "This is Ordo7 — real, specific guidance, for every issue, from one upload." | Same built-in sample schedule used across the raw series; real "How to fix" guidance shown for two genuinely different issue types (negative float vs. long duration), confirming the guidance isn't one canned tip copy-pasted across issue types. | ~34.8s (5 beats, real narration durations 5.75s/4.86s/9.80s/8.12s/6.45s) | FontSize 64, yellow `&H0000FFFF`, near-opaque black box, word-by-word weighted reveal (v2 — the first cut used a simpler per-beat fade; owner asked for bigger/bolder captions for a silent-scroll-eyecatching read, rebuilt as the word-reveal version). | Not posted — delivered to Taj for review only. |
| 2 | Ask Ordo capabilities | 1. "Ordo7 isn't just a dashboard. You can actually ask it questions." 2. "This is Ask Ordo. Type anything about your schedule, in plain language." 3. "Watch. I'll ask what's driving the score." 4. "Now a different question. What should I fix first?" 5. "Real answers, grounded in your real schedule — not a canned FAQ. What would you ask first?" | Two real, live type→send→stream exchanges against the actual `/api/snapshots/:id/chat` endpoint: "What's driving my health score?" and "What should I fix first?" — both genuinely different answers, neither scripted (same underlying real-answer requirement as raw Video 4, narrated instead of silent). | ~34.7s (5 beats, real narration durations 4.13s/4.55s/2.40s/4.78s/6.27s; beats 3–4 use the hybrid real-timestamp sync since the AI reply latency isn't predictable) | FontSize 64, yellow, `MarginV` 150 (learned from raw Video 4's round-3 fix so captions clear the real `#chatInput` box at the bottom of frame). | Not posted — delivered to Taj for review only. Draft caption written 2026-08-03 (below), pending Taj's decision on whether/where to post. |
| 3 | Earned Value Management walkthrough | 1. "Ordo7 also runs Earned Value Management — the real cost-and-schedule math, not just a score." 2. "Planned progress: ninety two percent. Actual: fifty four. This project is already behind." 3. "Enter your budget and spend to date, and Ordo7 computes real earned value — automatically." 4. "Cost variance: negative thirty nine thousand five hundred dollars. CPI: zero point eight seven. Over budget, and behind schedule." 5. "This is Ordo7 — real EVM, from your real numbers. Would your project pass this test?" | Real Earned Schedule numbers as of recording (planned progress 91.6%, actual 54.1% — narration rounds 91.6 to "ninety two" for spoken flow, on-screen captions show the exact 92%/54% figures), a real live budget entry ($500,000) and actual-cost entry ($310,000) through the real Save button, and the real computed result (EV $270,500, PV $458,000, CV -$39,500, CPI 0.87) — all from the app's actual formula in `renderEarnedValueCostSection()`, nothing precomputed or faked. | 33.96s (5 beats, real narration durations 6.03s/5.93s/6.11s/8.49s/6.69s; video padded ~4s at the tail with a frozen final frame since narration ran ~3.3s longer than the recorded footage) | FontSize 64, yellow, `MarginV` 150. Caught and fixed a real overflow bug during QC: 3 of 5 beats' lines ran off both frame edges (`WrapStyle: 2` doesn't auto-wrap, and the safe line-length budget at FontSize 64 is much lower than it looks — roughly 35-38 characters, not the 44-52 originally written) — fixed by splitting into shorter lines per beat, reverified via frame probing. | Not posted — delivered to Taj for review only. |

## Draft caption — Deep Dive #2 (Ask Ordo), written 2026-08-03

> Ordo7 isn't just a dashboard — you can actually ask it questions.
>
> I recorded this walking through Ask Ordo on a real schedule that scored 2 out of 100. First question: what's driving the score. Second, different question: what should I fix first. Two real questions, two real answers — grounded in that schedule's actual flagged issues, not a canned FAQ recycling the same paragraph back at you.
>
> That's the difference between a report and a conversation.
>
> What would you ask first if your schedule scored a 2?
>
> #Ordo7 #ProjectControls #Scheduling #ConstructionManagement

First comment (post immediately after publishing, if posted): `Try Ordo7 free → https://ordo7.pro`

**Flagged for Taj, not resolved here:** this caption doesn't call out that the video has a voiceover, since it reads fine either way — but if this goes out on the same LinkedIn presence as the raw series, it'll be the first video there with narration, a visible format break from the other five ("no AI voice" is one of the raw SOP's explicit blueprint rules). Worth a deliberate call on whether Deep Dives get their own posting cadence/framing distinct from the raw trial, get folded into it, or stay as owner-reviewed one-offs posted at Taj's discretion — no routine currently posts these automatically, unlike the raw series' daily trigger.

## Draft caption — Deep Dive #3 (EVM), written 2026-08-03

> Ordo7 also runs Earned Value Management — not just a health score.
>
> I ran this on a real schedule: planned progress 91.6%, actual 54.1% — already behind. Entered a real budget ($500,000) and real spend to date ($310,000), and Ordo7 computed the rest automatically: earned value of $270,500, planned value of $458,000, a cost variance of -$39,500, and a CPI of 0.87. Over budget and behind schedule — both, not just one.
>
> This is Ordo7: real cost-and-schedule math, from your real numbers, not a spreadsheet you build by hand.
>
> Would your project pass this test?
>
> #Ordo7 #ProjectControls #Scheduling #ConstructionManagement

First comment (post immediately after publishing, if posted): `Try Ordo7 free → https://ordo7.pro`

All figures above match the entry #3 row exactly (same live-verified numbers, not rounded or reworded) — same "no AI voice on the raw series" flag from #2 applies here too.

> **Source files:** built in-session via ElevenLabs `text_to_speech` + Playwright + ffmpeg; none committed. See `raw-linkedin-video-sop.md` for the sibling raw-series format this deliberately differs from.
