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
  const pct = (n) => Math.max(0, Math.min(100, Math.round(100 - (n / Math.max(total, 1)) * 100)));
  return {
    logicQuality: pct(logicIssues),
    floatDistribution: pct(floatIssues),
    constraintHygiene: pct(constraintIssues)
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

  tasks.forEach(t => {
    const activityName = t.task_name || t.task_code || 'unnamed activity';
    const activityFloat = parseFloat(t.total_float_hr_cnt);
    const floatDays = isNaN(activityFloat) ? null : Math.round((activityFloat / 8) * 10) / 10;
    const start = parseXerDate(t.act_start_date) || parseXerDate(t.target_start_date) || parseXerDate(t.early_start_date);
    const end = parseXerDate(t.act_end_date) || parseXerDate(t.target_end_date) || parseXerDate(t.early_end_date);
    const drtnHrs = parseFloat(t.remain_drtn_hr_cnt || t.target_drtn_hr_cnt);
    const durationDays = !isNaN(drtnHrs) ? Math.max(0, drtnHrs / 8) : (start && end ? Math.max(0, (end - start) / 86400000) : 1);
    activities.push({
      code: t.task_code || t.task_id,
      name: activityName,
      milestone: t.task_type === 'TT_Mile',
      start: start ? start.toISOString().slice(0, 10) : null,
      end: end ? end.toISOString().slice(0, 10) : (start ? new Date(start.getTime() + durationDays * 86400000).toISOString().slice(0, 10) : null),
      durationDays: Math.round(durationDays * 10) / 10,
      totalFloatDays: floatDays,
      critical: floatDays !== null && floatDays <= 0
    });

    if (t.task_type === 'TT_Mile') return;
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
  const hasDates = activities.some(a => a.start);
  return { score, healthyPct, riskPct, critPct, issues, activities, hasDates, totalActivities: total, critCount: nCrit, riskCount: nRisk, ...subScores };
}

function analyzeCSVTasks(csvTasks) {
  const issues = [];
  const activities = [];
  let nCrit = 0, nRisk = 0;
  const total = csvTasks.length;
  let cumulativeDays = 0;

  csvTasks.forEach(t => {
    const name = t.task_name || t.task_code || 'unnamed activity';
    const code = t.task_code || '';
    const tf = parseFloat(t.total_float_days);
    const dur = parseFloat(t.duration_days);
    const preds = (t.predecessors || '').trim();

    // No dates in this format — lay activities out sequentially by file order instead of a
    // calendar. dayOffset is days-from-start-of-file, not a real date.
    const durationDays = !isNaN(dur) ? Math.max(0, dur) : 1;
    activities.push({
      code, name, milestone: false,
      start: null, end: null,
      dayOffset: Math.round(cumulativeDays * 10) / 10,
      durationDays: Math.round(durationDays * 10) / 10,
      totalFloatDays: isNaN(tf) ? null : tf,
      critical: !isNaN(tf) && tf <= 0
    });
    cumulativeDays += durationDays;

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
  return { score, healthyPct, riskPct, critPct, issues, activities, hasDates: false, totalActivities: total, critCount: nCrit, riskCount: nRisk, ...subScores };
}

function analyzeFile(filename, text) {
  const isXER = filename.toLowerCase().endsWith('.xer') || text.includes('%T\tTASK');
  if (isXER) return analyzeXER(parseXER(text));
  return analyzeCSVTasks(parseCSV(text));
}

module.exports = { parseXER, parseCSV, analyzeXER, analyzeCSVTasks, analyzeFile };
