// Regression test for the Microsoft Project (MSPDI / "Save As > XML") analysis path.
//
// This guards a headline feature: parsing MS Project XML exports and running the DCMA-style
// schedule-health checks against them. It uses Node's built-in test runner (`node --test`) and
// `node:assert` — no dependency, matching the app's zero-dependency philosophy.
//
// The fixture below is a hand-built MSPDI export with six tasks, each carrying a *known* defect,
// so we can assert that every check fires. If the parser stops extracting a field, or `analyzeFile`
// stops routing .xml to the MSP analyzer, these assertions break loudly instead of silently.

const { test } = require('node:test');
const assert = require('node:assert');
const { analyzeFile, parseMspXml } = require('../src/analyze.js');

// A minimal but well-formed MSPDI document. Defects, by UID:
//   1 Start Milestone   — dangling (no predecessor)          -> crit (milestone missing anchor)
//   2 Design            — negative float (-2400 min = -5 d)  -> crit (negative float)
//   3 Procurement       — 30000 min slack (62.5 d) > 44 d    -> risk (excessive float)
//   4 Orphan Activity   — no predecessor AND no successor    -> crit (missing logic)
//   5 Long Fabrication  — 400 h (50 d) > 44 d, 0% complete   -> risk (long duration)
//   6 Finish Milestone  — dangling (no successor)            -> crit (milestone missing anchor)
const MSP_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>Sample Program.xml</Name>
  <Tasks>
    <Task><UID>1</UID><Name>Start Milestone</Name><Start>2026-01-05T08:00:00</Start><Finish>2026-01-05T08:00:00</Finish><Duration>PT0H0M0S</Duration><TotalSlack>0</TotalSlack><Milestone>1</Milestone><PercentComplete>100</PercentComplete></Task>
    <Task><UID>2</UID><Name>Design</Name><Start>2026-01-06T08:00:00</Start><Finish>2026-01-30T17:00:00</Finish><Duration>PT160H0M0S</Duration><TotalSlack>-2400</TotalSlack><Milestone>0</Milestone><PercentComplete>50</PercentComplete><PredecessorLink><PredecessorUID>1</PredecessorUID></PredecessorLink></Task>
    <Task><UID>3</UID><Name>Procurement</Name><Start>2026-02-02T08:00:00</Start><Finish>2026-02-13T17:00:00</Finish><Duration>PT80H0M0S</Duration><TotalSlack>30000</TotalSlack><Milestone>0</Milestone><PercentComplete>0</PercentComplete><PredecessorLink><PredecessorUID>2</PredecessorUID></PredecessorLink></Task>
    <Task><UID>4</UID><Name>Orphan Activity</Name><Start>2026-02-02T08:00:00</Start><Finish>2026-02-11T17:00:00</Finish><Duration>PT80H0M0S</Duration><TotalSlack>1200</TotalSlack><Milestone>0</Milestone><PercentComplete>0</PercentComplete></Task>
    <Task><UID>5</UID><Name>Long Fabrication</Name><Start>2026-02-16T08:00:00</Start><Finish>2026-04-24T17:00:00</Finish><Duration>PT400H0M0S</Duration><TotalSlack>800</TotalSlack><Milestone>0</Milestone><PercentComplete>0</PercentComplete><PredecessorLink><PredecessorUID>3</PredecessorUID></PredecessorLink></Task>
    <Task><UID>6</UID><Name>Finish Milestone</Name><Start>2026-04-27T08:00:00</Start><Finish>2026-04-27T08:00:00</Finish><Duration>PT0H0M0S</Duration><TotalSlack>0</TotalSlack><Milestone>1</Milestone><PercentComplete>0</PercentComplete><PredecessorLink><PredecessorUID>5</PredecessorUID></PredecessorLink></Task>
  </Tasks>
</Project>`;

test('parseMspXml extracts tasks, durations, slack, milestones, and predecessor links', () => {
  const tasks = parseMspXml(MSP_XML);
  assert.equal(tasks.length, 6, 'should parse all six <Task> blocks');

  const design = tasks.find(t => t.uid === '2');
  assert.equal(design.name, 'Design');
  assert.equal(design.durationHours, 160, 'PT160H0M0S -> 160 working hours');
  assert.equal(design.totalSlackMinutes, -2400, 'negative slack preserved');
  assert.equal(design.milestone, false);
  assert.deepEqual(design.predecessorUids, ['1'], 'predecessor link parsed');

  const startMs = tasks.find(t => t.uid === '1');
  assert.equal(startMs.milestone, true, 'Milestone=1 flag parsed');
  assert.deepEqual(startMs.predecessorUids, [], 'start milestone has no predecessors');
});

test('analyzeFile routes .xml to the MSP analyzer and detects every planted defect', () => {
  const res = analyzeFile('Sample Program.xml', MSP_XML);
  const has = frag => res.issues.some(i => i.name.includes(frag));

  // Counts derive directly from detection, so assert them exactly.
  assert.equal(res.totalActivities, 4, 'four non-milestone activities counted');
  assert.equal(res.critCount, 4, 'four critical issues');
  assert.equal(res.riskCount, 2, 'two risk issues');
  assert.equal(res.issues.length, 6, 'six issues total');
  assert.equal(res.hasDates, true, 'dates parsed from <Start>');

  // Each specific check must fire.
  assert.ok(has('Start Milestone milestone has no predecessor or successor'), 'dangling start milestone');
  assert.ok(has('Design has negative float'), 'negative float');
  assert.ok(has('Orphan Activity has no predecessor or successor'), 'missing logic (orphan)');
  assert.ok(has('Finish Milestone milestone has no predecessor or successor'), 'dangling finish milestone');
  assert.ok(res.issues.some(i => i.name.includes('Procurement') && i.sub.includes('excessive float')), 'excessive float');
  assert.ok(res.issues.some(i => i.name.includes('Long Fabrication') && i.sub.includes('long duration')), 'long duration');

  // Scorecard shape: a broken schedule should score low, and all four DCMA sub-scores present.
  assert.ok(Number.isFinite(res.score) && res.score >= 0 && res.score <= 25, `broken schedule scores low (got ${res.score})`);
  for (const k of ['logicQuality', 'floatDistribution', 'constraintHygiene', 'milestoneHealth']) {
    assert.ok(Number.isFinite(res[k]) && res[k] >= 0 && res[k] <= 100, `sub-score ${k} is a 0-100 number (got ${res[k]})`);
  }
  assert.equal(res.milestoneHealth, 0, 'both milestones dangling -> milestoneHealth 0');
});

test('analyzeFile detects MSPDI by content even without an .xml filename', () => {
  // A file whose name gives no hint should still route to the MSP analyzer via <Project>/<Tasks>.
  const res = analyzeFile('schedule-export', MSP_XML);
  assert.equal(res.critCount, 4, 'same detection when routed by content sniff');
  assert.equal(res.riskCount, 2);
});
