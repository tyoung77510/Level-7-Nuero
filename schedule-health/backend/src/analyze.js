// analyze.js — schedule parsing and DCMA-style health check engine (ported from the browser prototype)

function parseXER(text) {
  const lines = text.split(/\r\n|\n|\r/);
  const tables = {};
  let currentTable = null;
  let fields = [];
  for (const line of lines) {
    if (!line) continue;
    const parts = line.split('\t');
    const tag = parts[0];
    if (tag === '%T') {
      currentTable = parts[1];
      tables[currentTable] = [];
      fields = [];
    } else if (tag === '%F') {
      fields = parts.slice(1);
    } else if (tag === '%R' && currentTable) {
      const vals = parts.slice(1);
      const obj = {};
      fields.forEach((f, i) => (obj[f] = vals[i]));
      tables[currentTable].push(obj);
    }
  }
  return tables;
}

function parseCSV(text) {
  const lines = text.split(/\r\n|\n|\r/).filter(Boolean);
  const headers = lines[0].split(',').map(h => h.trim());
  const tasks = lines.slice(1).map(line => {
    const vals = line.split(',');
    const obj = {};
    headers.forEach((h, i) => (obj[h] = (vals[i] || '').trim()));
    return obj;
  });
  return tasks;
}

// XER date fields look like "2026-01-05 08:00" or a bare "2026-01-05" — take the date part only.
function parseXerDate(str) {
  if (!str) return null;
  const d = new Date(str.split(' ')[0]);
  return isNaN(d.getTime()) ? null : d;
}

function scoreFrom(total, nCrit, nRisk) {
  const score = Math.max(0, Math.round(100 - ((nCrit * 4 + nRisk * 1.5) / Math.max(total, 1)) * 20));
  const critPct = Math.round((nCrit / Math.max(total, 1)) * 100);
  const riskPct = Math.max(0, Math.round((nRisk / Math.max(total, 1)) * 100));
  const healthyPct = Math.max(0, 100 - critPct - riskPct);
  return { score, healthyPct, riskPct, critPct };
}

// Shared by subScoresFrom and milestoneHealthFrom — what fraction of a denominator is "clean".
function pct(n, total) {
  return Math.max(0, Math.min(100, Math.round(100 - (n / Math.max(total, 1)) * 100)));
}

// Nullable like the other three sub-scores — a file with zero milestones has nothing to score,
// so the frontend shows "—" rather than a fabricated 100.
function milestoneHealthFrom(milestoneIssueCount, totalMilestones) {
  return totalMilestones > 0 ? pct(milestoneIssueCount, totalMilestones) : null;
}

// DCMA check #9, Invalid Dates — structural date problems plus actual dates set in the future.
// Deliberately doesn't rely on a "data date" field from the source file (XER's own data-date
// field is inconsistently populated and CSV has no data date concept at all); "now" at analysis
// time is used as the future-date reference instead, which is what DCMA guidance itself falls
// back to when a file's own data date isn't reliable. Returns a plain list of problem phrases so
// callers can push one issue per phrase, matching the one-issue-per-condition pattern used
// elsewhere in this file. Naturally produces zero issues for CSV-format files, which carry no
// dates at all — an honest silence, not a fabricated pass.
function invalidDateIssues(plannedStart, plannedEnd, actualStart, actualEnd, now) {
  const problems = [];
  if (actualEnd && !actualStart) problems.push('has an actual finish date but no actual start date');
  if (actualStart && actualEnd && actualStart > actualEnd) problems.push('has an actual finish date before its actual start date');
  if (plannedStart && plannedEnd && plannedStart > plannedEnd) problems.push('has a planned finish date before its planned start date');
  if ((actualStart && actualStart > now) || (actualEnd && actualEnd > now)) problems.push('has an actual date set in the future');
  return problems;
}

// Groups the six DCMA-style checks into three dashboard sub-scores. Each pairing groups checks
// that measure the same underlying schedule-quality concern:
// - logicQuality: missing logic + out-of-sequence work — is the network actually connected and
//   sequenced correctly?
// - floatDistribution: negative float + excessive float — is float spread sensibly, neither
//   already-blown nor suspiciously generous (usually a sign of missing logic elsewhere)?
// - constraintHygiene: hard constraints + long-duration activities — are activities built the
//   way DCMA scheduling guidance recommends (soft constraints, activities under ~44 working days)?
function subScoresFrom(issues, total) {
  const countMatching = (needle) => issues.filter(i => i.sub.includes(needle)).length;
  const logicIssues = countMatching('missing logic') + countMatching('out of sequence');
  const floatIssues = countMatching('already behind') + countMatching('excessive float');
  const constraintIssues = countMatching('hard constraint') + countMatching('long duration');
  return {
    logicQuality: pct(logicIssues, total),
    floatDistribution: pct(floatIssues, total),
    constraintHygiene: pct(constraintIssues, total)
  };
}

function analyzeXER(tables) {
  const tasks = tables['TASK'] || [];
  const preds = tables['TASKPRED'] || [];
  // O(1) predecessor lookup by id, built once — the out-of-sequence check below runs per
  // predecessor relationship across every task, so a tasks.find() there instead of this map is
  // O(tasks x preds) and measurably slow on a real large schedule (confirmed: ~40s at 8,000
  // activities before this fix, vs the map-based lookup below).
  const taskById = {};
  tasks.forEach(t => { taskById[t.task_id] = t; });
  const predCount = {}, succCount = {};
  preds.forEach(p => {
    succCount[p.pred_task_id] = (succCount[p.pred_task_id] || 0) + 1;
    predCount[p.task_id] = (predCount[p.task_id] || 0) + 1;
  });
  const predByTask = {};
  preds.forEach(p => {
    (predByTask[p.task_id] = predByTask[p.task_id] || []).push(p);
  });

  const issues = [];
  const activities = [];
  let nCrit = 0, nRisk = 0, total = 0;
  let milestoneIssueCount = 0, totalMilestones = 0;

  tasks.forEach(t => {
    const activityName = t.task_name || t.task_code || 'unnamed activity';
    const activityFloat = parseFloat(t.total_float_hr_cnt);
    const floatDays = isNaN(activityFloat) ? null : Math.round((activityFloat / 8) * 10) / 10;
    const start = parseXerDate(t.act_start_date) || parseXerDate(t.target_start_date) || parseXerDate(t.early_start_date);
    const end = parseXerDate(t.act_end_date) || parseXerDate(t.target_end_date) || parseXerDate(t.early_end_date);
    const drtnHrs = parseFloat(t.remain_drtn_hr_cnt || t.target_drtn_hr_cnt);
    const durationDays = !isNaN(drtnHrs) ? Math.max(0, drtnHrs / 8) : (start && end ? Math.max(0, (end - start) / 86400000) : 1);
    // A task counts as a milestone if scheduling metadata says so, OR its duration resolves to
    // zero — either signal is sufficient (mirrors the same OR rule applied in analyzeMspXml).
    const isMilestone = t.task_type === 'TT_Mile' || durationDays === 0;
    const hasPredecessor = !!predCount[t.task_id];
    const hasSuccessor = !!succCount[t.task_id];

    // Planned/actual dates kept distinct (unlike `start`/`end` above, which merge actual-over-
    // target for display) — earned schedule needs to compare them separately, not blended.
    const plannedStart = parseXerDate(t.target_start_date);
    const plannedEnd = parseXerDate(t.target_end_date);
    const actualStartDate = parseXerDate(t.act_start_date);
    const actualEndDate = parseXerDate(t.act_end_date);
    const status = t.status_code === 'TK_Complete' ? 'complete' : (t.status_code === 'TK_NotStart' ? 'not_started' : 'active');
    // Best available progress signal, in order: a real physical-%-complete field if the export
    // included one (not every .xer does), then discrete status, then — only for an in-progress
    // activity with no % field — a proxy from how much of its own duration has elapsed since it
    // actually started. Never invented for a task with no status signal at all.
    const physPct = parseFloat(t.phys_complete_pct);
    let percentComplete;
    if (!isNaN(physPct)) percentComplete = Math.max(0, Math.min(100, physPct));
    else if (status === 'complete') percentComplete = 100;
    else if (status === 'not_started') percentComplete = 0;
    else if (actualStartDate) {
      const elapsedDays = Math.max(0, (Date.now() - actualStartDate.getTime()) / 86400000);
      percentComplete = durationDays > 0 ? Math.max(0, Math.min(100, (elapsedDays / durationDays) * 100)) : 0;
    } else percentComplete = 0;

    // Real predecessor codes (not just the hasPredecessor boolean above) — needed to draw
    // dependency arrows in the Gantt view. Falls back to the raw pred_task_id if that task
    // itself didn't resolve to a row (e.g. filtered out elsewhere) rather than dropping the link.
    const predecessors = (predByTask[t.task_id] || []).map(p => {
      const predTask = taskById[p.pred_task_id];
      return predTask ? (predTask.task_code || predTask.task_id) : p.pred_task_id;
    });

    activities.push({
      code: t.task_code || t.task_id,
      name: activityName,
      milestone: isMilestone,
      hasPredecessor, hasSuccessor, predecessors,
      start: start ? start.toISOString().slice(0, 10) : null,
      end: end ? end.toISOString().slice(0, 10) : (start ? new Date(start.getTime() + durationDays * 86400000).toISOString().slice(0, 10) : null),
      durationDays: Math.round(durationDays * 10) / 10,
      totalFloatDays: floatDays,
      critical: floatDays !== null && floatDays <= 0,
      plannedStart: plannedStart ? plannedStart.toISOString().slice(0, 10) : null,
      plannedEnd: plannedEnd ? plannedEnd.toISOString().slice(0, 10) : null,
      actualStart: actualStartDate ? actualStartDate.toISOString().slice(0, 10) : null,
      actualEnd: actualEndDate ? actualEndDate.toISOString().slice(0, 10) : null,
      status,
      percentComplete: Math.round(percentComplete * 10) / 10
    });

    // Runs for every task, milestone or not, and specifically *before* the isMilestone branch —
    // reversed actual/planned dates can themselves produce a negative (clamped-to-zero) duration
    // above, which would otherwise silently reclassify the very task this check exists to catch as
    // a milestone and skip it entirely. Milestones don't get the general activity checks below, but
    // date validity applies regardless of duration.
    invalidDateIssues(plannedStart, plannedEnd, actualStartDate, actualEndDate, new Date()).forEach(problem => {
      issues.push({ name: activityName + ' ' + problem, sub: (isMilestone ? 'Milestone ' : 'Activity ') + (t.task_code || t.task_id) + ' · invalid dates', sev: 'risk' });
      nRisk++;
    });

    if (isMilestone) {
      // Milestones get their own two checks instead of the general activity checks below (long
      // duration/excessive float/hard constraint don't mean anything for a zero-duration point in
      // time) — this is also the only place a milestone's negative float or logic gap is scored
      // at all; previously milestones were skipped entirely, so this was a real blind spot.
      totalMilestones++;
      let flagged = false;
      if (!hasPredecessor || !hasSuccessor) {
        issues.push({ name: activityName + ' milestone has no predecessor or successor', sub: 'Milestone ' + (t.task_code || t.task_id) + ' · missing logic anchor', sev: 'crit' });
        nCrit++;
        flagged = true;
      }
      if (floatDays !== null && floatDays < 0) {
        issues.push({ name: activityName + ' milestone has negative float', sub: 'Milestone ' + (t.task_code || t.task_id) + ' · already behind', sev: 'crit' });
        nCrit++;
        flagged = true;
      }
      if (flagged) milestoneIssueCount++;
      return;
    }
    total++;
    const name = t.task_name || t.task_code || 'unnamed activity';
    const code = t.task_code || t.task_id;
    const tf = parseFloat(t.total_float_hr_cnt);

    if (!isNaN(tf) && tf < 0) {
      issues.push({ name: name + ' has negative float', sub: 'Activity ' + code + ' \u00b7 already behind', sev: 'crit' });
      nCrit++;
    }
    if (!predCount[t.task_id] && !succCount[t.task_id]) {
      issues.push({ name: name + ' has no predecessor or successor', sub: 'Activity ' + code + ' \u00b7 missing logic', sev: 'crit' });
      nCrit++;
    }
    if (!isNaN(tf) && tf / 8 > 44) {
      issues.push({ name: name + ' has ' + Math.round(tf / 8) + ' days of float', sub: 'Activity ' + code + ' \u00b7 excessive float', sev: 'risk' });
      nRisk++;
    }
    const drtn = parseFloat(t.remain_drtn_hr_cnt || t.target_drtn_hr_cnt);
    if (!isNaN(drtn) && drtn / 8 > 44 && t.status_code !== 'TK_Complete') {
      issues.push({ name: name + ' runs ' + Math.round(drtn / 8) + ' days, longer than 44-day guidance', sub: 'Activity ' + code + ' \u00b7 long duration', sev: 'risk' });
      nRisk++;
    }
    if (t.cstr_type && (t.cstr_type.includes('MSO') || t.cstr_type.includes('MEO'))) {
      issues.push({ name: name + ' has a mandatory date constraint', sub: 'Activity ' + code + ' \u00b7 hard constraint', sev: 'risk' });
      nRisk++;
    }
    (predByTask[t.task_id] || []).forEach(p => {
      if (p.pred_type === 'PR_FS') {
        const predTask = taskById[p.pred_task_id];
        if (predTask && !predTask.act_end_date && t.act_start_date) {
          issues.push({ name: name + ' started before its predecessor finished', sub: 'Activity ' + code + ' \u00b7 out of sequence', sev: 'crit' });
          nCrit++;
        }
      }
    });
  });

  const { score, healthyPct, riskPct, critPct } = scoreFrom(total, nCrit, nRisk);
  const subScores = subScoresFrom(issues, total);
  const milestoneHealth = milestoneHealthFrom(milestoneIssueCount, totalMilestones);
  const hasDates = activities.some(a => a.start);
  return { score, healthyPct, riskPct, critPct, issues, activities, hasDates, totalActivities: total, critCount: nCrit, riskCount: nRisk, ...subScores, milestoneHealth };
}

function analyzeCSVTasks(csvTasks) {
  const issues = [];
  const activities = [];
  let nCrit = 0, nRisk = 0, total = 0;
  let milestoneIssueCount = 0, totalMilestones = 0;
  let cumulativeDays = 0;

  // This format has no distinct successor column — a row only lists its own predecessors — so
  // build the reverse map by splitting each predecessors cell (comma/semicolon-separated codes)
  // and cross-referencing against other rows' task_code, the same way analyzeXER/analyzeMspXml
  // derive succCount from the predecessor links they parse.
  const predByCode = {};
  csvTasks.forEach(t => {
    predByCode[t.task_code || ''] = (t.predecessors || '').split(/[,;]/).map(s => s.trim()).filter(Boolean);
  });
  const succCount = {};
  Object.values(predByCode).forEach(list => {
    list.forEach(predCode => { succCount[predCode] = (succCount[predCode] || 0) + 1; });
  });

  csvTasks.forEach(t => {
    const name = t.task_name || t.task_code || 'unnamed activity';
    const code = t.task_code || '';
    const tf = parseFloat(t.total_float_days);
    const dur = parseFloat(t.duration_days);
    const preds = (t.predecessors || '').trim();

    // No dates in this format — lay activities out sequentially by file order instead of a
    // calendar. dayOffset is days-from-start-of-file, not a real date.
    const durationDays = !isNaN(dur) ? Math.max(0, dur) : 1;
    // Same OR rule as the other two parsers: this format has no metadata flag, so zero duration
    // is the only signal — but it's sufficient on its own.
    const isMilestone = durationDays === 0;
    const hasPredecessor = predByCode[code].length > 0;
    const hasSuccessor = !!succCount[code];

    activities.push({
      code, name, milestone: isMilestone,
      hasPredecessor, hasSuccessor, predecessors: predByCode[code],
      start: null, end: null,
      dayOffset: Math.round(cumulativeDays * 10) / 10,
      durationDays: Math.round(durationDays * 10) / 10,
      totalFloatDays: isNaN(tf) ? null : tf,
      critical: !isNaN(tf) && tf <= 0,
      // This format carries no dates or status at all — earned schedule genuinely can't be
      // computed from it, so these stay null rather than guessed. computeEarnedSchedule() reports
      // that honestly instead of showing a number with no basis.
      plannedStart: null, plannedEnd: null, actualStart: null, actualEnd: null,
      status: null, percentComplete: null
    });
    cumulativeDays += durationDays;

    if (isMilestone) {
      totalMilestones++;
      let flagged = false;
      if (!hasPredecessor || !hasSuccessor) {
        issues.push({ name: name + ' milestone has no predecessor or successor', sub: 'Milestone ' + code + ' · missing logic anchor', sev: 'crit' });
        nCrit++;
        flagged = true;
      }
      if (!isNaN(tf) && tf < 0) {
        issues.push({ name: name + ' milestone has negative float', sub: 'Milestone ' + code + ' · already behind', sev: 'crit' });
        nCrit++;
        flagged = true;
      }
      if (flagged) milestoneIssueCount++;
      return;
    }
    total++;

    if (!isNaN(tf) && tf < 0) {
      issues.push({ name: name + ' has negative float', sub: 'Activity ' + code + ' \u00b7 already behind', sev: 'crit' });
      nCrit++;
    }
    if (!preds) {
      issues.push({ name: name + ' has no predecessor listed', sub: 'Activity ' + code + ' \u00b7 missing logic', sev: 'crit' });
      nCrit++;
    }
    if (!isNaN(tf) && tf > 44) {
      issues.push({ name: name + ' has ' + tf + ' days of float', sub: 'Activity ' + code + ' \u00b7 excessive float', sev: 'risk' });
      nRisk++;
    }
    if (!isNaN(dur) && dur > 44) {
      issues.push({ name: name + ' runs ' + dur + ' days', sub: 'Activity ' + code + ' \u00b7 long duration', sev: 'risk' });
      nRisk++;
    }
  });

  const { score, healthyPct, riskPct, critPct } = scoreFrom(total, nCrit, nRisk);
  const subScores = subScoresFrom(issues, total);
  const milestoneHealth = milestoneHealthFrom(milestoneIssueCount, totalMilestones);
  return { score, healthyPct, riskPct, critPct, issues, activities, hasDates: false, totalActivities: total, critCount: nCrit, riskCount: nRisk, ...subScores, milestoneHealth };
}

// Microsoft Project's XML interchange format (MSPDI) — what "Save As > XML" produces. This is a
// hand-rolled tag extractor tailored to that one known, well-formed schema, in the same spirit as
// parseXER/parseCSV above — not a general XML parser, and deliberately not a dependency (keeps
// this app zero-dependency, matching the raw .xer/.csv parsers). Raw binary .mpp is a proprietary
// OLE format and out of scope here; users export to XML from Project first.
function xmlTag(block, name) {
  const m = block.match(new RegExp('<' + name + '>([^<]*)</' + name + '>'));
  return m ? m[1] : null;
}

function xmlBlocks(text, name) {
  const re = new RegExp('<' + name + '>([\\s\\S]*?)<\\/' + name + '>', 'g');
  const out = [];
  let m;
  while ((m = re.exec(text))) out.push(m[1]);
  return out;
}

// MSPDI durations look like "PT80H0M0S" — hours/minutes/seconds of *working* time (already
// calendar-independent), matching the hours-based convention the XER parser uses elsewhere.
function parseMspDurationHours(str) {
  if (!str) return null;
  const m = str.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  const hours = parseInt(m[1] || '0', 10) + parseInt(m[2] || '0', 10) / 60 + parseInt(m[3] || '0', 10) / 3600;
  return hours;
}

function parseMspXml(text) {
  const taskBlocks = xmlBlocks(text, 'Task');
  return taskBlocks.map(block => ({
    uid: xmlTag(block, 'UID'),
    name: xmlTag(block, 'Name') || 'unnamed activity',
    start: xmlTag(block, 'Start'),
    finish: xmlTag(block, 'Finish'),
    baselineStart: xmlTag(block, 'BaselineStart'),
    baselineFinish: xmlTag(block, 'BaselineFinish'),
    durationHours: parseMspDurationHours(xmlTag(block, 'Duration')),
    // MSPDI represents slack as a plain integer number of minutes, not a duration string.
    totalSlackMinutes: xmlTag(block, 'TotalSlack') != null ? parseFloat(xmlTag(block, 'TotalSlack')) : null,
    milestone: xmlTag(block, 'Milestone') === '1',
    critical: xmlTag(block, 'Critical') === '1',
    percentComplete: xmlTag(block, 'PercentComplete') != null ? parseFloat(xmlTag(block, 'PercentComplete')) : 0,
    predecessorUids: xmlBlocks(block, 'PredecessorLink').map(p => xmlTag(p, 'PredecessorUID')).filter(Boolean)
  }));
}

function analyzeMspXml(tasks) {
  const predCount = {}, succCount = {};
  tasks.forEach(t => {
    t.predecessorUids.forEach(predUid => {
      predCount[t.uid] = (predCount[t.uid] || 0) + 1;
      succCount[predUid] = (succCount[predUid] || 0) + 1;
    });
  });

  const issues = [];
  const activities = [];
  let nCrit = 0, nRisk = 0, total = 0;
  let milestoneIssueCount = 0, totalMilestones = 0;

  tasks.forEach(t => {
    const durationDays = t.durationHours != null ? t.durationHours / 8 : null;
    const floatDays = t.totalSlackMinutes != null ? Math.round((t.totalSlackMinutes / 60 / 8) * 10) / 10 : null;
    const start = t.start ? t.start.slice(0, 10) : null;
    const end = t.finish ? t.finish.slice(0, 10) : null;
    // Same OR rule as analyzeXER: metadata flag or zero duration is sufficient on its own.
    const isMilestone = t.milestone || durationDays === 0;
    const hasPredecessor = !!predCount[t.uid];
    const hasSuccessor = !!succCount[t.uid];

    // MSPDI's <Start>/<Finish> reflect the current schedule — for statused work that's the real
    // actual date, for unstarted work it's the current forecast. <BaselineStart>/<BaselineFinish>
    // are the planned dates as of when the baseline was set — the two are genuinely distinct
    // fields in this format, not derived from each other.
    const status = t.percentComplete >= 100 ? 'complete' : (t.percentComplete > 0 ? 'active' : 'not_started');

    activities.push({
      code: t.uid,
      name: t.name,
      milestone: isMilestone,
      hasPredecessor, hasSuccessor, predecessors: t.predecessorUids,
      start,
      end,
      durationDays: durationDays != null ? Math.round(durationDays * 10) / 10 : (isMilestone ? 0 : 1),
      totalFloatDays: floatDays,
      // MSPDI already tells us whether a task is on the critical path (it accounts for
      // calendars/constraints this app can't recompute) — prefer that over deriving it from
      // float, falling back to the float-based rule only if <Critical> wasn't present.
      critical: t.critical || (floatDays !== null && floatDays <= 0),
      plannedStart: t.baselineStart ? t.baselineStart.slice(0, 10) : null,
      plannedEnd: t.baselineFinish ? t.baselineFinish.slice(0, 10) : null,
      actualStart: start,
      actualEnd: end,
      status,
      percentComplete: t.percentComplete
    });

    // Runs for every task, milestone or not, and before the isMilestone branch — see the identical
    // comment in analyzeXER for why order matters here (a reversed-date task can otherwise get
    // silently reclassified as a milestone upstream and skip this check entirely).
    {
      const actualStartDate = t.percentComplete > 0 && t.start ? new Date(t.start) : null;
      const actualEndDate = t.percentComplete >= 100 && t.finish ? new Date(t.finish) : null;
      const plannedStartDate = t.baselineStart ? new Date(t.baselineStart) : null;
      const plannedEndDate = t.baselineFinish ? new Date(t.baselineFinish) : null;
      invalidDateIssues(plannedStartDate, plannedEndDate, actualStartDate, actualEndDate, new Date()).forEach(problem => {
        issues.push({ name: t.name + ' ' + problem, sub: (isMilestone ? 'Milestone ' : 'Activity ') + t.uid + ' · invalid dates', sev: 'risk' });
        nRisk++;
      });
    }

    if (isMilestone) {
      totalMilestones++;
      let flagged = false;
      if (!hasPredecessor || !hasSuccessor) {
        issues.push({ name: t.name + ' milestone has no predecessor or successor', sub: 'Milestone ' + t.uid + ' · missing logic anchor', sev: 'crit' });
        nCrit++;
        flagged = true;
      }
      if (floatDays !== null && floatDays < 0) {
        issues.push({ name: t.name + ' milestone has negative float', sub: 'Milestone ' + t.uid + ' · already behind', sev: 'crit' });
        nCrit++;
        flagged = true;
      }
      if (flagged) milestoneIssueCount++;
      return;
    }
    total++;
    const name = t.name;
    const code = t.uid;

    if (floatDays !== null && floatDays < 0) {
      issues.push({ name: name + ' has negative float', sub: 'Activity ' + code + ' · already behind', sev: 'crit' });
      nCrit++;
    }
    if (!predCount[t.uid] && !succCount[t.uid]) {
      issues.push({ name: name + ' has no predecessor or successor', sub: 'Activity ' + code + ' · missing logic', sev: 'crit' });
      nCrit++;
    }
    if (floatDays !== null && floatDays > 44) {
      issues.push({ name: name + ' has ' + Math.round(floatDays) + ' days of float', sub: 'Activity ' + code + ' · excessive float', sev: 'risk' });
      nRisk++;
    }
    if (durationDays !== null && durationDays > 44 && t.percentComplete < 100) {
      issues.push({ name: name + ' runs ' + Math.round(durationDays) + ' days, longer than 44-day guidance', sub: 'Activity ' + code + ' · long duration', sev: 'risk' });
      nRisk++;
    }
  });

  const { score, healthyPct, riskPct, critPct } = scoreFrom(total, nCrit, nRisk);
  const subScores = subScoresFrom(issues, total);
  const milestoneHealth = milestoneHealthFrom(milestoneIssueCount, totalMilestones);
  const hasDates = activities.some(a => a.start);
  return { score, healthyPct, riskPct, critPct, issues, activities, hasDates, totalActivities: total, critCount: nCrit, riskCount: nRisk, ...subScores, milestoneHealth };
}

function analyzeFile(filename, text) {
  const lower = filename.toLowerCase();
  const isXER = lower.endsWith('.xer') || text.includes('%T\tTASK');
  if (isXER) return analyzeXER(parseXER(text));
  const isMspXml = lower.endsWith('.xml') || (/<Project[\s>]/.test(text) && text.includes('<Tasks>'));
  if (isMspXml) return analyzeMspXml(parseMspXml(text));
  return analyzeCSVTasks(parseCSV(text));
}

// Duration-weighted "Earned Schedule" metrics — a real, established schedule-only analog to
// cost-based EVM (Lipke's Earned Schedule method), needing no cost or resource-loading data at
// all. Each non-milestone activity with real planned dates is weighted by its own duration (not a
// cost or resource weight, since neither exists in a bare schedule file) — a documented, honest
// simplification, never presented as a true cost-weighted S-curve. Activities lacking planned
// dates (the CSV format always, XER/MSPDI sometimes) are excluded from the weighted average rather
// than guessed, and the count excluded is returned so the UI can disclose it. Returns
// { available: false, reason } outright when NO activity has planned dates, rather than showing a
// number with no real basis at all.
function computeEarnedSchedule(activities, asOfDate) {
  const asOf = asOfDate ? new Date(asOfDate) : new Date();
  const nonMilestones = (activities || []).filter(a => !a.milestone);
  const weighted = nonMilestones.filter(a => a.plannedStart && a.plannedEnd && a.durationDays > 0);
  if (!weighted.length) {
    return { available: false, reason: 'No planned/baseline dates found in this file — earned schedule needs a baseline to compare progress against.' };
  }

  let totalWeight = 0, plannedWeighted = 0, actualWeighted = 0;
  weighted.forEach(a => {
    const plannedStart = new Date(a.plannedStart);
    const weight = a.durationDays;
    const elapsedDays = Math.max(0, Math.min(a.durationDays, (asOf - plannedStart) / 86400000));
    const plannedFraction = elapsedDays / a.durationDays;
    const actualFraction = (a.percentComplete != null ? a.percentComplete : 0) / 100;
    totalWeight += weight;
    plannedWeighted += weight * plannedFraction;
    actualWeighted += weight * actualFraction;
  });

  const plannedProgressPct = Math.round((plannedWeighted / totalWeight) * 1000) / 10;
  const actualProgressPct = Math.round((actualWeighted / totalWeight) * 1000) / 10;
  const svPoints = Math.round((actualProgressPct - plannedProgressPct) * 10) / 10;
  // SPI(t)-style ratio — left undefined (null, not zero and not fabricated) when planned progress
  // is near zero, since dividing by a near-zero denominator produces a meaningless swing, not a
  // real signal — most often true right at the very start of a project.
  const spi = plannedProgressPct > 1 ? Math.round((actualProgressPct / plannedProgressPct) * 100) / 100 : null;

  return {
    available: true,
    asOfDate: asOf.toISOString().slice(0, 10),
    plannedProgressPct,
    actualProgressPct,
    svPoints,
    spi,
    activitiesConsidered: weighted.length,
    activitiesExcluded: nonMilestones.length - weighted.length
  };
}

// Independent Estimated Completion Date (IECD) — the standard Earned Schedule forecasting
// formula (Lipke's IEAC(t) = AT + (PD - ES) / PF), built on the exact same duration-weighted
// proxy computeEarnedSchedule already uses, so it inherits that function's honesty caveats
// (schedule-only, no cost/resource weighting, real baseline dates required). Two scenarios are
// returned instead of one over-precise number: "at current pace" (PF = SPI(t), i.e. if the recent
// trend holds) and "if back on plan" (PF = 1.0, the best case where all remaining work proceeds
// exactly as originally planned from today forward). This is NOT a Monte Carlo / probabilistic
// risk simulation -- that needs per-activity duration-variance data Ordo7 doesn't have. It's the
// same published formula EVM tools use for a schedule-only IEAC(t), presented as exactly what it
// is: two scenario estimates, not a confidence interval.
function computeFinishForecast(activities, asOfDate, earnedScheduleResult) {
  const asOf = asOfDate ? new Date(asOfDate) : new Date();
  const nonMilestones = (activities || []).filter(a => !a.milestone);
  const weighted = nonMilestones.filter(a => a.plannedStart && a.plannedEnd && a.durationDays > 0);
  if (!weighted.length) {
    return { available: false, reason: 'No planned/baseline dates found in this file — a finish forecast needs a baseline to project from.' };
  }

  const projectStart = new Date(Math.min(...weighted.map(a => new Date(a.plannedStart))));
  const projectPlannedFinish = new Date(Math.max(...weighted.map(a => new Date(a.plannedEnd))));
  const plannedDurationDays = (projectPlannedFinish - projectStart) / 86400000;
  if (!(plannedDurationDays > 0)) {
    return { available: false, reason: 'Planned start and finish collapse to zero duration in this baseline — cannot project a forecast from it.' };
  }

  const es = earnedScheduleResult || computeEarnedSchedule(activities, asOf);
  if (!es.available) return { available: false, reason: es.reason };
  if (es.spi == null) {
    return { available: false, reason: 'Not enough elapsed planned progress yet to compute a performance factor — check back once the project is further along.' };
  }
  if (es.actualProgressPct <= 0) {
    return { available: false, reason: 'No actual progress recorded yet against this baseline — nothing to project a trend from.' };
  }

  // Earned schedule (in days) is the time-equivalent of progress actually achieved, under the
  // same linear/uniform assumption already implicit in computeEarnedSchedule's duration weighting.
  const actualTimeElapsedDays = Math.max(0, (asOf - projectStart) / 86400000);
  const earnedScheduleDays = (es.actualProgressPct / 100) * plannedDurationDays;
  const remainingScheduleDays = plannedDurationDays - earnedScheduleDays;

  function forecastFinish(performanceFactor) {
    if (!(performanceFactor > 0)) return null;
    const iecdDays = actualTimeElapsedDays + remainingScheduleDays / performanceFactor;
    return new Date(projectStart.getTime() + iecdDays * 86400000).toISOString().slice(0, 10);
  }

  return {
    available: true,
    asOfDate: asOf.toISOString().slice(0, 10),
    plannedFinishDate: projectPlannedFinish.toISOString().slice(0, 10),
    atCurrentPace: forecastFinish(es.spi),
    ifBackOnPlan: forecastFinish(1.0),
    performanceFactorUsed: es.spi,
    method: 'Earned Schedule IEAC(t) — duration-weighted proxy, schedule-only (no cost/resource data)'
  };
}

// 0.90 is a common EVM/DCMA convention for "at risk" (as opposed to 1.0 = exactly on plan) —
// used here, not 1.0, so ordinary day-to-day noise around plan doesn't trip the alert.
const RECOVERY_ALERT_SPI_THRESHOLD = 0.9;

// Per SmartPM's 2026 industry report, a mid-project SPI dip with no recovery response was the
// single strongest predictor of a bad outcome found in their causal study (~2.5x worse than
// projects that responded). This is an honest, narrower proxy for that finding, not a
// reimplementation of it: the report's own causal study specifically measured "end date slipped
// beyond critical-path delay with no recovery plan," which needs baseline-finish-date tracking
// Ordo7 doesn't do. What this function actually checks is the trend it *can* see from data it
// already has — has schedule-only SPI stayed below the at-risk threshold across a project's last
// few snapshots with no sign of recovering — which is a real, honest, narrower signal, not a claim
// to reproduce the report's exact causal finding.
//
// spiHistory: array of { snapshotId, createdAt, spi } ordered oldest -> newest, already filtered
// to entries where spi is non-null (see computeEarnedSchedule's own null-when-not-computable rule).
function computeRecoveryAlert(spiHistory) {
  if (!spiHistory || spiHistory.length < 2) {
    return { available: false, reason: 'Needs at least two snapshots with a computable SPI to check for a trend.' };
  }
  const recent = spiHistory.slice(-3);
  const belowCount = recent.filter(p => p.spi < RECOVERY_ALERT_SPI_THRESHOLD).length;
  const earliest = recent[0];
  const latest = recent[recent.length - 1];
  const sustainedLow = belowCount >= 2 && latest.spi < RECOVERY_ALERT_SPI_THRESHOLD;
  // Small tolerance, not a strict >, so rounding noise between snapshots doesn't read as recovery.
  const improving = latest.spi > earliest.spi + 0.02;
  const triggered = sustainedLow && !improving;
  return {
    available: true,
    triggered,
    threshold: RECOVERY_ALERT_SPI_THRESHOLD,
    spiTrend: recent,
    reason: triggered
      ? 'SPI has stayed below ' + RECOVERY_ALERT_SPI_THRESHOLD + ' across the last ' + recent.length + ' snapshots with no sign of recovery.'
      : (sustainedLow
          ? 'SPI was below ' + RECOVERY_ALERT_SPI_THRESHOLD + ' but is trending back up.'
          : 'SPI is not sustained below ' + RECOVERY_ALERT_SPI_THRESHOLD + '.')
  };
}

module.exports = { parseXER, parseCSV, parseMspXml, analyzeXER, analyzeCSVTasks, analyzeMspXml, analyzeFile, computeEarnedSchedule, computeRecoveryAlert, computeFinishForecast };
