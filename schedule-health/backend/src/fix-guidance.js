// fix-guidance.js — static, rule-based remediation guidance for each DCMA-style check Ordo7 runs.
// Pro-gated (see GET /api/issues/:id/fix-guidance in server.js). Deliberately not AI-generated:
// there are only 7 check types total, each fully knowable and stable, so a well-researched
// written guide per type is more consistent and defensible than text a model could phrase
// differently (or get a specific detail wrong) on every call — and it costs nothing to serve,
// unlike Ask Ordo, which stays the deeper, contextual, credit-metered layer for "what do I do
// about MY specific schedule" questions. This layer answers "how do I fix this class of issue,"
// the same way a project-controls reference guide would.
//
// Matched against an issue's `sub` field by substring, same convention analyze.js's
// subScoresFrom() already uses to categorize issues — keep these two matching schemes in sync if
// either changes.
const FIX_GUIDANCE = [
  {
    match: 'missing logic',
    title: 'Add the missing predecessor or successor',
    body: "Every activity should have at least one driving predecessor and one driven successor so it's actually part of the network, not floating free where a slip won't ripple anywhere — and won't get caught. Identify what real-world work has to finish before this activity can start, and what depends on this activity finishing, then add that logic link. If it's a genuine start or finish milestone, tie it to the project's start/end milestone instead of leaving it disconnected. Don't add a placeholder link just to clear the flag — a fake predecessor is worse than an honest gap, because it hides the real problem instead of surfacing it."
  },
  {
    match: 'out of sequence',
    title: 'Resequence the logic or correct the actual date — confirm which one is true',
    body: "This activity's actual start is earlier than its predecessor's actual finish, which breaks the Finish-to-Start logic the schedule claims to have. Usually one of two things is true: the real work genuinely overlapped (the relationship should probably be Start-to-Start with a lag, not Finish-to-Start), or the predecessor's actual finish date is wrong. Talk to whoever's closest to the field work to confirm which one it is, then either change the relationship type/lag to match reality or correct the predecessor's actual date. Don't leave the override sitting unresolved — it makes every downstream float calculation unreliable."
  },
  {
    match: 'already behind',
    title: 'Treat this as urgent — it needs a recovery plan, not routine tracking',
    body: "Negative float means this activity (or the milestone behind it) is already calculated to finish later than its required date — the schedule is telling you a deadline is already blown unless something changes. This is a compression/recovery problem, not a data-entry problem. Consider fast-tracking (running successor work in parallel instead of sequentially), crashing (adding resources to shorten duration), or renegotiating the required date if neither is realistic. Whatever you choose, log the recovery action — an unaddressed negative-float item with no recovery plan is the exact pattern industry research shows predicts the worst final outcomes."
  },
  {
    match: 'excessive float',
    title: 'Confirm the float is real, not a sign of a missing logic link',
    body: "An unusually large amount of float is often a red flag, not good news — it frequently means a logic link is missing elsewhere in the network, so nothing is actually constraining this activity and the software has nowhere to push it. Trace this activity's full chain of predecessors and successors and confirm every real dependency is actually modeled. If the float turns out to be genuine, that's fine — just confirm it before trusting it, since acting on float that's actually a data gap can hide a real schedule risk instead of revealing one."
  },
  {
    match: 'hard constraint',
    title: 'Replace the mandatory date with logic, if the date really can move',
    body: 'A hard (mandatory) constraint forces an activity to a fixed date regardless of what its predecessors actually do — so the schedule\'s own logic gets overridden the moment reality changes. Ask whether the date really is immovable (a contractual milestone, a regulatory deadline) or whether it was set as a shortcut. If it\'s not truly immovable, replace it with a soft constraint (like "Start No Earlier Than") or remove it and let real predecessor logic drive the date — that\'s what lets the schedule actually reflect a slip instead of masking it behind a fixed date nobody revisits.'
  },
  {
    match: 'long duration',
    title: 'Break it into smaller, trackable pieces',
    body: 'An activity running longer than about 44 working days is hard to manage honestly — with no intermediate checkpoint, percent-complete on a long activity tends to become a guess rather than a measurement, which is exactly why DCMA scheduling guidance flags it. Break the activity into smaller, sequential pieces with their own start/finish dates, each short enough that "how much is actually done" has a real, verifiable answer at each update. This isn\'t about making the schedule look better — it\'s about making progress reporting on that piece of work trustworthy again.'
  },
  {
    match: 'invalid dates',
    title: 'Correct the specific date — don’t just re-enter or delete it',
    body: "An impossible date combination — a finish before its own start, an actual date set in the future, or a finish recorded with no matching start — usually means a data-entry error during the last status update, not a real scheduling problem. Go back to the actual source (field reports, the prior status period's real dates) and correct the specific date that's wrong, rather than deleting the flag or overwriting it with today's date. Correcting a genuine mistake is different from — and much safer than — quietly restating an actual date to make a number look better. If you're not sure which one this is, that's worth a direct conversation with whoever entered the update."
  }
];

// Returns the matched guidance for an issue, or null if its `sub` text doesn't match any known
// category — returned as null rather than a generic fallback, since inventing filler guidance for
// an issue type this doesn't actually recognize would be exactly the kind of fabrication this
// project holds itself against everywhere else.
function getFixGuidanceForIssue(issue) {
  const sub = (issue && issue.sub || '').toLowerCase();
  const found = FIX_GUIDANCE.find(g => sub.includes(g.match));
  return found ? { title: found.title, body: found.body } : null;
}

module.exports = { getFixGuidanceForIssue };
