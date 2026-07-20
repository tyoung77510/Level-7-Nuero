// mailerlite.js — blog newsletter subscription via MailerLite's REST API (raw HTTPS, no SDK),
// same zero-dependency philosophy as every other integration in this codebase.
const BLOG_SUBSCRIBERS_GROUP_ID = '193524211311970129'; // "Ordo7 Blog Subscribers" group

function mailerliteConfigured() {
  return !!process.env.MAILERLITE_API_KEY;
}

// Adds (or updates) a subscriber in the blog subscribers group. MailerLite's upsert-by-email
// behavior means calling this twice for the same address is safe — it doesn't create a
// duplicate or error, just re-confirms group membership.
async function subscribeToBlog(email) {
  if (!mailerliteConfigured()) return { ok: false, reason: 'not_configured' };
  try {
    const res = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MAILERLITE_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ email, groups: [BLOG_SUBSCRIBERS_GROUP_ID] })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[mailerlite] subscribe failed', res.status, text);
      return { ok: false, reason: 'api_error', status: res.status };
    }
    return { ok: true };
  } catch (e) {
    console.error('[mailerlite] subscribe request failed:', e.message);
    return { ok: false, reason: 'request_failed' };
  }
}

module.exports = { mailerliteConfigured, subscribeToBlog };
