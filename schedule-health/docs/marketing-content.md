# Marketing content: founder log + competitor complaint patterns

Internal working doc for Ordo7 content — not published anywhere. Source material for LinkedIn posts and blog posts, kept here so it lives next to the product decisions it's actually based on (see `design-notes.md` and PR #32 in git history for the underlying research/fixes).

## Founder Log strategy

**Channel decision:** run "Founder Log" as a personal-LinkedIn-profile series (Taj's voice), with Ordo7 tagged/linked — not posted from the company page. Founder-log content works because people follow a person's story, not a corporate account; the company page stays the destination for proof-of-work (case studies, product updates, hiring) once someone clicks through from a personal post.

**001 (shipped):** "Scheduling's been broken for years. I decided to fix it." — headshot + founder-log graphic, name + "Founder & Developer." Pure hook, no story payoff yet.

**002 (next, concept):** the "why now" post — what specifically triggered building Ordo7 rather than just complaining about it on a jobsite, paired with one concrete product artifact (a real health-score screenshot or the DCMA issue list) as proof rather than a promise. Structure:
1. One sentence on the specific moment/project where a broken schedule cost something real.
2. One sentence bridging to "so I started building the thing that would've caught it."
3. Screenshot or short clip of the actual product.
4. One forward-looking closing line — no CTA. It's a log, not an ad.

**003+ (bank for later):** each complaint pattern below is also a legitimate founder-log entry in its own right ("here's a thing I found in competitor reviews and fixed") — see the post drafts below, which work either as standalone product posts or folded into the log's voice.

---

## Competitor complaint patterns (source: private competitive-intel pass on SmartPM, 4castplus, Deltek, and ScheduleReader reviews — see PR #32)

Five patterns, each already answered by something real and shipped in the product (not aspirational). **Caution on public use:** don't name competitors by brand in published social/blog copy — genericize ("a competitor," "another tool in this space") or use direct quotes with attribution only if you have a specific, citable public review in hand. Naming and characterizing a competitor's product negatively in public content carries real reputational/legal risk that this internal doc doesn't need to worry about.

### 1. Silent data manipulation
**Pattern:** same complaint independently across three competitors — users don't trust the tool is showing their actual schedule; suspicion of silent rounding, reinterpretation, or reconstruction of uploaded data.
**Ordo7's answer (shipped):** health report visibly states "Analyzed exactly as uploaded — Ordo7 never edits, estimates, or reconstructs your schedule data."

**Social post draft:**
> I read through a pile of reviews for the big schedule-analysis tools before building Ordo7. Same complaint, different vendors: people don't trust the software is showing them their *actual* schedule. Quiet rounding. "Reconstructed" numbers. Edits nobody asked for.
> So Ordo7 says it out loud, right on the report: "Analyzed exactly as uploaded." If a number's wrong, it's wrong in your file — not because we touched it.

**Blog angle:** "Why 'we don't touch your data' should be on your schedule-tool checklist" — explain how/why reinterpretation happens in this category (unit conversions, calendar assumptions, float recalculation), why it erodes trust with PMs who have to defend numbers to a client, and how to check any tool (including Ordo7) for it yourself.

### 2. Metrics overload, no guidance
**Pattern:** recurring complaint about being shown ~35 metrics at once with no indication of which ones matter — data dumped, not analysis.
**Ordo7's answer (shipped + documented as a design constraint):** default view is health score + top issues + trend; everything else (DCMA sub-checks, Monte Carlo, portfolio rollup) is one click deeper. Any new default-view metric is treated as a regression unless it's the single most decision-relevant number for that screen (`design-notes.md`, principle 3).

**Social post draft:**
> A pattern kept showing up in competitor reviews: people handed 35 metrics with zero guidance on which ones actually matter. That's not analysis, that's homework.
> Ordo7's default screen has exactly the numbers that decide whether your Monday status meeting is easy or hard. Everything else is one click deeper, for the one analyst in ten who wants it.

**Blog angle:** "35 metrics, zero guidance: the real cost of dashboard sprawl in project controls software" — walk through why more metrics ≠ more insight, what "progressive disclosure" means in practice, and use SPI/CPI/DCMA sub-scores as the worked example of what's default vs. one-click-deeper in Ordo7.

### 3. Basic compliance checks gated behind a paid tier
**Pattern:** a competitor gates the DCMA 14-point check — an industry-standard check many contracts require — behind a paid plan.
**Ordo7's answer (shipped):** pricing page explicitly states DCMA-14 is included on every tier, including free.

**Social post draft:**
> Found a review complaining that a tool in this space gates the DCMA 14-point check — something most government and prime contracts require — behind a paid plan.
> That's not pricing strategy, that's holding compliance hostage. DCMA-14 is free on every Ordo7 plan, including the free one. Always will be.

**Blog angle:** "Is your DCMA-14 check actually free? A field guide to schedule-tool pricing traps" — generic (not competitor-named) explainer on which schedule-analysis features are genuinely table-stakes/compliance-required vs. which are legitimately premium, so a buyer can evaluate any vendor's pricing page critically.

### 4. UI friction — window/popup accumulation
**Pattern:** complaint about a competitor's tool spawning new windows/tabs until the user loses track of what they were doing.
**Ordo7's answer (verified, not a fix — it was already structurally impossible):** zero `window.open`/`target="_blank"` anywhere in the app; `showToast()` removes any existing toast before showing a new one.

**Social post draft:**
> Saw a recurring complaint about a tool in this category spawning new windows until you've got a dozen open and lost the thread. I went and audited Ordo7 line by line for this — zero new-window calls anywhere, one notification on screen at a time, always. Small thing. It's the kind of small thing that decides whether you trust a tool at 4:45pm before a status meeting.

**Blog angle:** weakest of the five as a standalone post — better folded into a broader "what tab/window sprawl costs project controls analysts" piece if there's ever a UX-focused content month, or as one bullet inside a "day in the life of an overloaded analyst" post rather than its own article.

### 5. Slow processing on large schedules
**Pattern:** complaint about analysis taking long enough to go get coffee on large/real-world schedules.
**Ordo7's answer (shipped, and the complaint directly caused two real bug fixes):** benchmarked an 8,000-activity synthetic XER through `/api/analyze` — first run 39.6s, traced to an O(n²) predecessor lookup and un-batched, non-transactional DB inserts (10,142 individual auto-committing `INSERT`s). Fixed both; re-ran: 0.29s, byte-identical output confirming a pure performance fix.

**Social post draft:**
> A complaint I kept seeing: analysis in this category can take long enough to go make coffee. So I checked Ordo7's own numbers honestly instead of assuming we were fine.
> Ran an 8,000-activity schedule through it. First try: 39.6 seconds — found two real bugs while I was in there (a slow lookup, and a database writing one row at a time instead of batching). Fixed both. Same file, same output, 0.29 seconds. ~137x faster. Upload to answer, not upload to coffee break.

**Blog angle:** "How fast should schedule analysis actually be? We benchmarked our own tool to find out" — technical credibility piece for the more engineering-literate segment of the audience (PMO leads, controls managers evaluating tools for their team): walk through the two real bugs, the before/after numbers, and the byte-identical-output verification as evidence the speed didn't come at the cost of correctness.

---

> Source: PR #32 ("Product improvements from competitor complaint research") and PR #35 (merged webhook + cookie-consent work) in this repo's git history. Update this doc if new complaint patterns come out of future competitive research.
