# Brand narrative — Ordo7 Founder Log

Context for anyone extending Ordo7's marketing: the story this product is told through, and how it should stay consistent across LinkedIn, the ordo7.pro blog, and social-ad assets.

## The narrative thesis

Ordo7 isn't marketed as a generic SaaS product. It's marketed as one founder's response to a problem he lived: scheduling and project-controls software has been powerful but hostile to use for years, and nobody who actually does the work built something for the person doing it at 4:45pm before a status meeting. Taj Young — Founder & Developer, with a real background in project management / project controls — is building Ordo7 in public and documenting the build as it happens.

This is a "build in public" strategy: the goal right now is **audience before ask**. The near-term CTA is "follow the journey," not "buy now." Trust and a following get built first; monetization/adoption asks come once there's an audience that's watched the thing get built and believes in it. Don't front-load a hard sell — it breaks the format and the trust it depends on.

## What's confirmed (do not deviate from this)

A high-fidelity design handoff (the "Nocturne" system, see below) locked final copy for both entries below — this supersedes any earlier draft wording, including the copy drafted earlier in this doc's history.

**Founder Log — 001** (first published entry):
- Headline: *"Scheduling's been broken for years. I decided to **fix it**."* (key phrase in accent color)
- Body: *"I'm a developer building Ordo7 in the open — the project-controls tool professionals keep asking for. No big team. No permission. Just the work, shared step by step."*
- CTA button: *"Follow the journey → ordo7.pro"*
- Footer caption: *"New from the build, every week · ordo7.pro"*
- Byline: Taj Young, Founder & Developer
- Portrait position: upper-left

**Founder Log — 002:**
- Headline: *"**PMs are doing two jobs.** Ordo7 takes one back."* (key phrase in accent color)
- Body: *"A capital-projects boom is outpacing the trained staff to run it — so PMs absorb cost control and schedule maintenance on top of their real job. Upload a schedule, get a plain-language health check. No Primavera analyst, no new headcount."*
- CTA button: *"Follow the journey → ordo7.pro"*
- Footer caption: *"Built for the PM already doing two jobs · ordo7.pro"*
- Byline: Taj Young, Founder & Developer
- Portrait position: upper-right (alternates with 001 for visual rhythm)

This entry establishes the template for every future Founder Log post: numbered sequentially (003, 004, ...), each one documenting a real build milestone, decision, or problem encountered — not generic motivational content. Per the design handoff's own recipe: each new episode only needs a new number, a new headline (key phrase in accent color), a 2–3 sentence body, and optionally a portrait side-swap — everything else in the system stays fixed.

**LinkedIn caption formula** (from the design handoff): hook line → the problem/story → what Ordo7 does → `Read the full post → https://www.ordo7.pro/blog/<slug>` → `Follow the journey → https://ordo7.pro` → 4–5 hashtags. **`#Ordo7` is mandatory in every post, every time** — rotate the remaining 3–4 from: `#BuildInPublic #ProjectControls #Scheduling #SaaS #FounderJourney #DCMA #Bootstrapped #ConstructionTech #PMP`, picked for relevance to that day's topic. **Every Founder Log post has a matching blog entry (`backend/src/blog-content.js`) — the caption must link to it.** Both of these were missed on the first live post (Day 003, caught and corrected after publishing — see `founder-log-calendar.md`'s note); don't repeat either gap.

## Visual design system ("Nocturne")

Locked, high-fidelity design tokens — recreate pixel-accurately for any new Founder Log entry rather than improvising a new look.

- **Canvas:** 1200×1500 (4:5, preferred for LinkedIn feed reach — shown uncropped) or 1200×627 (1.91:1, for article/link-preview covers, since feed crops square images to this ratio there). Export flattened JPG, no alpha — transparent PNGs get rejected by some LinkedIn uploaders.
- **Ground:** radial gradient `#1b1e30 → #141626 → #0d0f1a`, 6px radius, faint 96px blueprint grid overlay (~5% white), 5px accent spine down the left edge fading top/bottom.
- **Top lockup:** Ordo7 ring mark (44px) inside a 64px ring, + "Ordo7" wordmark at 34px / weight 500 / letter-spacing -0.03em.
- **Portrait card:** ~404×520, rounded 18px, founder portrait cropped `50% 0%` (headroom so the head never clips), bottom gradient scrim, name + "Founder & Developer" caption, soft accent halo behind. Alternates left/right per entry.
- **Content block:** episode label `[ FOUNDER LOG — 00N ]` (16px / weight 600 / letter-spacing 0.28em / `#d2cefd`); headline ~82px / weight 500 / line-height 1.03 (key phrase in `#d2cefd`); body 26px / `#b2b6ca`; outlined CTA button (transparent fill, 1px `#9184d9` border, 10px radius — accent outlines only, never filled, per the design system's own rule).
- **Colors:** ground `#0d0f1a`/`#141626`/`#1b1e30`; text primary `#e9e9ed`, muted `#b2b6ca`, faint `#75798c`; accent (blurple) `#9184d9`, light accent `#d2cefd`.
- **Type:** Inter — headings weight 500 max (never bolder), body weight 400, kicker/label weight 600 uppercase.
- **Asset files:** stored at `schedule-health/marketing-assets/linkedin-founder-log/` — design source HTML, README with full spec, `assets/mark.png` + `assets/ceo-portrait.png`, and post-ready renders in `renders/`.
- **Render pipeline:** `linkedin-founder-log/render/` — parameterized HTML templates (feed + cover) and a Playwright script that turn a JSON data file into pixel-consistent JPGs. Any day's graphic is one command away; see `render/README.md`. This is what generates every Founder Log entry's image now, rather than manual recreation per post.

## Founder background (confirmed, anonymized)

**Confidentiality rule: never name a former employer/organization in any public content. Reference industries only.**

- **8+ years** in project controls, PMP-certified, advanced in Primavera P6, Excel, and Earned Value Management (EVM).
- Supported capital portfolios **over $100M** in total value.
- Industries worked in: **utility, manufacturing, pharmaceutical, oil & gas, and education** (K-12 capital/bond programs).
- Currently completing a BS in Business Administration / Construction Management, with coursework directly in construction scheduling, cost estimating, and construction law — formal credentialing layered on top of hands-on practice.

**Real, quantified track record (anonymized — usable in Founder Log posts as "in a past role" / "on a project I ran," never with a company name):**
- Improved schedule baseline accuracy by 17% on a $1M–$25M energy project portfolio through disciplined schedule logic and milestone placement.
- Directed $35M+ in monthly forecasting cycles, cutting cost variance by 12%.
- Improved performance by 11% across a 15-project energy portfolio through variance analysis and early risk identification.
- **Built an Excel-based milestone reporting tool from scratch** to give a Project Manager schedule visibility that the existing enterprise tools weren't providing — direct precedent for the instinct behind building Ordo7. This is a strong, true anchor for an origin story: *"This isn't the first time I built the tool because the tool that existed wasn't good enough."*
- On a K-12 school district capital program: **>95% schedule adherence**, cut year-end budget lapses by 30%, delivered a **$50M multi-site school modernization program 12% under budget and ahead of schedule**, and reduced potential delays by 20% on $50M+ of campus modernization work through risk management.
- On a water utility maintenance program: 9% reduction in safety incidents through enforced safety adherence and training.
- On oil & gas refinery turnaround planning: reduced schedule deviation by 18% using EVM and trend analysis on CPM turnaround schedules.
- 15% cost reduction achieved through supplier contract negotiations.

## The spark — why now (confirmed origin thesis for Founder Log 002+)

This is the real "why now," and it's a market observation, not just a personal annoyance — use this as the core of Founder Log 002.

**The boom:** Data centers, manufacturing plants, and major industrial capital projects are surging right now (Taj saw this firsthand inside a major EV/manufacturing employer in California — reference as "a manufacturing employer," never by name). That boom is driving a sharp rise in demand for project managers and project controls analysts specifically.

**The gap:** Staffing agencies can't keep up with that demand. There's a real, structural shortage of qualified project controls talent relative to the number of active capital projects that need it.

**The migration parallel:** Taj draws a direct analogy to the population migration out of California to lower-cost-of-living states (Houston, Arizona, Dallas, etc.) — the physical infrastructure (roads, freeways) in those receiving cities can't expand fast enough to absorb the influx. Organizations have the exact same problem: project volume is growing faster than their internal capacity (headcount, trained controls staff) to manage it.

**The actual pain point Ordo7 addresses:** Because there aren't enough dedicated project controls analysts to hire, the slack gets absorbed by Project Managers — who end up doing cost control and schedule maintenance on top of their actual PM job. That's not their role, it's an extra burden created by a talent shortage, and it's a recurring, structural problem Taj has seen across multiple industries and employers, not a one-off complaint. Ordo7 exists to give an overloaded PM (or a company that can't staff a full project controls function) the schedule-health visibility a dedicated analyst would normally provide — without requiring Primavera-analyst-level expertise or a new headcount.

This reframes Ordo7's pitch: it's not just "the existing tools are clunky," it's "there's a genuine labor shortage in project controls right now, driven by a real construction/data-center/manufacturing boom, and the people absorbing that gap (PMs wearing two jobs) need something built for them specifically."

## Product capabilities (content bank — verified against the actual code, not the marketing copy)

The market has only really heard two things about Ordo7 so far: the health score and the DCMA checks. That's a fraction of what's actually shipped. Every item below is real and live in `backend/public/index.html` / `backend/src/` today — verified by reading the code, not assumed from memory. Use this as the source list for feature-spotlight content; don't describe a capability that isn't in this list, and don't undersell one that is.

- **Schedule health scoring** — a 0–100 score broken into sub-scores (logic quality, float distribution, constraint hygiene, milestone hygiene), not one opaque number.
- **DCMA-style issue detection** — negative float, missing logic, out-of-sequence work, and the rest of the 14-point checklist, flagged automatically on upload. Included on every plan, including Free.
- **Ask Ordo** — a permanently-docked, multi-turn AI chat, grounded in the actual uploaded schedule's real numbers, that *also* answers general project-controls/scheduling questions (DCMA, EVM, critical path, PMBOK concepts) even when unrelated to the loaded file. Built into every plan. See "Ask Ordo vs. the market" below — this is the single most underused fact in Ordo7's current marketing.
- **What-if sandbox** — adjust float and duration and watch the health score recalculate instantly, before committing to a real schedule revision.
- **Earned value tracking** — real progress-vs-baseline via Earned Schedule analysis, plus optional cost variance (CPI, CV) *only* once the user enters their own budget data. Never estimated or fabricated — if the cost data isn't there, Ordo7 says so instead of guessing.
- **Portfolio Overview / Multi-Project Leaderboard** — trend tracking and rollup across every schedule a user has uploaded, not just a single-file tool.
- **Printable, ready-to-send status report** — no formatting decisions left for the user; per `design-notes.md`, automating this "single most-hated recurring task" is treated as one of the highest-leverage features in the product.
- **Zero setup, one upload** — drop in a `.xer`, MS Project XML, or CSV export; no project setup wizard, no field mapping, no account configuration before the first result.
- **Team seats** — invite teammates onto a plan (Teams tier), shared visibility into the same projects.
- **Shareable snapshot links** — a schedule health snapshot can be shared via a link without giving someone a login.

## Ask Ordo vs. the market (use this — it's a live, ready-to-use contrast)

A well-funded, enterprise-priced competitor in this category recently launched (and staffed up around, with new VP-level hires) a "chat with your schedule in plain language" AI feature as a headline announcement — sold through an enterprise sales cycle, gated behind procurement, with zero public reviews months after GA (per `ordo7-competitive-intel`'s tracking — never name the competitor in public content, reference generically: "a well-funded competitor," "an enterprise player in this space").

**Ordo7 already had this.** Ask Ordo has been live since the product's early build, on every plan including Free, with no sales call required. This is a genuinely rare position: the market just validated that "plain-language AI conversation with your schedule" is the feature buyers want, and Ordo7 doesn't need to build anything to answer that — it needs to *say so*. This is a standing content angle, not a one-off: any time the gap between Ordo7's real capability and its current market awareness needs closing, Ask Ordo is the sharpest, truest example available.

## How Ordo7 listens and evolves

"Ordo7 is not static; it's evolving" isn't just a tagline — there's a real mechanism behind it, and it's worth naming specifically rather than gesturing at vaguely: in-app feedback submission is wired to notify the team directly (via Knock) the moment someone submits it, and every submission is saved regardless of whether notifications are configured. That's a real, standing commitment: a user's frustration or feature request doesn't go into a void, it reaches Taj directly. Content on this theme should point to that mechanism specifically ("there's a feedback button in the product, and I read what comes through it") rather than a generic "we love feedback!" claim.

## Target audience — education / K-12 bond programs

**This is a real, credibility-backed vertical, not a cold pitch.** Taj has direct hands-on experience delivering a K-12 capital/bond modernization program — this is the strongest, most specific story hook available for this audience, and should be used, not buried.

Primary titles to target for Ordo7 in this vertical:
- **School district superintendents**
- **Facilities directors**
- **Bond program directors**

These buyers manage voter-approved bond dollars for campus modernization/construction — high public scrutiny, hard deadlines tied to bond timelines, and (per Taj's own experience) real exposure to schedule slippage and budget lapses that a fast, plain-language schedule-health check would catch early. Founder Log content aimed at this audience should lean on the real $50M-program, 12%-under-budget, ahead-of-schedule result as proof, not a generic pitch.

Note: this is in addition to Ordo7's other target segment already explored for prospecting (project controls analysts/schedulers across construction, oil & gas, aerospace & defense, infrastructure, utilities — see the Apollo.io prospecting item in `08-DECISIONS.md`). Education/bond programs is a distinct buyer type (district-level decision-makers, not individual practitioners) and may warrant its own outreach and content track rather than being folded into the practitioner-focused messaging.

## Voice guidelines for Founder Log content

- **First person, not corporate.** This is Taj talking, not "Ordo7 the company." "I decided to fix it," not "Ordo7 was founded to address..."
- **Specific over vague.** Reference the actual thing that changed that week — a feature shipped, a real user's frustration, a design decision and why. Never a content-free "big things coming!" post.
- **Same bluntness as Level 7's brand voice**, but more personal — this is Taj's voice, not the institutional "Truth-Teller" voice used for Level 7 Consulting client-facing material. Direct, no jargon, contractions welcome, no corporate speak ("synergize," "leverage," "best-in-class" are still banned here).
- **Don't fabricate.** No invented metrics, no invented user testimonials, no invented milestones ahead of when they're real. This mirrors the product's own "don't fabricate metrics" rule in `design-notes.md` — the brand narrative holds itself to the same honesty standard the product does.
- **User feedback content is real-only.** When a Founder Log post references a user comment, request, or reaction, it must be an actual thing a real user said, anonymized (no names, no organizations — same confidentiality rule as everywhere else in this doc). Never invent a quote or paraphrase to fill a content slot. If there's nothing real to reference yet, the post waits or runs a category-appropriate placeholder instead — see `founder-log-calendar.md`'s Slot F rule.

## Channel application

| Channel | Format | Notes |
|---|---|---|
| LinkedIn (Taj's personal profile) | Native post, Founder Log framing, image or short video | Primary channel — personal accounts get more organic reach for founder-led narrative than a company page |
| ordo7.pro blog (`backend/src/blog-content.js`) | Longer-form version of the same entry, SEO-oriented | Same story, more detail, more room to explain the "why" behind a build decision |
| Social ads (`marketing-assets/social-ads/`) | Short vertical video, same headline/hook | Visual-first, headline must survive without sound |
| Facebook (`marketing-assets/facebook/`) | Same asset library as social-ads | Same rule: consistent hook and CTA across placements |

The rule for "consistent across channels": **the hook, the core claim, and the CTA stay identical everywhere** — only the format and length adapt per channel. If a LinkedIn post says "Scheduling's been broken for years," the blog version and the ad script should open on the same claim, not a rephrased one. Drift here is how a brand narrative stops feeling like one person's story.

## Build timeline and current state (confirmed)

- Build started **roughly 2 weeks** before this entry (keep this vague/relative in public content — don't invent a specific calendar date beyond what's confirmed).
- **Launch-ready.** The only remaining blocker is Postmark email account verification (transactional email delivery — see `07-INFRASTRUCTURE/tech-stack.md` in the Level 7 brain and `privacy.html`'s processor list). This is a concrete, specific, honest status update — good material for a Founder Log entry ("one verification away from launch"), not a vague "coming soon."
- **Ordo7 is explicitly not static.** A user feedback loop is already built in to surface feature requests, things to remove, and process improvements post-launch. The product is designed to keep evolving after launch, not ship-and-freeze. This is close to a tagline in its own right: *"Ordo7 is not static; it's evolving."*

## What's still needed from Taj

Background, the origin thesis, and the build timeline are now confirmed (see above). Still open:

- **What "support" concretely means** once the audience-building phase converts — paid beta, waitlist-to-launch, pre-orders, something else. The CTA evolves once it stops being pure "follow the journey," and this determines when/how that shift happens. Not urgent before launch — "follow the journey" still holds as the CTA through launch itself.

## 90-day content calendar

The Founder Log runs as a daily series (LinkedIn + blog, same story every day) for 90 days, structured as a 7-slot weekly wheel (build log, spark/thesis, DCMA education, industry pain point, founder story, user feedback, reflective) so it has consistent rhythm without repeating a topic. Full day-by-day topic bank, the fabrication guardrails for the two "live" slots, and the batching approach live in `founder-log-calendar.md`. First batch (Days 003–009) is fully drafted — graphics in `../marketing-assets/linkedin-founder-log/renders/`, LinkedIn captions in `../marketing-assets/linkedin-founder-log/batch-01-linkedin-captions.md`, blog posts appended to `../backend/src/blog-content.js`.

## Obsidian / cross-references

- [[../CLAUDE.md]] — product overview and architecture
- [[design-notes.md]] — product thesis and UX principles this narrative should stay consistent with
- [[founder-log-calendar.md]] — the 90-day day-by-day topic calendar
- [[../marketing-assets/README.md]] — asset inventory this content plan feeds
