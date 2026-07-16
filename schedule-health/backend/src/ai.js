// ai.js — AI-generated report narrative via the Claude API (raw HTTPS, no SDK dependency)
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

function aiConfigured() {
  return !!process.env.ANTHROPIC_API_KEY;
}

function buildScheduleContext(snapshot, issues) {
  const topIssues = issues
    .filter(i => i.status !== 'resolved')
    .slice(0, 8)
    .map(i => `- [${i.severity.toUpperCase()}] ${i.name} — ${i.sub}`)
    .join('\n') || '(none open)';

  return `Schedule health data:
- Health score: ${snapshot.score}/100
- Total activities: ${snapshot.total_activities}
- Healthy: ${snapshot.healthy_pct}%, At risk: ${snapshot.risk_pct}%, Critical: ${snapshot.crit_pct}%
- Critical issues: ${snapshot.crit_count}, Risk issues: ${snapshot.risk_count}

Top open issues:
${topIssues}`;
}

function buildPrompt(snapshot, issues) {
  return `You are a scheduling/PMO analyst writing a short narrative summary for a project schedule health report. Be direct and specific, no fluff, no generic advice. Write 3-4 short paragraphs (plain text, no markdown headers) covering: overall health, what's driving the score, and the most important 1-2 actions to take next.

${buildScheduleContext(snapshot, issues)}`;
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
    if (!text) return null;
    return {
      text,
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0
    };
  } catch (err) {
    console.error('[ai] generateNarrative failed', err.message);
    return null;
  }
}

// Multi-turn Q&A about a specific schedule. `history` is prior chat_messages rows
// ({role, content}, oldest first) for that snapshot; `userMessage` is the new question.
// Anthropic caps conversation length via max_tokens per turn, not overall — the caller is
// responsible for capping how much history gets resent if a conversation gets very long.
async function generateChatReply(snapshot, issues, history, userMessage) {
  if (!aiConfigured()) return null;
  // Two things this needs to do, not one: answer questions grounded in the specific schedule
  // below (use its real numbers, don't hand-wave), AND answer general project management/project
  // controls/scheduling questions — DCMA checks, EVM, critical path method, float, constraints,
  // baselines, how to run a status meeting, PMBOK concepts, whatever — even when the question has
  // nothing to do with this particular file. The schedule data is context to draw on when
  // relevant, not a boundary that caps what can be asked.
  const system = `You are Ask Ordo, a project controls and scheduling analyst built into Ordo7. You answer two kinds of questions, and you shouldn't refuse or deflect either one:
1. Questions about the specific schedule below — ground these in its real numbers (score, issues, float, dates). Be direct and specific, not generic, when the data is relevant.
2. General project management, project controls, and scheduling questions — DCMA 14-point checks, earned value management, critical path method, float and constraint types, baseline management, resource leveling, how to run status meetings or claims, PMBOK/PMI concepts, industry terminology, and anything else a working PMO analyst would know. Answer these the same way a knowledgeable human consultant would, even when they have nothing to do with the schedule loaded below.

Keep answers conversational and concise (a few sentences, longer only if the question genuinely needs it). Reply in plain text only — no markdown (no **bold**, no headers, no bullet asterisks); use plain numbered or dashed lines if you need a list.

${buildScheduleContext(snapshot, issues)}`;

  const messages = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage }
  ];

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
        max_tokens: 500,
        system,
        messages
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[ai] Claude API error', res.status, text);
      return null;
    }
    const data = await res.json();
    const text = (data.content || []).map(block => block.text || '').join('').trim();
    if (!text) return null;
    return {
      text,
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0
    };
  } catch (err) {
    console.error('[ai] generateChatReply failed', err.message);
    return null;
  }
}

module.exports = { aiConfigured, generateNarrative, generateChatReply };
