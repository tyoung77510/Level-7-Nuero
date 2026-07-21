// mailerlite.js — adds blog newsletter signups to a MailerLite group so they enter the
// "Ordo7 Blog — Welcome & Content Drip" automation (which triggers on subscriber_joins_group).
// Reads MAILERLITE_API_KEY from the environment; see backend/.env.example. No-ops (with a console
// warning) until that's set, so the blog signup form degrades gracefully — same pattern as knock.js.
const MAILERLITE_API = 'https://connect.mailerlite.com/api';

// The group the blog signup form feeds. Defaults to the "Ordo7 Blog Subscribers" group created in
// the MailerLite account; override via env if that group is ever recreated with a new id.
const BLOG_GROUP_ID = process.env.MAILERLITE_BLOG_GROUP_ID || '193524211311970129';

function mailerliteConfigured() {
  return Boolean(process.env.MAILERLITE_API_KEY);
}

// Upserts a subscriber into the blog group. MailerLite's create endpoint is idempotent — posting an
// email that already exists updates it and re-affirms group membership rather than erroring, so a
// double submit is harmless. Returns the API's subscriber object on success, or null on any failure
// (unconfigured, network error, non-2xx) — callers decide how to surface that to the visitor.
async function addBlogSubscriber(email) {
  if (!mailerliteConfigured()) {
    console.warn(`[mailerlite] MAILERLITE_API_KEY not set — skipping blog subscribe for ${email}`);
    return null;
  }
  try {
    const res = await fetch(`${MAILERLITE_API}/subscribers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MAILERLITE_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ email, groups: [BLOG_GROUP_ID] })
    });
    if (!res.ok) {
      console.error(`[mailerlite] Failed to subscribe ${email}: ${res.status} ${await res.text().catch(() => '')}`);
      return null;
    }
    return res.json();
  } catch (e) {
    console.error(`[mailerlite] Failed to subscribe ${email}:`, e.message);
    return null;
  }
}

module.exports = { mailerliteConfigured, addBlogSubscriber, BLOG_GROUP_ID };
