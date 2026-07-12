// ai.js — AI-generated report narrative via the Claude API (raw HTTPS, no SDK dependency)
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

function aiConfigured() {
  return !!process.env.ANTHROPIC_API_KEY;
}

function buildPrompt(snapshot, issues) {
  const topIssues = issues
    .filter(i => i.status !== 'resolved')
    .slice(0, 8)
    .map(i => `- [${i.severity.toUpperCase()}] ${i.name} — ${i.sub}`)
    .join('\n') || '(none open)';

  return `You are a scheduling/PMO analyst writing a short narrative summary for a project schedule health report. Be direct and specific, no fluff, no generic advice. Write 3-4 short paragraphs (plain text, no markdown headers) covering: overall health, what's driving the score, and the most important 1-2 actions to take next.

Schedule health data:
- Health score: ${snapshot.score}/100
- Total activities: ${snapshot.total_activities}
- Healthy: ${snapshot.healthy_pct}%, At risk: ${snapshot.risk_pct}%, Critical: ${snapshot.crit_pct}%
- Critical issues: ${snapshot.crit_count}, Risk issues: ${snapshot.risk_count}

Top open issues:
${topIssues}`;
}

async function generateNarrative(snapshot, issues) {
  if (!aiConfigured()) return null;
  try {
    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        messages: [{ role: 'user', content: buildPrompt(snapshot, issues) }]
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[ai] Claude API error', res.status, text);
      return null;
    }
    const data = await res.json();
    const text = (data.content || []).map(block => block.text || '').join('').trim();
    return text || null;
  } catch (err) {
    console.error('[ai] generateNarrative failed', err.message);
    return null;
  }
}

module.exports = { aiConfigured, generateNarrative };
