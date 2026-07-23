// blog-content.js — blog post source content, reviewed and merged like any other code change.
// New posts get appended here (via the normal draft-PR review flow) and are picked up
// automatically by the sync loop in server.js on the next deploy — nothing here writes to the
// database directly, so adding a post is just adding an entry to this array.
//
// Fields:
//   title    — short, SERP-facing <title>/OG text (keep under ~60 chars where practical).
//   headline — optional richer on-page H1/display text; falls back to `title` when unset.
//   category — drives the colored tag pill in post lists; see CATEGORY_STYLES in server.js.
//   toc      — optional [{id,label}] array; renders the sticky "ON THIS PAGE" nav when present.
//              Anchor ids must match id="..." attributes inside contentHtml.
//   contentHtml — semantic HTML for the article body. Numbered "red flag" sections use the
//              .flag-N convention (see server.js's blog article CSS) for the colored badge +
//              callout treatment; a plain post can just use <p>/<h2> with no .flag markup at all.
module.exports = [
  {
    slug: 'why-ordo7-never-fabricates-a-metric',
    ogImage: 'https://www.ordo7.pro/brand/founder-log-035-cover.jpg',
    title: "Why Ordo7 Never Fabricates a Schedule Metric",
    headline: "Why Ordo7 Will Never Fabricate a Metric It Can't Compute",
    description: "Self-reported schedule quality and objectively measured schedule quality are two different things. Here's why Ordo7 only ever shows a number it can actually back up, and marks the rest unavailable instead of guessing.",
    category: 'Founder Log',
    contentHtml: `
<p class="lead">Every schedule-health tool eventually hits the same fork: what do you do with a number you can't actually compute from the file in front of you? Guess at it, or say so. Ordo7 always does the second one, and I want to explain why that's not just a values statement — it's built directly into how the scoring engine works.</p>
<h2>The gap between "looks fine" and "is fine"</h2>
<p>Anyone who's run a status meeting knows the pattern: a schedule can look healthy on the surface — a Gantt full of green bars, a finish date that hasn't moved — while the data underneath tells a different story. Percent-complete gets nudged up because a task "should" be further along by now. That's exactly why Ordo7 doesn't take percent-complete at face value when a file doesn't actually carry one: if there's no real percent-complete field in the export, it falls back to status, and only estimates progress from elapsed time on an activity that's actually started — never for one that hasn't.</p>
<h2>Why Ordo7 marks things "unavailable" instead of estimating them</h2>
<p>True cost-based EVM — CPI, cost variance — isn't shown anywhere in Ordo7's reports, because a schedule-only export genuinely doesn't carry cost data. Rather than estimate one, it's marked unavailable. The schedule-only performance read Ordo7 does show, Earned Schedule, only includes activities that actually have planned start and end dates in the file — activities without them are excluded from the average, and the count excluded is shown right alongside the number, instead of being folded in silently. If nothing in the file has planned dates at all, Ordo7 says so outright instead of returning a number with no real basis.</p>
<h2>Why this matters more than it sounds</h2>
<p>A tool that always returns a clean, confident-looking number is easy to trust and easy to be wrong with. A tool that sometimes says "there's not enough in this file to tell you that" is a less satisfying answer in the moment, but it's the honest one. That's the trade I keep making with Ordo7, and it's the same standard I try to hold this blog to: if a claim doesn't have a real, checkable basis, it doesn't go in.</p>
`.trim()
  },
  {
    slug: 'missing-predecessors-successors-p6-dcma-check-1',
    ogImage: 'https://www.ordo7.pro/brand/founder-log-003-cover.jpg',
    title: "Missing Predecessors and Successors in P6: DCMA Check 1",
    headline: "An Activity With No Predecessor Isn't a Schedule, It's a Guess",
    description: "The first of the DCMA's 14 schedule-health checks is also the simplest: every activity needs something driving it and something depending on it. Here's why that rule catches so much.",
    category: 'Founder Log',
    contentHtml: `
<p class="lead">I'm spending the next few months of Founder Log posts walking through the DCMA's 14-point schedule assessment, one check at a time, in plain language. Check #1 is Logic, and it's the simplest one to explain — which is exactly why it's first.</p>
<p>Every activity in a schedule should have two things: a predecessor (something that has to happen before it can start) and a successor (something that depends on it finishing). When an activity is missing one or both, schedulers call it an "open end." It sits in the network disconnected from the rest of the plan.</p>
<h2>Why open ends are dangerous</h2>
<p>An open end isn't just messy — it's a blind spot. If an activity has no successor, it can slip by weeks and nothing downstream reacts to it. The finish date doesn't move. The schedule still looks green. But the work behind it is actually late, and nobody's watching because the software isn't set up to notice.</p>
<p>I've seen this more than once in real schedules: hundreds of activities, a handful of them quietly floating free of the network, and nobody catches it until the work is already behind and there's no paper trail showing why.</p>
<h2>Why this is check #1</h2>
<p>Every other DCMA check — float, constraints, duration, all of it — assumes the network logic underneath is sound. If activities aren't properly linked, every other number in the schedule is built on a shaky foundation. That's why logic gets checked first, and why it's the first thing Ordo7 checks too: before it tells you anything else about your schedule's health, it tells you whether the logic holding it together is actually complete.</p>
<p>Next up in this series: Leads — what happens when an activity is allowed to start before its predecessor actually finishes.</p>
`.trim()
  },
  {
    slug: 'utility-maintenance-schedule-discipline-safety',
    ogImage: 'https://www.ordo7.pro/brand/founder-log-004-cover.jpg',
    title: "Schedule Discipline and Safety in Utility Maintenance Programs",
    headline: "In Utility Work, a Missed Schedule Isn't Just Late. It's a Safety Problem.",
    description: "Compliance-driven maintenance schedules don't get extensions. A look back at a water utility program where enforcing schedule discipline cut safety incidents by 9%.",
    category: 'Founder Log',
    contentHtml: `
<p class="lead">Most of the schedule-health conversation online is about construction — GCs, subs, baseline reviews. I've worked in construction too, but some of the sharpest lessons I've learned about why schedule discipline matters came from a water utility maintenance program.</p>
<p>Utility maintenance work runs on a different clock than construction. A lot of it is compliance-driven — inspections, replacements, and repairs tied to regulatory requirements that don't move just because a team is behind. There's no negotiating a deadline with a regulator the way you might negotiate one with a client.</p>
<h2>What happens when maintenance schedules slip</h2>
<p>When maintenance work falls behind, the instinct is to compress it — do more in less time, skip steps, work around normal sequencing. That's exactly when safety incidents happen. On the program I worked on, enforcing real schedule discipline — sequencing work properly, not letting activities pile up against a compliance deadline — cut safety incidents by 9%. The schedule wasn't just a planning tool there. It was a safety control.</p>
<h2>Why this shaped Ordo7</h2>
<p>That experience is part of why I'm not building Ordo7 just for construction GCs. The DCMA-style checks — float, logic, constraints — are the same math no matter what industry you're in. What changes is the stakes. In utility work, in pharma, in oil & gas turnarounds, a schedule that's quietly falling apart isn't just a budget problem. Building something that works across all of that, in plain language, is the point.</p>
`.trim()
  },
  {
    slug: 'eight-years-in-project-controls',
    ogImage: 'https://www.ordo7.pro/brand/founder-log-005-cover.jpg',
    title: "What 8+ Years in Project Controls Taught Me About Scheduling Tools",
    headline: "Eight Years in Project Controls Taught Me One Thing Keeps Breaking",
    description: "PMP-certified, deep in Primavera P6 and EVM, across $100M+ in portfolios and five industries. The tools were always powerful. They were never built for the person actually running the schedule.",
    category: 'Founder Log',
    contentHtml: `
<p class="lead">I've spent more than eight years in project controls — PMP-certified, deep in Primavera P6, Excel, and Earned Value Management, supporting capital portfolios worth $100M+ across utility, manufacturing, pharmaceutical, oil & gas, and education projects.</p>
<p>Different industries. Different scopes. Different stakeholders. But the same problem showed up everywhere: the tools I was using were genuinely powerful — Primavera can model almost anything — and they were never built for the person who actually has to sit down and figure out, in the next ten minutes, what's actually wrong with the schedule before a status meeting.</p>
<h2>The gap between powerful and usable</h2>
<p>That gap isn't a knock on the software. Primavera does what it's designed to do. But "powerful" and "built for the person doing the work at 4:45pm" are two different design goals, and most schedule tools optimize hard for the first one and barely think about the second. The result is a lot of very capable software that very few people actually enjoy opening.</p>
<p>I'm finishing a degree in Construction Management right now, on top of the work — formal credentialing layered onto what I've already learned hands-on. But the instinct behind Ordo7 didn't come from a classroom. It came from years of being the person who had to translate a complicated schedule into something a PM, a director, or a superintendent could actually act on, over and over, for different employers and different projects, because nothing off-the-shelf did that translation for me.</p>
<h2>What that means for Ordo7</h2>
<p>Ordo7 isn't trying to replace Primavera or out-feature it. It's trying to be the plain-language layer on top — upload a schedule, get a health check you don't need eight years of experience to understand. That's the whole bet.</p>
`.trim()
  },
  {
    slug: 'building-ordo7-in-public',
    ogImage: 'https://www.ordo7.pro/brand/founder-log-007-cover.jpg',
    title: "Why I'm Building Ordo7 in Public",
    headline: "No Big Team. No Funding Round. Just the Work, in Public.",
    description: "Building in public isn't a growth tactic here — it's the only way I know how to build something honest. Here's why the Founder Log exists, and what 'follow the journey' actually means right now.",
    category: 'Founder Log',
    contentHtml: `
<p class="lead">I'm not raising a round before Ordo7 has a single real user. I'm not hiring a team before there's something worth a team building on. I'm building this myself, and I'm documenting it as it happens instead of disappearing for six months and reappearing with a polished launch.</p>
<p>That's the whole idea behind the Founder Log: real milestones, real setbacks, no highlight reel. If a week is mostly bug fixes and nothing exciting shipped, that's what gets posted. If user feedback changes a feature I was sure about, that gets posted too. The point isn't to look impressive — it's to be honest about what building something from scratch actually looks like.</p>
<h2>Why "follow the journey," not "buy now"</h2>
<p>Right now, the call to action on every Founder Log post is "follow the journey," not "buy now." That's deliberate. I'd rather build an audience that's watched this get made — who understands why it exists and what problem it's solving — before I ask anyone for anything. Trust comes first. The ask comes later, and I'll say plainly when that shift happens.</p>
<h2>What "in public" actually costs</h2>
<p>Building in public means shipping things before they're perfect and saying so. It means posting about a feature that didn't work out. It's slower, in a sense, than building quietly and controlling the narrative until launch day. But it's the only version of this I actually want to do — and if you're the kind of person who'd rather watch something get built honestly than see it appear fully formed, that's exactly who this is for.</p>
`.trim()
  },
  {
    slug: 'project-controls-staffing-shortage',
    ogImage: 'https://www.ordo7.pro/brand/founder-log-009-cover.jpg',
    title: "The Project Controls Staffing Shortage, Explained",
    headline: "There Aren't Enough Project Controls Analysts. Everyone Feels It.",
    description: "A capital-projects boom is outpacing the supply of trained project controls talent — and the gap doesn't disappear, it gets absorbed by whoever's already on the project. Usually the PM.",
    category: 'Founder Log',
    contentHtml: `
<p class="lead">There's a real, structural shortage of project controls talent right now, and it's not getting better on its own. Data centers, manufacturing plants, and major industrial capital projects are surging, and staffing agencies simply can't fill project controls and scheduling roles fast enough to keep up.</p>
<p>I've seen this firsthand, including inside a manufacturing employer in California riding that same capital-projects boom. The demand for people who can actually run a schedule and control costs was there. The qualified people to fill those roles weren't — not because the roles weren't valuable, but because there just aren't enough trained project controls analysts relative to the number of active projects that need one.</p>
<h2>Where the gap actually goes</h2>
<p>A staffing gap doesn't mean the work doesn't get done. It means the work gets absorbed by whoever's already there — and on most projects, that's the Project Manager. PMs end up doing cost control and schedule maintenance on top of the job they were actually hired for, because there's no dedicated analyst to hand it to. That's not a training failure or a work-ethic problem. It's a structural mismatch between how fast project volume is growing and how fast the talent pipeline can grow to match it.</p>
<h2>Why this is Ordo7's actual target user</h2>
<p>Ordo7 isn't built for project controls departments with a full analyst bench. It's built for the PM who's already doing two jobs and doesn't have the bandwidth to become a Primavera expert on top of everything else. Upload a schedule, get a plain-language health check — the visibility a dedicated analyst would normally provide, without requiring the headcount to hire one.</p>
`.trim()
  },
  {
    slug: 'contractor-baseline-red-flags-checklist',
    title: "5 Red Flags to Check in a Contractor's Baseline Schedule",
    headline: "The Non-Scheduler's Survival Guide: 5 Red Flags to Check Before You Accept a Contractor's Baseline",
    description: "You don't need a PSP certification to catch a bad baseline. Here are 5 concrete things to check in a contractor's schedule before you sign off — and why each one matters.",
    category: 'For owners & PMs',
    toc: [
      { id: 's1', label: '1 · Negative float' },
      { id: 's2', label: '2 · Hard constraints' },
      { id: 's3', label: '3 · Open ends' },
      { id: 's4', label: '4 · Long durations' },
      { id: 's5', label: '5 · Critical path' },
      { id: 's6', label: 'The bottom line' }
    ],
    contentHtml: `
<p class="lead">You're not a scheduler. You're a project owner, a PM on the client side, or an exec who has to sign off on a contractor's baseline before work starts — and you know that once you approve it, it becomes the yardstick everyone gets measured against for the next 18 months.</p>
<p>The problem: a bad baseline doesn't look bad. It has thousands of activities, colorful Gantt bars, and a finish date that matches what you were told verbally. It <em>looks</em> professional. Whether it's actually sound is a different question — and most of the ways a schedule goes wrong don't show up until you're three months in and already behind.</p>
<p>Here are five things worth checking before you accept a baseline, in plain language, no scheduling certification required.</p>

<section class="flag flag-1" id="s1">
  <div class="flag-head"><span class="flag-num">1</span><h2>Negative float that's already baked in</h2></div>
  <p>Float is the cushion an activity has before it starts delaying the finish date. Negative float means an activity is already behind schedule — on day one, before a single shovel hits the ground. If a freshly submitted baseline has activities sitting at negative float, one of two things is true: the contractor is submitting a schedule they already know is unrealistic, or a date was hard-coded in a way that's fighting the network logic. Either way, it's not a rounding error you can wave off.</p>
  <div class="callout"><div class="callout-kicker">HOW ORDO7 CATCHES IT</div><div class="callout-body">Ordo flags every activity below zero float the moment you upload, and tells you which ones sit on the critical path.</div></div>
</section>

<section class="flag flag-2" id="s2">
  <div class="flag-head"><span class="flag-num">2</span><h2>Hard constraints doing the logic's job</h2></div>
  <p>A healthy schedule is driven by relationships — this activity can't start until that one finishes. A fragile one is held together by <em>constraints</em>: manually pinned dates that override the logic. A few are normal. Dozens of "Must Finish On" constraints usually mean the schedule can't actually support its own dates, so someone nailed them in place to make the finish line land where the contract needed it to.</p>
  <div class="callout"><div class="callout-kicker">HOW ORDO7 CATCHES IT</div><div class="callout-body">The DCMA check counts hard constraints and surfaces the ones masking negative float underneath.</div></div>
</section>

<section class="flag flag-3" id="s3">
  <div class="flag-head"><span class="flag-num">3</span><h2>Open ends and dangling activities</h2></div>
  <p>Every activity should have something driving it and something depending on it. When activities have no predecessor or no successor — "open ends" — they float free of the network, and a delay to them quietly fails to ripple through to the finish date. A schedule full of open ends will always look like it's on track, because large parts of it aren't connected to the finish at all.</p>
  <div class="callout"><div class="callout-kicker">HOW ORDO7 CATCHES IT</div><div class="callout-body">Ordo lists every dangling activity and open end so you can ask the contractor to wire them in before approval.</div></div>
</section>

<section class="flag flag-4" id="s4">
  <div class="flag-head"><span class="flag-num">4</span><h2>Activities that run for months</h2></div>
  <p>A single activity with a 200-day duration is a black box. You can't tell if it's on track until it's late, because there are no interim milestones to measure against. Long-duration activities are where slippage hides — they let a contractor report "in progress" for months without ever being provably behind. Broken into shorter, measurable pieces, the same work becomes something you can actually track.</p>
  <div class="callout"><div class="callout-kicker">HOW ORDO7 CATCHES IT</div><div class="callout-body">High-duration activities are flagged automatically against the DCMA 14-point threshold.</div></div>
</section>

<section class="flag flag-5" id="s5">
  <div class="flag-head"><span class="flag-num">5</span><h2>A critical path that doesn't make sense</h2></div>
  <p>The critical path is the chain of activities that determines your finish date. Trace it end to end and it should tell a story that matches how the job actually gets built. If the "longest path" runs through landscaping and signage instead of structure and MEP, the logic is wrong somewhere — and the date it's protecting is fiction. You don't need to build the schedule to sanity-check the story it tells.</p>
  <div class="callout"><div class="callout-kicker">HOW ORDO7 CATCHES IT</div><div class="callout-body">Ordo highlights the true critical path so you can read it end to end in plain English.</div></div>
</section>

<section id="s6">
  <h2>The bottom line</h2>
  <p>You don't have to become a scheduler to hold one accountable. These five checks catch the large majority of baselines that are unrealistic on the day they're submitted — and asking about them, by name, changes how a contractor builds the next one.</p>
</section>
`.trim()
  },
  {
    slug: 'dcma-14-point-check-guide',
    ogImage: 'https://www.ordo7.pro/brand/dcma-14-point-check-cover.jpg',
    title: "The DCMA 14-Point Check: A Complete Guide",
    headline: "The DCMA 14-Point Check, Explained Without the Jargon",
    description: "The DCMA 14-point check, explained: all 14 official metrics, real thresholds, and which ones Ordo7 automates today, sourced from DCMA's own standard.",
    category: 'DCMA & compliance',
    toc: [
      { id: 'origin', label: 'Where it came from' },
      { id: 'definitions', label: 'Two definitions first' },
      { id: 'check-1', label: 'Check 1 \u00b7 Logic' },
      { id: 'check-5', label: 'Check 5 \u00b7 Hard Constraints' },
      { id: 'check-6', label: 'Check 6 \u00b7 High Float' },
      { id: 'check-9', label: 'Check 9 \u00b7 Invalid Dates' },
      { id: 'coverage', label: 'Where Ordo7 fits in today' },
      { id: 'sources', label: 'Sources' }
    ],
    contentHtml: `
<p class="lead">If you've been asked to "run the DCMA 14-point check" on your schedule, here's the short answer: it's a set of 14 ratio-based tests — things like what percentage of your activities are missing logic, how many have excessive float, whether your critical path actually behaves like a critical path — that the Defense Contract Management Agency (DCMA) built to flag potential quality problems in a Primavera P6 or MS Project schedule. Most of the 14 checks compare a count of "bad" activities to a total, express it as a percentage, and flag anything over 5%. A few work differently — one is a stress test you run directly on the schedule, and two are index numbers instead of percentages. None of them tell you your schedule is wrong. They tell you where to look.</p>
<p>I'm Taj, building Ordo7 — a plain-language schedule health tool. Before I explain what my own tool checks, I want to walk through what DCMA actually published, because most of what's online about "the DCMA 14-point check" is a paraphrase of a paraphrase. I went to the source for this one: DCMA's own EVMS Program Analysis Pamphlet, <a href="https://mosaicprojects.com.au/PDF-Gen/DCMA-PAM-200-1.pdf" target="_blank" rel="noopener">DCMA-EA PAM 200.1</a> (October 2012) — the last version of this standard DCMA itself published, Section 4.0. Every threshold below is quoted or closely paraphrased from that document, not from memory or from a vendor's marketing page.</p>

<h2 id="origin">Where the DCMA 14-point check came from</h2>
<p>In March 2005, the Under Secretary of Defense for Acquisition and Technology mandated that contracts over $20 million maintain an Integrated Master Schedule (IMS) — the master CPM (Critical Path Method) schedule tying together all the work on a program. That memo also told DCMA to come up with a way to evaluate those schedules consistently across every contract they oversee. What came out of that is the 14-point check: a standardized set of ratio tests any analyst can run against an IMS, regardless of which contractor built it, and get a comparable answer.</p>
<p>It was never meant to be a pass/fail law. DCMA's own document frames it as a way to "provide a catalyst for constructive discussions" and "a baseline for tracking IMS improvement over time" — a flag for a conversation, not a verdict. A schedule that trips one of these thresholds isn't automatically broken; it's a place to ask a follow-up question.</p>

<h2 id="definitions">The two definitions you need before any of the 14 checks make sense</h2>
<p>DCMA's math only works if you're clear on what counts in the denominator. Two terms come up in almost every check below:</p>
<p><strong>Incomplete task</strong> (DCMA also calls this a "Total Task"): any real, working activity — not a milestone, not a summary/WBS bar, not Level of Effort, and not already 100% complete. A concrete-pour activity that's 40% done counts. A "Foundation Complete" milestone doesn't. Neither does a rolled-up "Sitework" summary bar.</p>
<p><strong>Logic link:</strong> the predecessor/successor relationship connecting two activities — Finish-to-Start (FS, "the next activity can't start until this one finishes"), Start-to-Start (SS), Finish-to-Finish (FF), or Start-to-Finish (SF).</p>
<p>With those two definitions in hand, here are the 14 checks, in DCMA's own order.</p>

<h2 id="check-1">Check 1 — Logic: are your activities actually connected?</h2>
<p><strong>What it measures:</strong> the percentage of incomplete activities missing a predecessor, a successor, or both. DCMA's formula: (# of tasks missing logic ÷ # of incomplete tasks) × 100. The threshold is 5% — go over that and the check is flagged.</p>
<p>Picture a schedule where "Install Rebar" has a predecessor (Excavation) but nothing scheduled after it — no successor pulling it toward "Pour Concrete." That activity is dangling. If float and dates calculate off of logic links, an activity with no logic at all just sits wherever it was manually placed — its float number is meaningless because nothing is actually driving or constraining it.</p>
<p><strong>Takeaway:</strong> every real activity should have at least one predecessor tied to its start and one successor tied to its finish. If more than 1 in 20 don't, that's your first thing to run down. I've written a longer walkthrough of just this one check, with more real-world examples, in <a href="/blog/missing-predecessors-successors-p6-dcma-check-1">An Activity With No Predecessor Isn't a Schedule, It's a Guess</a>.</p>

<h2 id="check-2-3">Check 2 &amp; 3 — Leads and Lags: don't let the schedule lie about sequencing</h2>
<p><strong>Leads (negative lags):</strong> a lead is a logic link with a negative time value — it lets a successor start before its predecessor is actually done. DCMA's position is blunt: leads shouldn't exist at all. The target is 0%.</p>
<p><strong>Lags (positive lags):</strong> a lag is a built-in waiting period on a logic link — "Concrete Cure" as a 3-day lag on the link between "Pour Slab" and "Frame Walls," instead of its own activity. DCMA allows some lag, capped at 5% of logic links.</p>
<p>Why the asymmetry? A lead hides the fact that two activities are really overlapping, which can distort your float calculations and hide resource conflicts. A lag, used sparingly, can reasonably represent real non-work time like curing or inspection turnaround — though DCMA and most schedulers would rather see that curing time as its own activity than buried in a lag value nobody questions later.</p>
<p><strong>Takeaway:</strong> if you see a negative-duration relationship anywhere in your logic, that's worth a conversation before it's worth a workaround.</p>

<h2 id="check-4">Check 4 — Relationship Types: is Finish-to-Start actually your default?</h2>
<p><strong>What it measures:</strong> what fraction of your logic links are Finish-to-Start (FS) — "the next activity can't start until this one finishes." DCMA's bar: FS links should make up at least 90% of the logic in the schedule.</p>
<p>FS is the relationship type that produces a genuinely traceable critical path. Start-to-Start and Finish-to-Finish have real, legitimate uses — "Install Drywall" (SS) can start two days after "Rough Electrical" starts, for instance, without waiting for it to finish. But a schedule leaning heavily on SS/FF/SF links gets harder to reason about, and a Start-to-Finish link in particular is rare enough that DCMA calls for it to be used only with real justification.</p>
<p><strong>Takeaway:</strong> FS should be your default relationship. If it's under 90%, look at why — it's often a sign logic was patched in after the fact rather than planned.</p>

<h2 id="check-5">Check 5 — Hard Constraints: is the schedule still logic-driven?</h2>
<p><strong>What it measures:</strong> the percentage of incomplete activities carrying a hard constraint. DCMA's current list of hard constraints: Must-Finish-On (MFO), Must-Start-On (MSO), Start-No-Later-Than (SNLT), and Finish-No-Later-Than (FNLT). Threshold: 5%.</p>
<p>A hard constraint locks a date in place regardless of what the network logic calculates. If "Deliver Equipment" carries a Must-Start-On date, that date holds even if every upstream activity finishes late — which means the schedule stops reflecting reality and starts reflecting wishful thinking. DCMA distinguishes these from soft constraints — As-Soon-As-Possible (ASAP), Start-No-Earlier-Than (SNET), Finish-No-Earlier-Than (FNET) — which nudge a date without overriding the logic that calculates it.</p>
<p><strong>Takeaway:</strong> a handful of hard constraints tied to real contractual milestones is normal. A schedule where 1 in 10 activities is pinned to a fixed date usually means the logic isn't doing the driving anymore — the constraints are.</p>

<h2 id="check-6">Check 6 — High Float: is 44 days of slack believable?</h2>
<p><strong>What it measures:</strong> the percentage of incomplete activities with more than 44 working days (about two calendar months) of total float (TF — the amount of time an activity can slip before it delays the project). Threshold: 5%.</p>
<p>If "Install Signage" shows 90 working days of float on an 8-month project, that's not necessarily wrong — but it's worth asking why. Often it's a sign the activity is genuinely low-priority and correctly floats late. Just as often, it means logic is missing somewhere upstream or downstream, and the float number is an artifact of that gap rather than a real scheduling decision.</p>
<p><strong>Takeaway:</strong> high float isn't automatically bad, but a cluster of it is a prompt to check whether those activities are missing logic, not evidence they're safe to ignore.</p>

<h2 id="check-7">Check 7 — Negative Float: the one DCMA wants at zero</h2>
<p><strong>What it measures:</strong> the percentage of incomplete activities with total float below zero. DCMA's target here is 0% — no negative float without an explanation and a corrective action plan attached.</p>
<p>Negative float means an activity's calculated dates would finish after the date it's actually constrained or required to finish by — the schedule is telling you, mathematically, that the current plan can't hit its own commitment date without intervention. If "Substantial Completion" is carrying -12 days of float, that's not a rounding error; it's the schedule saying the current sequence of work runs 12 days past where it needs to land.</p>
<p><strong>Takeaway:</strong> negative float is the metric with the least room for "it's probably fine." Every negative-float activity should have a known cause and a plan, not just a number sitting there unexamined.</p>

<h2 id="check-8">Check 8 — High Duration: is 44 days too long for one activity?</h2>
<p><strong>What it measures:</strong> incomplete activities with a duration longer than 44 working days, with a baseline start inside your detailed planning window. Threshold: 5%.</p>
<p>An activity like "Structural Steel Erection" scheduled as a single 60-day bar is hard to status honestly — is it 20% done, 50% done, on track? A long single bar hides the internal milestones (steel delivered, first level erected, topped out) that would actually tell you whether it's on pace. DCMA's rolling-wave exception recognizes that far-future work is sometimes legitimately planned at a coarser level — the flag is really about near-term, detailed-planning-period activities.</p>
<p><strong>Takeaway:</strong> if a near-term activity runs longer than about two months, ask whether it should be broken into smaller, individually trackable pieces.</p>

<h2 id="check-9">Check 9 — Invalid Dates: is the schedule internally consistent?</h2>
<p><strong>What it measures:</strong> whether any incomplete activity has a forecast date before the schedule's status date, or a completed activity has an actual date after the status date. DCMA doesn't publish this one as a percentage threshold — it's zero tolerance. Either your dates are logically consistent with "today," or they're not.</p>
<p>An activity can't be forecast to start yesterday if it hasn't started yet, and it can't show an actual finish date next month if today is the 1st. Both are signs of a data entry error or, less innocently, of someone backdating progress to make the schedule look better than it is.</p>
<p><strong>Takeaway:</strong> invalid dates are a straightforward data-integrity check, not a judgment call — any hit here should get fixed, not investigated for nuance.</p>

<h2 id="check-10">Check 10 — Resources: is the schedule loaded the way it claims to be?</h2>
<p><strong>What it measures:</strong> whether incomplete activities with a duration of at least one day have resources or cost assigned. DCMA doesn't set a pass/fail threshold here — some schedules are legitimately never resource-loaded, and that's a valid choice, not a violation. This one is reported as a ratio for context, not scored against a cutoff.</p>
<p><strong>Takeaway:</strong> if your organization has committed to resource- or cost-loading a schedule, this check tells you how completely that commitment was actually carried out.</p>

<h2 id="check-11">Check 11 — Missed Tasks: how well is the plan tracking to its own baseline?</h2>
<p><strong>What it measures:</strong> the percentage of activities that were supposed to finish on or before the status date (per the baseline) but actually finished — or are forecast to finish — later than that. Threshold: 5%.</p>
<p>This is the check most directly about performance rather than structure. If "Rough-In Inspection Pass" baselined for finishing three weeks ago and it's still open today, that's a missed task. A schedule can have perfect logic and still fail this check if the work itself is falling behind.</p>
<p><strong>Takeaway:</strong> this is your best single signal for "is the plan still tracking to what we said we'd do," separate from whether the schedule was built well in the first place.</p>

<h2 id="check-12">Check 12 — Critical Path Test: does the logic actually hold together?</h2>
<p><strong>What it measures:</strong> not a percentage — a stress test. Take a critical activity, artificially stretch its remaining duration by a large amount (DCMA's training uses 600 working days), recalculate, and see whether the project completion date moves by a proportional amount. If it does, the logic holds. If completion barely budges despite a 600-day hit to a "critical" activity, the logic is broken somewhere — probably a missing successor link that lets the delay dead-end instead of flowing through to the finish.</p>
<p><strong>Takeaway:</strong> this is the check that catches broken logic the other 13 checks might miss — it's worth running whenever you don't fully trust your critical path.</p>

<h2 id="check-13">Check 13 — Critical Path Length Index (CPLI): is your critical path believable?</h2>
<p><strong>What it measures:</strong> CPLI = (Critical Path Length + Total Float) ÷ Critical Path Length, where Critical Path Length is the number of working days from today to the milestone you're measuring. A CPLI of 1.00 means you need to accomplish exactly one day of progress for every calendar day that passes — no slack, no cushion. Below 0.95, DCMA flags it: the schedule is aggressive relative to its own target date and increasingly unlikely to hit it without recovery. Above 1.00 suggests room to spare.</p>
<p><strong>Takeaway:</strong> CPLI answers a different question than float alone — it tells you how realistic your target completion date is given how the whole network is currently shaped, not just whether any one activity is late.</p>

<h2 id="check-14">Check 14 — Baseline Execution Index (BEI): are you completing work at the rate you planned?</h2>
<p><strong>What it measures:</strong> the ratio of tasks actually completed to the number of tasks that were supposed to be completed by now per the baseline. Target is 1.00; DCMA flags anything below 0.95. A BEI of 0.85 means you're completing roughly 15% fewer tasks than the original plan called for by this point — a leading indicator of schedule trouble, often visible before cost or float numbers catch up to it.</p>
<p><strong>Takeaway:</strong> BEI is a throughput measure, not a "how late is any one thing" measure — it's the metric most likely to give you an early warning that the overall pace of execution has slipped.</p>

<h2 id="coverage">Where Ordo7 fits into this today</h2>
<p>Ordo7 runs a DCMA-style health check, automating <strong>6 of these 14</strong> checks directly against a Primavera .xer, MS Project XML, or CSV export: <strong>Logic (Check 1)</strong>, <strong>Hard Constraints (Check 5)</strong>, <strong>High Float (Check 6)</strong>, <strong>Negative Float (Check 7)</strong>, <strong>High Duration (Check 8)</strong>, and <strong>Invalid Dates (Check 9)</strong> — using the same thresholds described above: 5% for the ratio checks, the 44-working-day cutoff for float and duration, and Must-Start-On/Must-Finish-On for hard constraints.</p>
<p>Two honest caveats, because I'd rather tell you the exact shape of the tool than round up: Ordo7's Logic check flags a regular activity only when it's missing <strong>both</strong> a predecessor and a successor — narrower than DCMA's own definition, which flags an activity missing <em>either</em> one (milestones do get DCMA's broader either/or rule). And the Hard Constraints check currently looks for Mandatory Start/Finish dates specifically (P6's MSO/MEO constraint codes, on .xer files) — not the full DCMA list, which also includes Start-No-Later-Than and Finish-No-Later-Than — and it isn't implemented yet for CSV or MS Project XML uploads.</p>
<p>For .xer files specifically, Ordo7 also flags out-of-sequence progress — work that started before its predecessor actually finished — which is a real schedule-quality signal, but it isn't one of the official 14 checks above.</p>
<p>If you're specifically reviewing a contractor's baseline before you sign off on it, a handful of these same checks — negative float, hard constraints, open ends, long durations — are exactly what to look for first; see <a href="/blog/contractor-baseline-red-flags-checklist">5 Red Flags to Check in a Contractor's Baseline Schedule</a> for the plain-language version of that walkthrough.</p>
<p>If you've read this far, the fastest way to make any of this concrete is to run it against a real file. Upload your .xer, MS Project XML, or CSV export to Ordo7 and see which of these checks your own schedule trips — in plain language, not a spreadsheet of raw percentages you have to interpret yourself.</p>

<h2 id="sources">Sources</h2>
<p>Every threshold above comes from one document: DCMA's own EVMS Program Analysis Pamphlet, DCMA-EA PAM 200.1 (October 2012). Section references below, so you can check any number yourself rather than take my word for it:</p>
<ul>
<li>"Total Task" / incomplete-task scope (excludes completed, LOE, summary/subproject, and milestone activities) — Section 4.0</li>
<li>Check 1, Logic (≤5%) — Section 4.1</li>
<li>Check 2, Leads (target 0%) — Section 4.2</li>
<li>Check 3, Lags (≤5% of links) — Section 4.3</li>
<li>Check 4, Relationship Types (FS ≥90%) — Section 4.4</li>
<li>Check 5, Hard Constraints (≤5%) — Section 4.5</li>
<li>Check 6, High Float (&gt;44 working days, ≤5%) — Section 4.6</li>
<li>Check 7, Negative Float (target 0%) — Section 4.7</li>
<li>Check 8, High Duration (&gt;44 working days, ≤5%) — Section 4.8</li>
<li>Check 9, Invalid Dates (zero tolerance) — Section 4.9</li>
<li>Check 10, Resources (no threshold, reported as a ratio) — Section 4.10</li>
<li>Check 11, Missed Tasks (≤5%) — Section 4.11</li>
<li>Check 12, Critical Path Test (600-working-day what-if) — Section 4.12</li>
<li>Check 13, Critical Path Length Index (target 1.00, flag &lt;0.95) — Section 3.1.2.3</li>
<li>Check 14, Baseline Execution Index (target 1.00, flag &lt;0.95) — Section 3.1.2.4</li>
</ul>
<p>Full document: <a href="https://mosaicprojects.com.au/PDF-Gen/DCMA-PAM-200-1.pdf" target="_blank" rel="noopener">DCMA-EA PAM 200.1</a>. Background on the March 2005 USD(AT&amp;L) memo that created this standard: <a href="https://www.ronwinterconsulting.com/DCMA_14-Point_Assessment.pdf" target="_blank" rel="noopener">Ron Winter Consulting, "DCMA 14-Point Schedule Assessment"</a> (2011).</p>
`.trim()
  }
];
