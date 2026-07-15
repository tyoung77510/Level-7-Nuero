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
    activities.push({
      code: t.task_code || t.task_id,
      name: activityName,
      milestone: isMilestone,
      hasPredecessor, hasSuccessor,
      start: start ? start.toISOString().slice(0, 10) : null,
      end: end ? end.toISOString().slice(0, 10) : (start ? new Date(start.getTime() + durationDays * 86400000).toISOString().slice(0, 10) : null),
      durationDays: Math.round(durationDays * 10) / 10,
      totalFloatDays: floatDays,
      critical: floatDays !== null && floatDays <= 0
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
        const predTask = tasks.find(x => x.task_id === p.pred_task_id);
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
      hasPredecessor, hasSuccessor,
      start: null, end: null,
      dayOffset: Math.round(cumulativeDays * 10) / 10,
      durationDays: Math.round(durationDays * 10) / 10,
      totalFloatDays: isNaN(tf) ? null : tf,
      critical: !isNaN(tf) && tf <= 0
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

    activities.push({
      code: t.uid,
      name: t.name,
      milestone: isMilestone,
      hasPredecessor, hasSuccessor,
      start,
      end,
      durationDays: durationDays != null ? Math.round(durationDays * 10) / 10 : (isMilestone ? 0 : 1),
      totalFloatDays: floatDays,
      // MSPDI already tells us whether a task is on the critical path (it accounts for
      // calendars/constraints this app can't recompute) — prefer that over deriving it from
      // float, falling back to the float-based rule only if <Critical> wasn't present.
      critical: t.critical || (floatDays !== null && floatDays <= 0)
    });

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

module.exports = { parseXER, parseCSV, parseMspXml, analyzeXER, analyzeCSVTasks, analyzeMspXml, analyzeFile };
