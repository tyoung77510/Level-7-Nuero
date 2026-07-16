// ai.js — AI-generated report narrative via the Claude API (raw HTTPS, no SDK dependency)
// Override only exists for local testing against a mock server that speaks the same SSE wire
// format — never set in any real deployment, so this always points at the real API in production.
const ANTHROPIC_API = process.env.ANTHROPIC_API_BASE_URL || 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

function aiConfigured() {
  return !!process.env.ANTHROPIC_API_KEY;
}

// aiConfigured() only proves the env var is *set* — an expired or revoked key still passes it,
// which is exactly what silently broke Ask Ordo in production for days before anyone noticed.
// This makes one real, cheap call (GET /v1/models needs a valid key but returns no generated
// tokens, so it's free) and caches the result briefly so /api/health can call it on every hit
// without hammering Anthropic if something like an uptime monitor pings it often.
let keyCheckCache = null; // { ok: boolean, checkedAt: number }
const KEY_CHECK_TTL_MS = 5 * 60 * 1000;

async function verifyApiKeyWorks() {
  if (!aiConfigured()) return false;
  if (keyCheckCache && Date.now() - keyCheckCache.checkedAt < KEY_CHECK_TTL_MS) return keyCheckCache.ok;
  let ok = false;
  try {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }
    });
    ok = res.ok;
    if (!ok) console.error('[ai] API key check failed', res.status, await res.text().catch(() => ''));
  } catch (err) {
    console.error('[ai] API key check failed', err.message);
  }
  keyCheckCache = { ok, checkedAt: Date.now() };
  return ok;
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

// Multi-turn Q&A about a specific schedule, streamed token-by-token. `history` is prior
// chat_messages rows ({role, content}, oldest first) for that snapshot; `userMessage` is the new
// question; `onChunk(text)` is called for each text fragment as it arrives so the caller can
// forward it to the client in real time instead of waiting for the full reply. Anthropic caps
// conversation length via max_tokens per turn, not overall — the caller is responsible for
// capping how much history gets resent if a conversation gets very long.
async function generateChatReplyStream(snapshot, issues, history, userMessage, onChunk) {
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

Keep answers conversational and concise (a few sentences, longer only if the question genuinely needs it). Formatting: you may use **bold** for emphasis and "- " or "1. " for lists — nothing else renders, so don't use headers (#), code blocks, tables, or links.

${buildScheduleContext(snapshot, issues)}`;

  const messages = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage }
  ];

  return streamAnthropicMessage(system, messages, 500, onChunk, 'generateChatReplyStream');
}

// Shared by every streamed Claude call in this file (Ask Ordo, the admin Business Advisor).
// Anthropic's streaming Messages API is server-sent events: one `data: {...}` line per event. The
// pieces this needs are spread across three event types — message_start carries input_tokens,
// content_block_delta carries each text fragment, and the final message_delta carries the
// completed output_tokens count (not incremental — it's the running total, so the last one seen
// is the real figure).
async function streamAnthropicMessage(system, messages, maxTokens, onChunk, callerName) {
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
        max_tokens: maxTokens,
        system,
        messages,
        stream: true
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[ai] Claude API error', res.status, text);
      return null;
    }

    let fullText = '', inputTokens = 0, outputTokens = 0, buffer = '';
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // last entry may be a partial line split across chunks — keep it
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        let evt;
        try { evt = JSON.parse(line.slice(6)); } catch (e) { continue; }
        if (evt.type === 'message_start') {
          inputTokens = evt.message?.usage?.input_tokens || 0;
        } else if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
          fullText += evt.delta.text;
          onChunk(evt.delta.text);
        } else if (evt.type === 'message_delta') {
          outputTokens = evt.usage?.output_tokens || outputTokens;
        }
      }
    }
    if (!fullText) return null;
    return { text: fullText, inputTokens, outputTokens };
  } catch (err) {
    console.error(`[ai] ${callerName} failed`, err.message);
    return null;
  }
}

// The Admin Command Center's Business Advisor — analyzes the real operational data pulled from
// this app's own admin endpoints (telemetry, feature flags, feedback backlog) from the
// perspective of a CTO/CEO/CFO, to help the owner make product/pricing/ops decisions. `dataContext`
// is a plain-text summary of real numbers built by the caller (server.js) from the same store
// functions the admin console itself uses — never fabricated, and the model is explicitly told not
// to invent numbers beyond what's given.
async function generateAdvisorReplyStream(dataContext, history, userMessage, onChunk) {
  if (!aiConfigured()) return null;
  const system = `You are the Business Advisor inside Ordo7's internal Admin Command Center — a single voice that reasons like an experienced startup CTO, CEO, and CFO at once, advising the founder of this SaaS business.

Ground every answer in the real operational data below — it's a live snapshot pulled directly from the production database moments ago. Never invent a number that isn't in it. If a question needs data that isn't provided (e.g. churn rate, CAC, cohort retention — none of which this app tracks yet), say plainly that the data doesn't exist yet rather than guessing or estimating one.

Be direct and decisive, not diplomatic — this is a "Truth-Teller" brand: no hedging, no generic startup-advice filler, no "it depends" without then actually picking a side. Give a specific recommendation when asked for one. Flag risks the founder might not be looking at (e.g. a feature flag with broad blast radius, a feedback backlog going stale, a tier mix that's too free-heavy). When the data is genuinely too thin to support a real conclusion, say that instead of padding an answer.

Formatting: you may use **bold** for emphasis and "- " or "1. " for lists — nothing else renders, so don't use headers (#), code blocks, tables, or links. Keep answers tight — a few sentences to a short paragraph, longer only if the question genuinely needs the detail.

${dataContext}`;

  const messages = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage }
  ];

  return streamAnthropicMessage(system, messages, 600, onChunk, 'generateAdvisorReplyStream');
}

module.exports = { aiConfigured, verifyApiKeyWorks, generateNarrative, generateChatReplyStream, generateAdvisorReplyStream };
