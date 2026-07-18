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
