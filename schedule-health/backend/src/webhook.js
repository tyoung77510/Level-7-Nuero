// webhook.js — outbound event delivery to a user-configured URL. A Slack Incoming Webhook and
// Zapier's "Webhooks by Zapier" catch trigger both just need a JSON POST, so one payload shape
// (a "text" field Slack renders as the message, plus structured fields Zapier can map) serves
// both destinations without separate integration code per platform.
const dns = require('node:dns').promises;
const net = require('node:net');

// Standard SSRF blocklist: loopback, RFC1918 private ranges, and link-local (which covers cloud
// metadata endpoints like 169.254.169.254) -- a user-supplied webhook URL must never be able to
// reach internal infrastructure this server can see but the public internet can't.
function isPrivateOrReservedIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    return false;
  }
  const lower = ip.toLowerCase();
  return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80');
}

// Checked both when a user saves/tests a URL (for immediate feedback) and again on every actual
// delivery (since DNS can change between save time and fire time) -- not a complete defense
// against DNS-rebinding (the fetch below re-resolves rather than connecting to the pinned IP
// checked here), but it stops the overwhelmingly common case of a URL that's internal by design.
async function isSafeWebhookUrl(urlStr) {
  let parsed;
  try { parsed = new URL(urlStr); } catch (e) { return false; }
  if (parsed.protocol !== 'https:') return false;
  if (parsed.hostname === 'localhost') return false;
  try {
    let addresses;
    try { addresses = await dns.resolve4(parsed.hostname); }
    catch (e) { addresses = await dns.resolve6(parsed.hostname); }
    return addresses.length > 0 && addresses.every(ip => !isPrivateOrReservedIp(ip));
  } catch (e) {
    return false; // unresolvable -- fail closed
  }
}

// Returns { ok, reason? } rather than throwing -- callers that only fire-and-forget (the analyze
// route) simply don't await this in a blocking way and can ignore the result, while a caller that
// genuinely needs to know whether delivery worked (the "send test" button) can report it
// accurately instead of a fire-and-forget call always claiming success.
async function deliverWebhook(webhookUrl, payload) {
  if (!webhookUrl) return { ok: false, reason: 'No webhook URL configured' };
  const safe = await isSafeWebhookUrl(webhookUrl);
  if (!safe) return { ok: false, reason: 'URL is not a reachable public https:// address' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!res.ok) return { ok: false, reason: `Endpoint responded with HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.name === 'AbortError' ? 'Endpoint took too long to respond' : 'Endpoint was unreachable' };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { deliverWebhook, isSafeWebhookUrl };
