// knock.js — syncs signups to Knock (knock.app) so they land in your nurture/marketing workflows.
// Reads KNOCK_API_KEY from the environment; see backend/.env.example. No-ops (with a console
// warning) until that's set, so signup never fails because of a missing marketing integration.
const KNOCK_API = 'https://api.knock.app/v1';

function knockConfigured() {
  return Boolean(process.env.KNOCK_API_KEY);
}

async function identifyUser(user) {
  if (!knockConfigured()) {
    console.warn(`[knock] KNOCK_API_KEY not set — skipping lead sync for ${user.email}`);
    return null;
  }
  try {
    const res = await fetch(`${KNOCK_API}/users/${encodeURIComponent(String(user.id))}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${process.env.KNOCK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: user.name,
        email: user.email,
        phone_number: user.phone || undefined
      })
    });
    if (!res.ok) {
      console.error(`[knock] Failed to sync ${user.email}: ${res.status} ${await res.text().catch(() => '')}`);
      return null;
    }
    return res.json();
  } catch (e) {
    console.error(`[knock] Failed to sync ${user.email}:`, e.message);
    return null;
  }
}

module.exports = { knockConfigured, identifyUser };
