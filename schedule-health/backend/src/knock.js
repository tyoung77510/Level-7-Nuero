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

// Email verification uses its own opt-in flag (KNOCK_VERIFICATION_WORKFLOW_KEY) rather than just
// knockConfigured(), since it changes signup behavior (see server.js): verification is only
// required at all once this workflow is actually set up. Local dev without it stays frictionless.
function verificationConfigured() {
  return knockConfigured() && Boolean(process.env.KNOCK_VERIFICATION_WORKFLOW_KEY);
}

// Sends the "verify your email" link by triggering a Knock workflow you build in the dashboard
// (e.g. one that emails the user with a "Verify your email" button linking to `verification_url`).
// Payload shape (recipients as full objects + data.verification_url) matches the trigger data
// schema generated for the `ordo7-verify-email` workflow in the Knock dashboard — the template
// there reads {{ recipient.name }} and {{ data.verification_url }}, not data.userName/verifyUrl.
async function sendVerificationEmail(user, verifyUrl) {
  const workflowKey = process.env.KNOCK_VERIFICATION_WORKFLOW_KEY;
  if (!verificationConfigured()) {
    console.warn(`[knock] Verification email skipped (KNOCK_API_KEY or KNOCK_VERIFICATION_WORKFLOW_KEY not set) for ${user.email}`);
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
        recipients: [{ id: String(user.id), email: user.email, name: user.name }],
        data: { verification_url: verifyUrl }
      })
    });
    if (!res.ok) {
      console.error(`[knock] Failed to trigger verification workflow: ${res.status} ${await res.text().catch(() => '')}`);
      return null;
    }
    return res.json();
  } catch (e) {
    console.error('[knock] Failed to trigger verification workflow:', e.message);
    return null;
  }
}

// Sends a Teams seat invite by triggering a Knock workflow (same pattern as verification email).
// Gated on its own workflow key rather than just knockConfigured() since, like verification, it's
// an opt-in email type — inviteUrl is also returned directly from the /api/team/invite response
// regardless of whether this succeeds, so an owner can still copy/share the link by hand if Knock
// isn't set up yet.
function teamInviteConfigured() {
  return knockConfigured() && Boolean(process.env.KNOCK_TEAM_INVITE_WORKFLOW_KEY);
}

async function sendTeamInviteEmail(ownerUser, inviteeEmail, inviteUrl) {
  const workflowKey = process.env.KNOCK_TEAM_INVITE_WORKFLOW_KEY;
  if (!teamInviteConfigured()) {
    console.warn(`[knock] Team invite email skipped (KNOCK_API_KEY or KNOCK_TEAM_INVITE_WORKFLOW_KEY not set) for ${inviteeEmail}`);
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
        recipients: [{ id: inviteeEmail, email: inviteeEmail }],
        data: { inviter_name: ownerUser.name, invite_url: inviteUrl }
      })
    });
    if (!res.ok) {
      console.error(`[knock] Failed to trigger team invite workflow: ${res.status} ${await res.text().catch(() => '')}`);
      return null;
    }
    return res.json();
  } catch (e) {
    console.error('[knock] Failed to trigger team invite workflow:', e.message);
    return null;
  }
}

module.exports = {
  knockConfigured, identifyUser, notifyFeedback, verificationConfigured, sendVerificationEmail,
  teamInviteConfigured, sendTeamInviteEmail
};
