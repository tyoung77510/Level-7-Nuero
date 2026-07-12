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

// Notifies the Level 7 team when a user submits feedback, by triggering a Knock workflow.
// Requires KNOCK_FEEDBACK_WORKFLOW_KEY (a workflow you build in the Knock dashboard — e.g. one
// that emails/Slacks the team) and KNOCK_FEEDBACK_RECIPIENT_EMAIL. No-ops gracefully, same as
// identifyUser, if any of that isn't configured yet — feedback is still saved to the database
// either way, so nothing is lost while this gets set up.
async function notifyFeedback(user, message) {
  const workflowKey = process.env.KNOCK_FEEDBACK_WORKFLOW_KEY || 'ordo7-feedback';
  const recipientEmail = process.env.KNOCK_FEEDBACK_RECIPIENT_EMAIL;
  if (!knockConfigured() || !recipientEmail) {
    console.warn(`[knock] Feedback notification skipped (KNOCK_API_KEY or KNOCK_FEEDBACK_RECIPIENT_EMAIL not set) — feedback from ${user.email} is still saved to the database`);
    return null;
  }
  try {
    const res = await fetch(`${KNOCK_API}/workflows/${encodeURIComponent(workflowKey)}/trigger`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.KNOCK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipients: [{ id: 'ordo7-team', email: recipientEmail }],
        data: { userName: user.name, userEmail: user.email, message }
      })
    });
    if (!res.ok) {
      console.error(`[knock] Failed to trigger feedback workflow: ${res.status} ${await res.text().catch(() => '')}`);
      return null;
    }
    return res.json();
  } catch (e) {
    console.error('[knock] Failed to trigger feedback workflow:', e.message);
    return null;
  }
}

module.exports = { knockConfigured, identifyUser, notifyFeedback };
