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
    slug: 'founder-log-003-logic',
    title: "Founder Log 003: Why 'Logic' Is DCMA Check #1",
    headline: "Founder Log 003 — An Activity With No Predecessor Isn't a Schedule, It's a Guess",
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
    slug: 'founder-log-004-utility-safety',
    title: "Founder Log 004: What a Water Utility Program Taught Me About Schedule Discipline",
    headline: "Founder Log 004 — In Utility Work, a Missed Schedule Isn't Just Late. It's a Safety Problem.",
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
    slug: 'founder-log-005-eight-years',
    title: "Founder Log 005: Eight Years in Project Controls, One Recurring Problem",
    headline: "Founder Log 005 — Eight Years in Project Controls Taught Me One Thing Keeps Breaking",
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
    slug: 'founder-log-007-building-in-public',
    title: "Founder Log 007: Why I'm Building Ordo7 in Public",
    headline: "Founder Log 007 — No Big Team. No Funding Round. Just the Work, in Public.",
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
    slug: 'founder-log-009-staffing-shortage',
    title: "Founder Log 009: The Project Controls Staffing Shortage Nobody's Fixing",
    headline: "Founder Log 009 — There Aren't Enough Project Controls Analysts. Everyone Feels It.",
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
    slug: 'the-non-schedulers-survival-guide',
    title: "The Non-Scheduler's Guide to a Bad Baseline",
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
  }
];
