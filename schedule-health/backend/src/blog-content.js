// blog-content.js — blog post source content, reviewed and merged like any other code change.
// New posts get appended here (via the normal draft-PR review flow) and are picked up
// automatically by seedBlogPosts() in server.js on the next deploy — nothing here writes to the
// database directly, so adding a post is just adding an entry to this array.
module.exports = [
  {
    slug: 'the-non-schedulers-survival-guide',
    title: "The Non-Scheduler's Survival Guide: 5 Red Flags to Check Before You Accept a Contractor's Baseline",
    description: "You don't need a PSP certification to catch a bad baseline. Here are 5 concrete things to check in a contractor's schedule before you sign off on it — and why each one matters.",
    contentHtml: `
<p>You're not a scheduler. You're a project owner, a PM on the client side, or an exec who has to sign off on a contractor's baseline schedule before work starts — and you know that once you approve it, it becomes the yardstick everyone gets measured against for the next 18 months.</p>
<p>The problem: a bad baseline doesn't look bad. It has thousands of activities, colorful Gantt bars, and a finish date that matches what you were told verbally. It <em>looks</em> professional. Whether it's actually sound is a different question — and most of the ways a schedule goes wrong don't show up until you're three months in and already behind.</p>
<p>Here are five things worth checking before you accept a baseline, in plain language, no scheduling certification required.</p>

<h2>1. Negative float that's already baked in</h2>
<p>Float is the cushion an activity has before it starts delaying the finish date. Negative float means an activity is already behind schedule — on day one, before a single shovel hits the ground. If a freshly submitted baseline has activities sitting at negative float, one of two things is true: the contractor is submitting a schedule they already know is unrealistic, or a date was hard-coded in a way that's fighting the network logic (see #2). Either way, it's not a rounding error you can wave off. Ask why, by name, activity by activity.</p>

<h2>2. Hard date constraints hiding the real finish date</h2>
<p>A schedule is supposed to calculate dates from logic — this task can't start until that one finishes. A "mandatory" or "must finish by" constraint overrides that math and pins a date in place regardless of what's actually happening upstream. A handful of these tied to real contractual milestones is normal. A schedule riddled with them is a schedule where the finish date isn't a calculation anymore — it's a guess someone typed in, dressed up to look calculated. Count them. If a large share of your critical activities are hard-constrained, the "logic-driven" finish date you were quoted may not be logic-driven at all.</p>

<h2>3. Activities with no real connections</h2>
<p>Every activity should have at least one predecessor and one successor — something that has to happen before it, and something that depends on it finishing. An activity floating with no logic ties in either direction is called an open end, and open ends are exactly what they sound like: pieces of the plan that aren't actually plugged into the rest of the plan. They can move independently, get forgotten, or get "float" that's meaningless because nothing constrains them. A handful in a 3,000-line schedule might be housekeeping. Dozens is a sign the network was built fast and never checked.</p>

<h2>4. Work sequenced out of order</h2>
<p>This one is subtle: an activity's logic says it can't start until its predecessor finishes, but the actual dates in the schedule show it starting before that predecessor is done. That's a contradiction — the schedule is telling you two different things about the same piece of work. It usually means someone updated progress by hand without respecting the logic underneath it, which is a preview of how schedule updates will go for the rest of the project if it's not caught now.</p>

<h2>5. Suspiciously long, unbroken activities</h2>
<p>"Install mechanical systems — 140 days" is not a task, it's a phase wearing a task's clothing. Long, monolithic activities are a red flag for two reasons: you can't tell if they're on track until they're already late (there's no intermediate milestone to miss), and they're often used to bury schedule risk inside a single line item instead of showing it. DCMA scheduling guidance generally flags anything north of about 44 working days as worth breaking down further. If your baseline has a lot of these, ask for them to be broken into smaller, trackable pieces before you sign.</p>

<h2>The honest bar</h2>
<p>None of this requires you to become a scheduler. It requires someone — or something — to actually look. Most owners don't have the time to manually audit a few thousand activities for negative float, constraint abuse, broken logic, and oversized durations before every baseline gets accepted. That's a mechanical, repeatable check, which is exactly the kind of thing that shouldn't depend on someone's Friday-afternoon attention span.</p>
<p>Ordo7 runs this exact class of check — negative float, hard constraints, out-of-sequence work, broken logic, oversized durations — against an uploaded schedule file and gives you a score and a list of specific activities to go ask about, before you accept the baseline instead of after you're behind on it.</p>
`.trim()
  }
];
