// server.js — dependency-free HTTP API for the schedule health app
// Run with: node src/server.js
// No `npm install` required — uses only Node's built-in http and node:sqlite modules (Node 22+).

const http = require('node:http');
const url = require('node:url');
const fs = require('node:fs');
const path = require('node:path');

// Tiny built-in .env loader — no dotenv dependency. Reads backend/.env if present.
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvFile();

const analyzeMod = require('./analyze');
const store = require('./db');
const auth = require('./auth');
const billing = require('./billing');
const knock = require('./knock');
const ai = require('./ai');
const pricing = require('./pricing');
const oauth = require('./oauth');
const blogContent = require('./blog-content');

store.deleteExpiredSessions();

// Blog posts are authored in blog-content.js (reviewed like any other code change) and seeded
// into the DB idempotently on boot — adding a post is a normal code change, not a manual DB write.
for (const post of blogContent) {
  if (!store.getBlogPostBySlug(post.slug)) {
    store.createBlogPost(post.slug, post.title, post.description, post.contentHtml);
  }
}

const PORT = process.env.PORT || 3000;

// Admin Command Center access — a hardcoded allowlist, not a mutable DB flag, so the source of
// truth for who can reach admin routes is reviewed via PR like any other code change, not
// something that could be silently changed by writing to the database. Staff log in through the
// same real /api/auth/login as any other account; this only gates what an already-authenticated
// session is additionally allowed to do.
const ADMIN_EMAILS = ['admin@ordo7.pro', 'taj.young77@gmail.com'];
function isAdmin(user) {
  return !!user && ADMIN_EMAILS.includes(user.email.toLowerCase());
}

function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS'
  });
  res.end(body);
}

function sendRedirect(res, location, cookies) {
  const headers = { Location: location };
  if (cookies && cookies.length) headers['Set-Cookie'] = cookies;
  res.writeHead(302, headers);
  res.end();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Very small multipart/form-data parser — good enough for a single file field.
// For production use, swap in a real multipart library.
function parseMultipart(buffer, contentType) {
  const boundaryMatch = contentType.match(/boundary=(.+)$/);
  if (!boundaryMatch) throw new Error('No multipart boundary found');
  const boundary = '--' + boundaryMatch[1];
  const parts = buffer.toString('binary').split(boundary).slice(1, -1);
  const fields = {};
  let file = null;

  for (const part of parts) {
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const rawHeaders = part.slice(0, headerEnd);
    const rawBody = part.slice(headerEnd + 4, part.length - 2); // strip trailing \r\n

    const nameMatch = rawHeaders.match(/name="([^"]+)"/);
    const filenameMatch = rawHeaders.match(/filename="([^"]+)"/);
    const name = nameMatch ? nameMatch[1] : null;

    if (filenameMatch) {
      file = { filename: filenameMatch[1], content: Buffer.from(rawBody, 'binary').toString('utf8') };
    } else if (name) {
      fields[name] = rawBody;
    }
  }
  return { fields, file };
}

const routes = [];
function route(method, pattern, handler) {
  routes.push({ method, pattern, handler });
}

// Unauthenticated, no secrets in the response — just booleans for whether the env vars that gate
// AI narrative/chat and Stripe billing are actually present in this deployment. Exists so
// "is production configured correctly" is a single URL to check instead of digging through the
// hosting dashboard's env var list.
route('GET', '/api/health', async (req, res) => {
  // aiConfigured just means the env var is set — an expired/revoked key still passes that check,
  // which is exactly how Ask Ordo silently broke in production before. aiWorking makes one real
  // (cached, cheap) call to Anthropic to confirm the key is actually accepted.
  const aiWorking = await ai.verifyApiKeyWorks();
  sendJSON(res, 200, { ok: true, aiConfigured: ai.aiConfigured(), aiWorking, billingConfigured: billing.stripeConfigured() });
});

function matchRoute(method, pathname) {
  for (const r of routes) {
    if (r.method !== method) continue;
    const parts = r.pattern.split('/').filter(Boolean);
    const actual = pathname.split('/').filter(Boolean);
    if (parts.length !== actual.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].startsWith(':')) params[parts[i].slice(1)] = decodeURIComponent(actual[i]);
      else if (parts[i] !== actual[i]) { ok = false; break; }
    }
    if (ok) return { handler: r.handler, params };
  }
  return null;
}

// --- Auth routes (no session required) ---

function publicUser(user) {
  // A Team member's own plan_tier/credit_balance are meaningless while riding on an owner's
  // subscription — effectiveTier/creditBalance reflect what actually governs this user's access
  // (see getEffectiveTierUser in db.js), while planTier stays their own real billing tier for
  // account-settings-type display ("you're on Free, but part of Acme Corp's Teams account").
  const billingUser = store.getEffectiveTierUser(user);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    subscriptionStatus: user.subscription_status,
    planTier: user.plan_tier,
    effectiveTier: billingUser.plan_tier,
    isTeamMember: !!user.team_owner_id,
    isTeamOwner: user.plan_tier === 'teams' && !user.team_owner_id,
    teamOwnerName: user.team_owner_id ? billingUser.name : null,
    teamOwnerEmail: user.team_owner_id ? billingUser.email : null,
    creditBalance: billingUser.credit_balance,
    emailVerified: !!user.email_verified,
    referralCode: user.referral_code,
    onboarded: !!user.onboarded_at,
    isAdmin: isAdmin(user)
  };
}

function verificationUrl(req, token) {
  const origin = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
  return `${origin}/?verify=${token}`;
}

function passwordResetUrl(req, token) {
  const origin = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
  return `${origin}/?resetPassword=${token}`;
}

route('POST', '/api/auth/signup', async (req, res) => {
  const body = await readBody(req);
  let payload;
  try { payload = JSON.parse(body.toString('utf8')); } catch (e) { return sendJSON(res, 400, { error: 'Invalid JSON body' }); }
  const name = String(payload.name || '').trim();
  const email = String(payload.email || '').trim().toLowerCase();
  const phone = String(payload.phone || '').trim();
  const password = String(payload.password || '');
  if (!name) return sendJSON(res, 400, { error: 'Enter your name' });
  if (!auth.EMAIL_RE.test(email)) return sendJSON(res, 400, { error: 'Enter a valid email address' });
  if (!phone) return sendJSON(res, 400, { error: 'Enter your phone number' });
  if (password.length < 8) return sendJSON(res, 400, { error: 'Password must be at least 8 characters' });
  if (store.getUserByEmail(email)) return sendJSON(res, 409, { error: 'An account with that email already exists' });

  // Referral is entirely optional and never blocks signup — an invalid/unknown code is just
  // silently ignored rather than surfaced as an error (a stale or tampered code shouldn't stop
  // someone from creating an account).
  const referralCode = String(payload.ref || '').trim();
  const referrer = referralCode ? store.getUserByReferralCode(referralCode) : null;

  // Verification is only required once a workflow is actually configured (see knock.js) — local
  // dev and any environment without that set up stays frictionless, same pattern as billing.
  const requireVerification = knock.verificationConfigured();
  const { salt, hash } = auth.hashPassword(password);
  let user = store.createUser(name, email, phone, hash, salt, pricing.FREE_SIGNUP_CREDITS, !requireVerification, referrer ? referrer.id : null);
  if (referrer) {
    user = store.addCredits(user.id, pricing.REFERRAL_BONUS_CREDITS);
    store.addCredits(referrer.id, pricing.REFERRAL_BONUS_CREDITS);
  }
  const { token } = auth.createSession(user.id);
  res.setHeader('Set-Cookie', auth.sessionCookie(token, req, auth.SESSION_TTL_MS / 1000));
  knock.identifyUser(user).catch(() => {}); // never let a marketing-sync failure block signup
  if (requireVerification) {
    const verifyToken = auth.createVerificationToken(user.id);
    knock.sendVerificationEmail(user, verificationUrl(req, verifyToken)).catch(() => {});
  }
  sendJSON(res, 200, { user: publicUser(user) });
});

route('GET', '/api/referral', async (req, res, params, user) => {
  const stats = store.getReferralStats(user.id);
  sendJSON(res, 200, {
    code: user.referral_code,
    referredCount: stats.referredCount,
    creditsEarned: stats.referredCount * pricing.REFERRAL_BONUS_CREDITS,
    bonusPerReferral: pricing.REFERRAL_BONUS_CREDITS
  });
});

// --- Teams (multi-seat) routes ---
//
// Only the actual Teams subscriber (plan_tier === 'teams' AND not themselves riding on someone
// else's team) can invite/remove — a member's own plan_tier is irrelevant to their access (see
// getEffectiveTierUser) but must stay irrelevant to *managing* the team too, or a member could
// invite people onto an owner's team the owner never approved.
function isTeamOwner(user) {
  return user.plan_tier === 'teams' && !user.team_owner_id;
}

route('GET', '/api/team', async (req, res, params, user) => {
  if (user.team_owner_id) {
    const owner = store.getUserById(user.team_owner_id);
    return sendJSON(res, 200, { isOwner: false, ownerName: owner ? owner.name : null, ownerEmail: owner ? owner.email : null });
  }
  if (!isTeamOwner(user)) return sendJSON(res, 403, { error: 'Teams multi-seat is only available on the Teams plan' });
  const members = store.getTeamMembers(user.id).map(m => ({ id: m.id, name: m.name, email: m.email }));
  // token included so the owner's UI can cancel a specific invite — safe to expose to the owner
  // since accept still requires logging in as the invited email; the owner already has equivalent
  // control via cancel/resend.
  const pendingInvites = store.listPendingInvitesForOwner(user.id).map(i => ({ email: i.email, token: i.token, createdAt: i.created_at, expiresAt: i.expires_at }));
  sendJSON(res, 200, { isOwner: true, members, pendingInvites, seatsUsed: members.length + pendingInvites.length, maxSeats: pricing.MAX_TEAM_MEMBERS });
});

route('POST', '/api/team/invite', async (req, res, params, user) => {
  if (!isTeamOwner(user)) return sendJSON(res, 403, { error: 'Only the Teams plan owner can invite members' });
  const body = await readBody(req);
  let payload;
  try { payload = JSON.parse(body.toString('utf8')); } catch (e) { return sendJSON(res, 400, { error: 'Invalid JSON body' }); }
  const email = String(payload.email || '').trim().toLowerCase();
  if (!auth.EMAIL_RE.test(email)) return sendJSON(res, 400, { error: 'Enter a valid email address' });
  if (email === user.email.toLowerCase()) return sendJSON(res, 400, { error: "You can't invite yourself" });

  const existingUser = store.getUserByEmail(email);
  if (existingUser && existingUser.team_owner_id === user.id) return sendJSON(res, 400, { error: 'Already on your team' });
  if (existingUser && existingUser.team_owner_id) return sendJSON(res, 400, { error: 'This person is already on another team' });

  const members = store.getTeamMembers(user.id);
  const pendingInvites = store.listPendingInvitesForOwner(user.id);
  if (members.length + pendingInvites.length >= pricing.MAX_TEAM_MEMBERS) {
    return sendJSON(res, 400, { error: `Your team is full (max ${pricing.MAX_TEAM_MEMBERS} seats)` });
  }
  // Re-inviting the same email replaces the old invite (fresh token/expiry) rather than erroring.
  for (const invite of pendingInvites) if (invite.email === email) store.deleteTeamInvite(invite.token);

  const token = auth.createTeamInviteToken(user.id, email);
  const origin = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
  const inviteUrl = `${origin}/?team_invite=${token}`;
  knock.sendTeamInviteEmail(user, email, inviteUrl).catch(() => {});
  sendJSON(res, 200, { ok: true, email, inviteUrl });
});

route('POST', '/api/team/invite/:token/cancel', async (req, res, params, user) => {
  const invite = store.getTeamInviteByToken(params.token);
  if (!invite || invite.owner_id !== user.id) return sendJSON(res, 404, { error: 'Invite not found' });
  store.deleteTeamInvite(params.token);
  sendJSON(res, 200, { ok: true });
});

route('GET', '/api/team/invite/:token', async (req, res, params) => {
  const invite = store.getTeamInviteByToken(params.token);
  if (!invite || invite.expires_at < new Date().toISOString()) return sendJSON(res, 404, { error: 'This invite is invalid or has expired' });
  const owner = store.getUserById(invite.owner_id);
  sendJSON(res, 200, { email: invite.email, ownerName: owner ? owner.name : 'A Level 7 team' });
});

route('POST', '/api/team/invite/:token/accept', async (req, res, params, user) => {
  const invite = store.getTeamInviteByToken(params.token);
  if (!invite || invite.expires_at < new Date().toISOString()) return sendJSON(res, 404, { error: 'This invite is invalid or has expired' });
  if (invite.email !== user.email.toLowerCase()) {
    return sendJSON(res, 403, { error: `This invite was sent to ${invite.email} — log in with that account to accept it` });
  }
  if (user.team_owner_id && user.team_owner_id !== invite.owner_id) {
    return sendJSON(res, 400, { error: "You're already on a different team — leave it first" });
  }
  if (!user.team_owner_id) {
    const members = store.getTeamMembers(invite.owner_id);
    if (members.length >= pricing.MAX_TEAM_MEMBERS) {
      store.deleteTeamInvite(params.token);
      return sendJSON(res, 400, { error: 'This team is full' });
    }
    store.addTeamMember(invite.owner_id, user.id);
  }
  store.deleteTeamInvite(params.token);
  sendJSON(res, 200, { user: publicUser(store.getUserById(user.id)) });
});

route('POST', '/api/team/member/:id/remove', async (req, res, params, user) => {
  if (!isTeamOwner(user)) return sendJSON(res, 403, { error: 'Only the Teams plan owner can remove members' });
  const memberId = Number(params.id);
  const member = store.getUserById(memberId);
  if (!member || member.team_owner_id !== user.id) return sendJSON(res, 404, { error: 'Team member not found' });
  store.removeTeamMember(memberId);
  sendJSON(res, 200, { ok: true });
});

route('POST', '/api/team/leave', async (req, res, params, user) => {
  if (!user.team_owner_id) return sendJSON(res, 400, { error: "You're not on a team" });
  store.removeTeamMember(user.id);
  sendJSON(res, 200, { user: publicUser(store.getUserById(user.id)) });
});

route('GET', '/api/auth/oauth-providers', async (req, res) => {
  const providers = {};
  for (const key of Object.keys(oauth.PROVIDERS)) providers[key] = oauth.credentialsConfigured(key);
  sendJSON(res, 200, providers);
});

route('GET', '/api/auth/:provider/start', async (req, res, params) => {
  const providerKey = params.provider;
  if (!oauth.PROVIDERS[providerKey]) return sendJSON(res, 404, { error: 'Unknown provider' });
  if (!oauth.credentialsConfigured(providerKey)) return sendJSON(res, 503, { error: `${providerKey} sign-in is not configured yet` });

  const state = oauth.generateState();
  const pkce = oauth.PROVIDERS[providerKey].usesPkce ? oauth.generatePkce() : null;
  const authUrl = oauth.buildAuthUrl(providerKey, req, state, pkce);
  const stateCookie = auth.oauthStateCookie({ state, verifier: pkce ? pkce.verifier : undefined, provider: providerKey }, req);
  sendRedirect(res, authUrl, [stateCookie]);
});

route('GET', '/api/auth/:provider/callback', async (req, res, params) => {
  const providerKey = params.provider;
  const clearState = auth.clearOAuthStateCookie(req);
  if (!oauth.PROVIDERS[providerKey]) return sendJSON(res, 404, { error: 'Unknown provider' });

  const parsed = url.parse(req.url, true);
  const { code, state, error } = parsed.query;
  if (error) return sendRedirect(res, '/?oauthError=' + encodeURIComponent(String(error)), [clearState]);
  if (!code || !state) return sendRedirect(res, '/?oauthError=missing_code', [clearState]);

  const cookies = auth.parseCookies(req);
  let savedState;
  try { savedState = JSON.parse(cookies.oauth_state || '{}'); } catch (e) { savedState = {}; }
  if (!savedState.state || savedState.state !== state || savedState.provider !== providerKey) {
    return sendRedirect(res, '/?oauthError=state_mismatch', [clearState]);
  }

  try {
    const accessToken = await oauth.exchangeCode(providerKey, code, req, savedState.verifier);
    const profile = await oauth.fetchProfile(providerKey, accessToken);

    // Already linked from a previous sign-in — log straight in.
    let user = store.getUserByOAuthAccount(providerKey, profile.id);

    if (!user && profile.email) {
      // profile.email came from the provider's own authenticated API (not typed by the user), so
      // it's safe to treat as verified and link to a matching existing account automatically.
      user = store.getUserByEmail(profile.email);
      if (user) {
        store.linkOAuthAccount(user.id, providerKey, profile.id);
      } else {
        user = store.createOAuthUser(profile.name, profile.email, pricing.FREE_SIGNUP_CREDITS, profile.emailVerified, null);
        store.linkOAuthAccount(user.id, providerKey, profile.id);
        knock.identifyUser(user).catch(() => {});
      }
    }

    if (!user) {
      // Provider didn't return an email (X, currently) — can't create an account without one.
      // Stash the profile briefly and send them to a "finish signing up" step in the frontend.
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const pendingToken = store.createPendingOAuthSignup(providerKey, profile.id, profile.name, expiresAt);
      return sendRedirect(res, `/?completeOAuth=${pendingToken}`, [clearState]);
    }

    const { token } = auth.createSession(user.id);
    const sessCookie = auth.sessionCookie(token, req, auth.SESSION_TTL_MS / 1000);
    sendRedirect(res, '/', [clearState, sessCookie]);
  } catch (e) {
    console.error(`[oauth] ${providerKey} callback failed:`, e.message);
    sendRedirect(res, '/?oauthError=login_failed', [clearState]);
  }
});

route('POST', '/api/auth/complete-oauth', async (req, res) => {
  const body = await readBody(req);
  let payload;
  try { payload = JSON.parse(body.toString('utf8')); } catch (e) { return sendJSON(res, 400, { error: 'Invalid JSON body' }); }
  const token = String(payload.token || '');
  const email = String(payload.email || '').trim().toLowerCase();
  if (!token) return sendJSON(res, 400, { error: 'Missing signup token' });
  if (!auth.EMAIL_RE.test(email)) return sendJSON(res, 400, { error: 'Enter a valid email address' });

  const pending = store.consumePendingOAuthSignup(token);
  if (!pending) return sendJSON(res, 400, { error: 'This signup link is invalid or has expired — please try signing in again' });

  // Unlike the provider-verified email in the callback route above, this email was typed by hand
  // and unverified — never auto-link it to an existing account (that would let anyone claim
  // someone else's account just by typing their email address here).
  if (store.getUserByEmail(email)) {
    return sendJSON(res, 409, { error: 'An account with that email already exists — log in with your password (or that provider) instead' });
  }

  const requireVerification = knock.verificationConfigured();
  const user = store.createOAuthUser(pending.name, email, pricing.FREE_SIGNUP_CREDITS, !requireVerification, null);
  store.linkOAuthAccount(user.id, pending.provider, pending.provider_user_id);
  knock.identifyUser(user).catch(() => {});
  if (requireVerification) {
    const verifyToken = auth.createVerificationToken(user.id);
    knock.sendVerificationEmail(user, verificationUrl(req, verifyToken)).catch(() => {});
  }

  const { token: sessionToken } = auth.createSession(user.id);
  res.setHeader('Set-Cookie', auth.sessionCookie(sessionToken, req, auth.SESSION_TTL_MS / 1000));
  sendJSON(res, 200, { user: publicUser(user) });
});

route('POST', '/api/auth/verify', async (req, res) => {
  const body = await readBody(req);
  let payload;
  try { payload = JSON.parse(body.toString('utf8')); } catch (e) { return sendJSON(res, 400, { error: 'Invalid JSON body' }); }
  const token = String(payload.token || '');
  if (!token) return sendJSON(res, 400, { error: 'Missing verification token' });

  const userId = auth.verifyEmailToken(token);
  if (!userId) return sendJSON(res, 400, { error: 'This verification link is invalid or has expired' });

  const user = store.setEmailVerified(userId);
  sendJSON(res, 200, { user: publicUser(user) });
});

route('POST', '/api/auth/resend-verification', async (req, res, params, user) => {
  // /api/auth/* is exempt from the dispatcher's blanket auth check (see below), since signup/
  // login/verify all need to work without a session — so this route checks for itself.
  if (!user) return sendJSON(res, 401, { error: 'Not authenticated' });
  if (user.email_verified) return sendJSON(res, 200, { ok: true, alreadyVerified: true });
  if (!knock.verificationConfigured()) return sendJSON(res, 503, { error: 'Email verification is not configured yet' });

  const verifyToken = auth.createVerificationToken(user.id);
  const sent = await knock.sendVerificationEmail(user, verificationUrl(req, verifyToken));
  if (!sent) return sendJSON(res, 502, { error: 'Could not send verification email right now — try again in a moment' });
  sendJSON(res, 200, { ok: true });
});

route('POST', '/api/auth/forgot-password', async (req, res) => {
  if (!knock.passwordResetConfigured()) return sendJSON(res, 503, { error: 'Password reset is not configured yet' });
  const body = await readBody(req);
  let payload;
  try { payload = JSON.parse(body.toString('utf8')); } catch (e) { return sendJSON(res, 400, { error: 'Invalid JSON body' }); }
  const email = String(payload.email || '').trim().toLowerCase();

  // Always respond identically whether or not the email matches an account — confirming/denying
  // an email's existence here would let this endpoint be used to enumerate registered users.
  const user = auth.EMAIL_RE.test(email) ? store.getUserByEmail(email) : null;
  if (user) {
    const resetToken = auth.createPasswordResetToken(user.id);
    knock.sendPasswordResetEmail(user, passwordResetUrl(req, resetToken)).catch(() => {});
  }
  sendJSON(res, 200, { ok: true });
});

route('POST', '/api/auth/reset-password', async (req, res) => {
  const body = await readBody(req);
  let payload;
  try { payload = JSON.parse(body.toString('utf8')); } catch (e) { return sendJSON(res, 400, { error: 'Invalid JSON body' }); }
  const token = String(payload.token || '');
  const password = String(payload.password || '');
  if (!token) return sendJSON(res, 400, { error: 'Missing reset token' });
  if (password.length < 8) return sendJSON(res, 400, { error: 'Password must be at least 8 characters' });

  const userId = auth.verifyPasswordResetToken(token);
  if (!userId) return sendJSON(res, 400, { error: 'This reset link is invalid or has expired' });

  const { salt, hash } = auth.hashPassword(password);
  store.setUserPassword(userId, hash, salt);
  // A password reset means any existing session (including one an attacker holds) should be
  // invalidated, not just left alive — so this signs the account out everywhere, this device
  // included, and issues one fresh session below rather than reusing whatever came in.
  store.deleteSessionsForUser(userId);

  const { token: sessionToken } = auth.createSession(userId);
  res.setHeader('Set-Cookie', auth.sessionCookie(sessionToken, req, auth.SESSION_TTL_MS / 1000));
  sendJSON(res, 200, { user: publicUser(store.getUserById(userId)) });
});

route('POST', '/api/auth/login', async (req, res) => {
  const body = await readBody(req);
  let payload;
  try { payload = JSON.parse(body.toString('utf8')); } catch (e) { return sendJSON(res, 400, { error: 'Invalid JSON body' }); }
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '');
  const user = store.getUserByEmail(email);
  if (!user || !auth.verifyPassword(password, user.password_salt, user.password_hash)) {
    return sendJSON(res, 401, { error: 'Incorrect email or password' });
  }
  const { token } = auth.createSession(user.id);
  res.setHeader('Set-Cookie', auth.sessionCookie(token, req, auth.SESSION_TTL_MS / 1000));
  sendJSON(res, 200, { user: publicUser(user) });
});

route('POST', '/api/auth/logout', async (req, res) => {
  const cookies = auth.parseCookies(req);
  if (cookies.session) store.deleteSession(cookies.session);
  res.setHeader('Set-Cookie', auth.clearCookie(req));
  sendJSON(res, 200, { ok: true });
});

route('GET', '/api/auth/me', async (req, res) => {
  const cookies = auth.parseCookies(req);
  const user = auth.getUserForToken(cookies.session);
  sendJSON(res, 200, { user: user ? publicUser(user) : null });
});

// Marks the welcome hero + tour as seen for this account, server-side — called once the tour
// ends (finished or skipped). Idempotent: markOnboarded() only writes if still NULL, so a late
// duplicate call from a slow client can't clobber the original timestamp.
// /api/auth/* is exempt from the dispatcher's blanket auth check (see below), since signup/
// login/verify all need to work without a session — so this route checks for itself.
route('POST', '/api/auth/onboarded', async (req, res, params, user) => {
  if (!user) return sendJSON(res, 401, { error: 'Not authenticated' });
  const updated = store.markOnboarded(user.id);
  sendJSON(res, 200, { user: publicUser(updated) });
});

// --- Billing routes (session required, active subscription NOT required — you need one to get one) ---

route('POST', '/api/billing/checkout', async (req, res, params, user) => {
  if (!billing.stripeConfigured()) return sendJSON(res, 503, { error: 'Billing is not configured yet' });
  const body = await readBody(req);
  let payload;
  try { payload = JSON.parse(body.toString('utf8')); } catch (e) { return sendJSON(res, 400, { error: 'Invalid JSON body' }); }

  const tierDef = pricing.TIERS[payload.tier];
  if (!tierDef) return sendJSON(res, 400, { error: 'Unknown plan' });
  const priceId = process.env[tierDef.stripePriceEnvVar];
  if (!priceId) return sendJSON(res, 503, { error: `The ${tierDef.name} plan is not configured yet` });

  const origin = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
  try {
    const session = await billing.createCheckoutSession({
      userId: user.id,
      email: user.email,
      customerId: user.stripe_customer_id,
      priceId,
      successUrl: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/?checkout=cancelled`
    });
    sendJSON(res, 200, { url: session.url });
  } catch (e) {
    sendJSON(res, 502, { error: 'Could not start checkout: ' + e.message });
  }
});

route('GET', '/api/billing/verify', async (req, res, params, user) => {
  if (!billing.stripeConfigured()) return sendJSON(res, 503, { error: 'Billing is not configured yet' });
  const parsed = url.parse(req.url, true);
  const sessionId = parsed.query.session_id;
  if (!sessionId) return sendJSON(res, 400, { error: 'Missing session_id' });

  let session;
  try {
    session = await billing.retrieveCheckoutSession(sessionId);
  } catch (e) {
    return sendJSON(res, 502, { error: 'Could not verify checkout: ' + e.message });
  }
  if (session.client_reference_id !== String(user.id)) {
    return sendJSON(res, 403, { error: 'This checkout session does not belong to you' });
  }
  if (session.payment_status !== 'paid' && session.status !== 'complete') {
    return sendJSON(res, 200, { subscriptionStatus: user.subscription_status, pending: true });
  }

  // Determine the tier from what was actually purchased (the line item's price ID), not from
  // anything the client claims — the success URL carries no tier parameter for that reason.
  const purchasedPriceId = session.line_items?.data?.[0]?.price?.id || session.line_items?.data?.[0]?.price;
  const tierKey = pricing.tierForPriceId(purchasedPriceId);

  let updated = user;
  if (session.customer) updated = store.setStripeCustomerId(user.id, session.customer);
  const subscriptionStatus = session.subscription?.status || 'active';
  const subscriptionId = session.subscription?.id;
  updated = store.setSubscriptionStatus(user.id, subscriptionStatus, subscriptionId);
  if (tierKey) updated = store.setUserTier(user.id, tierKey, pricing.TIERS[tierKey].monthlyCredits);

  sendJSON(res, 200, { user: publicUser(updated) });
});

// One-time AI credit top-ups — separate from the subscription checkout above (mode: payment,
// not subscription), stacks on top of whatever plan the user is already on.
route('POST', '/api/billing/topup/checkout', async (req, res, params, user) => {
  if (!billing.stripeConfigured()) return sendJSON(res, 503, { error: 'Billing is not configured yet' });
  const body = await readBody(req);
  let payload;
  try { payload = JSON.parse(body.toString('utf8')); } catch (e) { return sendJSON(res, 400, { error: 'Invalid JSON body' }); }

  const amountUsd = Number(payload.amountUsd);
  if (!pricing.isValidTopupAmount(amountUsd)) {
    return sendJSON(res, 400, { error: `Amount must be at least $${pricing.TOPUP_MIN_USD}, in $${pricing.TOPUP_INCREMENT_USD} increments` });
  }

  const origin = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
  try {
    const session = await billing.createTopupCheckoutSession({
      userId: user.id,
      email: user.email,
      customerId: user.stripe_customer_id,
      amountUsd,
      successUrl: `${origin}/?checkout=topup-success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/?checkout=topup-cancelled`
    });
    sendJSON(res, 200, { url: session.url });
  } catch (e) {
    sendJSON(res, 502, { error: 'Could not start checkout: ' + e.message });
  }
});

route('GET', '/api/billing/topup/verify', async (req, res, params, user) => {
  if (!billing.stripeConfigured()) return sendJSON(res, 503, { error: 'Billing is not configured yet' });
  const parsed = url.parse(req.url, true);
  const sessionId = parsed.query.session_id;
  if (!sessionId) return sendJSON(res, 400, { error: 'Missing session_id' });

  let session;
  try {
    session = await billing.retrieveCheckoutSession(sessionId);
  } catch (e) {
    return sendJSON(res, 502, { error: 'Could not verify checkout: ' + e.message });
  }
  if (session.client_reference_id !== String(user.id)) {
    return sendJSON(res, 403, { error: 'This checkout session does not belong to you' });
  }
  if (session.payment_status !== 'paid') {
    return sendJSON(res, 200, { creditBalance: user.credit_balance, pending: true });
  }

  let updated = user;
  if (session.customer && !user.stripe_customer_id) updated = store.setStripeCustomerId(user.id, session.customer);

  // Idempotent against a refreshed success page: only grant credits once per Stripe session.
  // Credits are derived from Stripe's own amount_total, not anything the client sent at
  // checkout-creation time, so a tampered client request can't buy more than it paid for.
  const alreadyRedeemed = store.getCreditPurchaseBySessionId(sessionId);
  if (!alreadyRedeemed) {
    const amountUsd = session.amount_total / 100;
    const credits = pricing.creditsForTopupAmount(amountUsd);
    store.recordCreditPurchase(user.id, sessionId, amountUsd, credits);
    updated = store.addCredits(user.id, credits);
  }

  sendJSON(res, 200, { user: publicUser(updated) });
});

// Stripe webhook — not authenticated via session cookie; verified via Stripe-Signature instead.
// Requires STRIPE_WEBHOOK_SECRET (from Stripe Dashboard -> Developers -> Webhooks) and a publicly
// reachable URL registered there, so it's inert (204, no-op) until both are set up post-deploy.
route('POST', '/api/billing/webhook', async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const raw = await readBody(req);
  if (!secret) { res.writeHead(204); return res.end(); }

  const signature = req.headers['stripe-signature'];
  if (!billing.verifyWebhookSignature(raw.toString('utf8'), signature, secret)) {
    return sendJSON(res, 400, { error: 'Invalid signature' });
  }

  let event;
  try { event = JSON.parse(raw.toString('utf8')); } catch (e) { return sendJSON(res, 400, { error: 'Invalid JSON' }); }

  const obj = event.data?.object;
  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const owner = store.getUserByStripeSubscriptionId(obj.id) || store.getUserByStripeCustomerId(obj.customer);
    if (owner) store.setSubscriptionStatus(owner.id, event.type === 'customer.subscription.deleted' ? 'canceled' : obj.status, obj.id);
  }
  // Refill credits to the plan's monthly allotment on each successful renewal invoice.
  if (event.type === 'invoice.payment_succeeded') {
    const owner = store.getUserByStripeCustomerId(obj.customer);
    const tierDef = owner && pricing.TIERS[owner.plan_tier];
    if (owner && tierDef) store.setUserTier(owner.id, owner.plan_tier, tierDef.monthlyCredits);
  }
  sendJSON(res, 200, { received: true });
});

// --- Project routes (session required — enforced in the server() dispatcher below) ---

route('GET', '/api/projects', async (req, res, params, user) => {
  sendJSON(res, 200, store.listProjects(user.id));
});

route('GET', '/api/portfolio', async (req, res, params, user) => {
  const rows = store.getPortfolio(user.id).map(({ project, latest }) => ({
    id: project.id,
    name: project.name,
    score: latest.score,
    healthyPct: latest.healthy_pct,
    riskPct: latest.risk_pct,
    critPct: latest.crit_pct,
    lastAnalyzed: latest.created_at
  }));
  sendJSON(res, 200, rows);
});

route('GET', '/api/projects/:name/history', async (req, res, params, user) => {
  const history = store.getHistory(user.id, params.name).map(s => ({
    id: s.id, date: s.created_at, score: s.score, critCount: s.crit_count, riskCount: s.risk_count, totalActivities: s.total_activities
  }));
  sendJSON(res, 200, history);
});

route('GET', '/api/projects/:name/latest', async (req, res, params, user) => {
  const snapshot = store.getLatestSnapshot(user.id, params.name);
  if (!snapshot) return sendJSON(res, 404, { error: 'No analysis yet for this project' });
  const issues = store.getIssuesForSnapshot(snapshot.id);
  let activities = [];
  try { activities = JSON.parse(snapshot.activities_json || '[]'); } catch (e) { activities = []; }
  const project = store.getProjectByName(user.id, params.name);
  const earnedSchedule = analyzeMod.computeEarnedSchedule(activities);
  sendJSON(res, 200, {
    snapshot, issues, activities,
    earnedSchedule, budgetAtCompletion: project?.budget_at_completion ?? null, actualCostToDate: snapshot.actual_cost_to_date ?? null
  });
});

// Optional cost layer on top of the always-available Earned Schedule metrics — a manually-entered
// Budget at Completion, honest because it's the user's own number, never derived or guessed.
// Dedicated route (unlike the earned-schedule display data above, which rides on /latest and
// /analyze), so this one gets real backend enforcement of the earned-value-metrics flag.
route('POST', '/api/projects/:name/budget', async (req, res, params, user) => {
  if (!store.isFeatureEnabled('earned-value-metrics')) return sendJSON(res, 503, { error: 'Earned value metrics are temporarily unavailable' });
  const project = store.getProjectByName(user.id, params.name);
  if (!project) return sendJSON(res, 404, { error: 'No such project' });
  const body = await readBody(req);
  let payload;
  try { payload = JSON.parse(body.toString('utf8')); } catch (e) { return sendJSON(res, 400, { error: 'Invalid JSON body' }); }
  const budget = payload.budgetAtCompletion === null ? null : Number(payload.budgetAtCompletion);
  if (budget !== null && (!Number.isFinite(budget) || budget < 0)) return sendJSON(res, 400, { error: 'Budget must be a non-negative number' });
  const updated = store.setProjectBudget(project.id, budget);
  sendJSON(res, 200, { project: updated });
});

route('POST', '/api/snapshots/:id/actual-cost', async (req, res, params, user) => {
  if (!store.isFeatureEnabled('earned-value-metrics')) return sendJSON(res, 503, { error: 'Earned value metrics are temporarily unavailable' });
  const snapshotId = Number(params.id);
  const ownerId = store.getSnapshotOwnerUserId(snapshotId);
  if (ownerId === null) return sendJSON(res, 404, { error: 'No such snapshot' });
  if (ownerId !== user.id) return sendJSON(res, 403, { error: 'Not your project' });
  const body = await readBody(req);
  let payload;
  try { payload = JSON.parse(body.toString('utf8')); } catch (e) { return sendJSON(res, 400, { error: 'Invalid JSON body' }); }
  const actualCost = payload.actualCostToDate === null ? null : Number(payload.actualCostToDate);
  if (actualCost !== null && (!Number.isFinite(actualCost) || actualCost < 0)) return sendJSON(res, 400, { error: 'Actual cost must be a non-negative number' });
  const updated = store.setSnapshotActualCost(snapshotId, actualCost);
  sendJSON(res, 200, { snapshot: updated });
});

// Generates (or reuses) a public share link for one snapshot — a real, unauthenticated read-only
// view, not just a URL copied to the clipboard with nothing behind it. Scoped to that one
// snapshot's summary only, not the full interactive app.
route('POST', '/api/snapshots/:id/share', async (req, res, params, user) => {
  const snapshotId = Number(params.id);
  const ownerId = store.getSnapshotOwnerUserId(snapshotId);
  if (ownerId === null) return sendJSON(res, 404, { error: 'No such snapshot' });
  if (ownerId !== user.id) return sendJSON(res, 403, { error: 'Not your project' });
  const token = store.getOrCreateShareToken(snapshotId);
  const origin = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
  sendJSON(res, 200, { url: `${origin}/shared/${token}` });
});

// Public counterpart of the above — no session required, no PATCH/mutation surface, just a
// read-only summary of one snapshot for whoever the link was shared with.
route('GET', '/api/public/snapshot/:token', async (req, res, params) => {
  const row = store.getPublicSnapshotByShareToken(params.token);
  if (!row) return sendJSON(res, 404, { error: 'This shared link is invalid or has expired' });
  const criticalIssues = store.getIssuesForSnapshot(row.id).filter(i => i.severity === 'crit').slice(0, 10);
  sendJSON(res, 200, {
    projectName: row.project_name,
    generatedAt: row.created_at,
    score: row.score,
    healthyPct: row.healthy_pct,
    riskPct: row.risk_pct,
    critPct: row.crit_pct,
    totalActivities: row.total_activities,
    critCount: row.crit_count,
    riskCount: row.risk_count,
    milestoneHealth: row.milestone_health,
    criticalIssues: criticalIssues.map(i => ({ name: i.name, sub: i.sub }))
  });
});

function describeActivityEvent(event) {
  switch (event.type) {
    case 'snapshot':
      return `Update ingested — ${event.totalActivities} activities parsed`;
    case 'issue_resolved':
      return `Resolved — ${event.name}`;
    case 'issue_acknowledged':
      return `Acknowledged — ${event.name}`;
    case 'new_issue':
      return `New critical issue — ${event.name}`;
    default:
      return event.name || 'Activity';
  }
}

route('GET', '/api/projects/:name/activity', async (req, res, params, user) => {
  const events = store.getActivityFeed(user.id, params.name, 8);
  sendJSON(res, 200, events.map(e => ({ message: describeActivityEvent(e), timestamp: e.timestamp })));
});

route('PATCH', '/api/issues/:id', async (req, res, params, user) => {
  const body = await readBody(req);
  let payload;
  try { payload = JSON.parse(body.toString('utf8')); } catch (e) { return sendJSON(res, 400, { error: 'Invalid JSON body' }); }
  if (!['open', 'acknowledged', 'resolved'].includes(payload.status)) {
    return sendJSON(res, 400, { error: 'status must be open, acknowledged, or resolved' });
  }
  const issueId = Number(params.id);
  const ownerId = store.getIssueOwnerUserId(issueId);
  if (ownerId === null) return sendJSON(res, 404, { error: 'No such issue' });
  if (ownerId !== user.id) return sendJSON(res, 403, { error: 'Not your project' });
  const updated = store.updateIssueStatus(issueId, payload.status);
  sendJSON(res, 200, updated);
});

route('POST', '/api/snapshots/:id/narrative', async (req, res, params, user) => {
  if (!ai.aiConfigured()) return sendJSON(res, 503, { error: 'AI narrative is not configured yet' });
  const snapshotId = Number(params.id);
  const ownerId = store.getSnapshotOwnerUserId(snapshotId);
  if (ownerId === null) return sendJSON(res, 404, { error: 'No such snapshot' });
  if (ownerId !== user.id) return sendJSON(res, 403, { error: 'Not your project' });

  const snapshot = store.getSnapshotById(snapshotId);
  // Team members draw from (and are gated by) their Team owner's pooled balance, not their own —
  // "Pooled AI credits" is a Teams feature, so credit checks/deductions always resolve through
  // the same owner lookup as tier gating rather than a second, easy-to-forget code path.
  const billingUser = store.getEffectiveTierUser(user);
  if (snapshot.narrative) return sendJSON(res, 200, { narrative: snapshot.narrative, cached: true, creditBalance: billingUser.credit_balance });

  // 429, not 402 — this is a quota/rate concept ("out of credits this period"), distinct from
  // the account-level "no active subscription" case, which no longer blocks the app at all now
  // that every account has a free tier.
  if (billingUser.credit_balance <= 0) {
    return sendJSON(res, 429, { error: 'Out of AI credits — upgrade to Pro or wait for your next credit refill', creditBalance: billingUser.credit_balance });
  }

  const issues = store.getIssuesForSnapshot(snapshotId);
  const result = await ai.generateNarrative(snapshot, issues);
  if (!result) return sendJSON(res, 502, { error: 'Could not generate narrative right now — try again in a moment' });

  const cost = pricing.costUsd(result.inputTokens, result.outputTokens);
  const credits = pricing.creditsForUsage(result.inputTokens, result.outputTokens);
  store.setSnapshotNarrative(snapshotId, result.text);
  store.logAiUsage(user.id, snapshotId, result.inputTokens, result.outputTokens, cost, credits);
  const updatedBillingUser = store.deductCredits(billingUser.id, credits);

  sendJSON(res, 200, { narrative: result.text, cached: false, creditsUsed: credits, creditBalance: updatedBillingUser.credit_balance });
});

// Compares two snapshots of the same project, purely as a diff over already-computed, already-
// trusted per-snapshot data (score/issues/activities) — no new schedule math, just set/value
// comparison between two points in time. Activities are matched across snapshots by `code` (the
// source file's own task code/id), which is only a stable identity within the same project's
// re-uploads of what's meant to be the same schedule — comparing snapshots from two unrelated
// projects would just show everything as added/removed, which is accurate, if not useful.
route('GET', '/api/snapshots/compare', async (req, res, params, user) => {
  const parsed = url.parse(req.url, true);
  const fromId = Number(parsed.query.from);
  const toId = Number(parsed.query.to);
  if (!fromId || !toId) return sendJSON(res, 400, { error: 'Provide both from and to snapshot ids' });

  for (const id of [fromId, toId]) {
    const ownerId = store.getSnapshotOwnerUserId(id);
    if (ownerId === null) return sendJSON(res, 404, { error: 'No such snapshot' });
    if (ownerId !== user.id) return sendJSON(res, 403, { error: 'Not your project' });
  }

  const fromSnap = store.getSnapshotById(fromId);
  const toSnap = store.getSnapshotById(toId);
  const summarize = (s) => ({
    id: s.id, createdAt: s.created_at, score: s.score,
    critCount: s.crit_count, riskCount: s.risk_count, totalActivities: s.total_activities
  });

  let fromActivities = [], toActivities = [];
  try { fromActivities = JSON.parse(fromSnap.activities_json || '[]'); } catch (e) {}
  try { toActivities = JSON.parse(toSnap.activities_json || '[]'); } catch (e) {}
  const fromByCode = new Map(fromActivities.map(a => [a.code, a]));
  const toByCode = new Map(toActivities.map(a => [a.code, a]));

  const added = toActivities.filter(a => !fromByCode.has(a.code)).map(a => ({ code: a.code, name: a.name }));
  const removed = fromActivities.filter(a => !toByCode.has(a.code)).map(a => ({ code: a.code, name: a.name }));
  const becameCritical = [], resolvedCritical = [], floatChanges = [];
  for (const [code, toA] of toByCode) {
    const fromA = fromByCode.get(code);
    if (!fromA) continue;
    if (!fromA.critical && toA.critical) becameCritical.push({ code, name: toA.name });
    if (fromA.critical && !toA.critical) resolvedCritical.push({ code, name: toA.name });
    if (fromA.totalFloatDays != null && toA.totalFloatDays != null) {
      const delta = Math.round((toA.totalFloatDays - fromA.totalFloatDays) * 10) / 10;
      // 1 day is the smallest change worth surfacing — anything smaller is noise from rounding,
      // not a real shift a reviewer would care about.
      if (Math.abs(delta) >= 1) floatChanges.push({ code, name: toA.name, fromFloat: fromA.totalFloatDays, toFloat: toA.totalFloatDays, delta });
    }
  }
  floatChanges.sort((a, b) => a.delta - b.delta);

  const fromIssues = store.getIssuesForSnapshot(fromId);
  const toIssues = store.getIssuesForSnapshot(toId);
  // name+sub together are the deterministic, generated description of one specific condition on
  // one specific activity — identical text across two analyses means the same issue, since both
  // are derived from the same analyze.js logic run over each snapshot's own data.
  const issueKey = (i) => i.name + '||' + i.sub;
  const fromIssueKeys = new Set(fromIssues.map(issueKey));
  const toIssueKeys = new Set(toIssues.map(issueKey));
  const newIssues = toIssues.filter(i => !fromIssueKeys.has(issueKey(i))).map(i => ({ name: i.name, sub: i.sub, severity: i.severity }));
  const resolvedIssues = fromIssues.filter(i => !toIssueKeys.has(issueKey(i))).map(i => ({ name: i.name, sub: i.sub, severity: i.severity }));

  sendJSON(res, 200, {
    from: summarize(fromSnap), to: summarize(toSnap),
    scoreDelta: toSnap.score - fromSnap.score,
    critCountDelta: toSnap.crit_count - fromSnap.crit_count,
    riskCountDelta: toSnap.risk_count - fromSnap.risk_count,
    activityChanges: { added, removed, becameCritical, resolvedCritical, floatChanges },
    issueChanges: { newIssues, resolvedIssues }
  });
});

// How many prior turns get resent as conversation context on each new chat message — caps
// runaway token/cost growth on long conversations. Older messages still exist in the database
// and are returned by GET, just not replayed to Claude past this point.
const CHAT_HISTORY_LIMIT = 20;

// Separates the streamed reply text from the trailing bookkeeping JSON (credit balance) that's
// only known once the full response and its token usage are in. Plain text, not a real framing
// protocol (SSE, chunked JSON lines) — this endpoint streams to a single client, not a
// multiplexed event bus, so this simpler scheme is enough. Must match the identical constant in
// public/index.html exactly.
const CHAT_STREAM_META_MARKER = ' CHATMETA ';

route('GET', '/api/snapshots/:id/chat', async (req, res, params, user) => {
  const snapshotId = Number(params.id);
  const ownerId = store.getSnapshotOwnerUserId(snapshotId);
  if (ownerId === null) return sendJSON(res, 404, { error: 'No such snapshot' });
  if (ownerId !== user.id) return sendJSON(res, 403, { error: 'Not your project' });

  sendJSON(res, 200, { messages: store.getChatMessages(snapshotId) });
});

route('POST', '/api/snapshots/:id/chat', async (req, res, params, user) => {
  if (!ai.aiConfigured()) return sendJSON(res, 503, { error: 'AI chat is not configured yet' });
  if (!store.isFeatureEnabled('ask-ordo-ai')) return sendJSON(res, 503, { error: 'Ask Ordo is temporarily unavailable' });
  const snapshotId = Number(params.id);
  const ownerId = store.getSnapshotOwnerUserId(snapshotId);
  if (ownerId === null) return sendJSON(res, 404, { error: 'No such snapshot' });
  if (ownerId !== user.id) return sendJSON(res, 403, { error: 'Not your project' });

  const body = await readBody(req);
  let payload;
  try { payload = JSON.parse(body.toString('utf8')); } catch (e) { return sendJSON(res, 400, { error: 'Invalid JSON body' }); }
  const message = String(payload.message || '').trim();
  if (!message) return sendJSON(res, 400, { error: 'Message cannot be empty' });
  if (message.length > 2000) return sendJSON(res, 400, { error: 'Keep questions under 2000 characters' });

  const billingUser = store.getEffectiveTierUser(user);
  if (billingUser.credit_balance <= 0) {
    return sendJSON(res, 429, { error: 'Out of AI credits — upgrade to Pro or wait for your next credit refill', creditBalance: billingUser.credit_balance });
  }

  const snapshot = store.getSnapshotById(snapshotId);
  const issues = store.getIssuesForSnapshot(snapshotId);
  const history = store.getChatMessages(snapshotId).slice(-CHAT_HISTORY_LIMIT);

  // Streamed as plain text chunks, not a single JSON response — the client renders each chunk as
  // it arrives for a real typewriter effect, not a delayed reveal of an already-complete reply.
  // Headers are deferred until the first chunk actually arrives so a failure before any text was
  // generated can still return a normal JSON error status; a failure *after* streaming has begun
  // has no such option (the 200 status is already committed) — the client detects that case by a
  // stream that ends without the trailing CHAT_STREAM_META_MARKER payload.
  let headersSent = false;
  const result = await ai.generateChatReplyStream(snapshot, issues, history, message, (chunk) => {
    if (!headersSent) { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); headersSent = true; }
    res.write(chunk);
  }).catch(err => { console.error('[chat] stream error', err.message); return null; });

  if (!result) {
    if (!headersSent) return sendJSON(res, 502, { error: 'Could not get a reply right now — try again in a moment' });
    return res.end();
  }

  const cost = pricing.costUsd(result.inputTokens, result.outputTokens);
  const credits = pricing.creditsForUsage(result.inputTokens, result.outputTokens);
  store.addChatMessage(snapshotId, user.id, 'user', message);
  store.addChatMessage(snapshotId, user.id, 'assistant', result.text);
  store.logAiUsage(user.id, snapshotId, result.inputTokens, result.outputTokens, cost, credits);
  const updatedBillingUser = store.deductCredits(billingUser.id, credits);

  res.end(CHAT_STREAM_META_MARKER + JSON.stringify({ creditsUsed: credits, creditBalance: updatedBillingUser.credit_balance }));
});

route('POST', '/api/feedback', async (req, res, params, user) => {
  const body = await readBody(req);
  let payload;
  try { payload = JSON.parse(body.toString('utf8')); } catch (e) { return sendJSON(res, 400, { error: 'Invalid JSON body' }); }
  const message = String(payload.message || '').trim();
  if (message.length < 3) return sendJSON(res, 400, { error: 'Tell us a bit more — a sentence is enough' });
  if (message.length > 2000) return sendJSON(res, 400, { error: 'Keep it under 2000 characters' });

  const feedback = store.createFeedback(user.id, message);
  knock.notifyFeedback(user, message).catch(() => {}); // never let a notification failure block submission
  sendJSON(res, 200, { feedback });
});

// --- Admin Command Center (session required, ADMIN_EMAILS allowlist required) ---
//
// Every route below re-checks isAdmin(user) itself rather than trusting any client-side gate —
// the dispatcher's blanket auth check above only proves *a* session exists, not that it belongs
// to an admin.

route('GET', '/api/admin/users', async (req, res, params, user) => {
  if (!isAdmin(user)) return sendJSON(res, 403, { error: 'Admin access required' });
  const parsed = url.parse(req.url, true);
  const rows = store.searchUsersForAdmin(parsed.query.q, 200);
  sendJSON(res, 200, { users: rows.map(u => ({
    id: u.id, name: u.name, email: u.email, planTier: u.plan_tier, creditBalance: u.credit_balance,
    isTeamMember: !!u.team_owner_id, emailVerified: !!u.email_verified, createdAt: u.created_at
  })) });
});

route('POST', '/api/admin/users/:id/override', async (req, res, params, user) => {
  if (!isAdmin(user)) return sendJSON(res, 403, { error: 'Admin access required' });
  const body = await readBody(req);
  let payload;
  try { payload = JSON.parse(body.toString('utf8')); } catch (e) { return sendJSON(res, 400, { error: 'Invalid JSON body' }); }
  const targetId = Number(params.id);
  const tier = String(payload.tier || '');
  const credits = Number(payload.credits);
  if (!pricing.TIERS[tier] && tier !== 'free') return sendJSON(res, 400, { error: 'Unknown plan tier' });
  if (!Number.isFinite(credits) || credits < 0) return sendJSON(res, 400, { error: 'Credits must be a non-negative number' });
  const updated = store.setUserTier(targetId, tier, credits);
  if (!updated) return sendJSON(res, 404, { error: 'No such user' });
  sendJSON(res, 200, { user: publicUser(updated) });
});

route('GET', '/api/admin/feedback', async (req, res, params, user) => {
  if (!isAdmin(user)) return sendJSON(res, 403, { error: 'Admin access required' });
  sendJSON(res, 200, { feedback: store.listFeedbackForAdmin() });
});

route('POST', '/api/admin/feedback/:id/reviewed', async (req, res, params, user) => {
  if (!isAdmin(user)) return sendJSON(res, 403, { error: 'Admin access required' });
  const body = await readBody(req);
  let payload;
  try { payload = JSON.parse(body.toString('utf8')); } catch (e) { return sendJSON(res, 400, { error: 'Invalid JSON body' }); }
  const ok = store.setFeedbackReviewed(Number(params.id), !!payload.reviewed);
  if (!ok) return sendJSON(res, 404, { error: 'No such feedback item' });
  sendJSON(res, 200, { ok: true });
});

route('GET', '/api/admin/flags', async (req, res, params, user) => {
  if (!isAdmin(user)) return sendJSON(res, 403, { error: 'Admin access required' });
  sendJSON(res, 200, { flags: store.listFeatureFlags() });
});

route('POST', '/api/admin/flags/:id', async (req, res, params, user) => {
  if (!isAdmin(user)) return sendJSON(res, 403, { error: 'Admin access required' });
  const body = await readBody(req);
  let payload;
  try { payload = JSON.parse(body.toString('utf8')); } catch (e) { return sendJSON(res, 400, { error: 'Invalid JSON body' }); }
  const updated = store.setFeatureFlag(params.id, !!payload.enabled);
  if (!updated) return sendJSON(res, 404, { error: 'No such feature flag' });
  sendJSON(res, 200, { flag: updated });
});

// Real MRR from actual paying-tier counts x real price points; real AI spend from ai_usage rows;
// real file-ingestion + advisory-click counts. Deliberately NO combined gross-margin % — server
// cost is a manually-maintained config value, not something this app can honestly measure, and
// combining it with real numbers would imply a precision that doesn't exist (see admin_settings).
function priceUsdForTier(tierKey) {
  const tier = pricing.TIERS[tierKey];
  if (!tier) return 0;
  const match = String(tier.priceLabel).match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

route('GET', '/api/admin/telemetry', async (req, res, params, user) => {
  if (!isAdmin(user)) return sendJSON(res, 403, { error: 'Admin access required' });
  const counts = store.getUserCountsByTier();
  const mrrUsd = Object.keys(counts)
    .filter(tier => tier !== 'free')
    .reduce((sum, tier) => sum + counts[tier] * priceUsdForTier(tier), 0);
  const aiSpend = store.getAiSpendTotal();
  const advisorSpend = store.getAdminAiUsageTotal();
  const serverCostRaw = store.getAdminSetting('server_cost_monthly_usd');
  sendJSON(res, 200, {
    mrrUsd,
    userCountsByTier: counts,
    fileIngestion30d: store.getFileIngestionStats(),
    aiSpendUsd: aiSpend.costUsd,
    aiTokensUsed: aiSpend.tokens,
    // Kept separate from aiSpendUsd above — that number represents customer-driven COGS, this is
    // the internal Business Advisor tool's own usage, a different kind of cost entirely.
    advisorToolSpendUsd: advisorSpend.costUsd,
    serverCostMonthlyUsd: serverCostRaw ? Number(serverCostRaw) : null,
    advisoryClickCount: store.getAdvisoryClickCount()
  });
});

route('GET', '/api/admin/export.csv', async (req, res, params, user) => {
  if (!isAdmin(user)) return sendJSON(res, 403, { error: 'Admin access required' });
  const counts = store.getUserCountsByTier();
  const mrrUsd = Object.keys(counts)
    .filter(tier => tier !== 'free')
    .reduce((sum, tier) => sum + counts[tier] * priceUsdForTier(tier), 0);
  const aiSpend = store.getAiSpendTotal();
  const advisorSpend = store.getAdminAiUsageTotal();
  const ingestion = store.getFileIngestionStats();
  const serverCostRaw = store.getAdminSetting('server_cost_monthly_usd');

  const csvEscape = v => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    'metric,value',
    `mrr_usd,${mrrUsd}`,
    `users_free,${counts.free}`,
    `users_starter,${counts.starter}`,
    `users_pro,${counts.pro}`,
    `users_teams,${counts.teams}`,
    `file_ingestion_30d_total,${ingestion.total}`,
    `ai_spend_usd,${aiSpend.costUsd}`,
    `ai_tokens_used,${aiSpend.tokens}`,
    `advisor_tool_spend_usd,${advisorSpend.costUsd}`,
    `server_cost_monthly_usd,${serverCostRaw || ''}`,
    `advisory_click_count,${store.getAdvisoryClickCount()}`
  ];
  const body = lines.map(l => l.split(',').map((v, i) => i === 0 ? v : csvEscape(v)).join(',')).join('\n');
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="ordo7-admin-export.csv"'
  });
  res.end(body);
});

// Builds a real, plain-text snapshot of the business's current state for the AI Business Advisor
// — the exact same store functions and pricing math the telemetry endpoint and CSV export use, so
// the advisor is never reasoning over different numbers than what the admin console itself shows.
function buildAdvisorDataContext() {
  const counts = store.getUserCountsByTier();
  const mrrUsd = Object.keys(counts)
    .filter(tier => tier !== 'free')
    .reduce((sum, tier) => sum + counts[tier] * priceUsdForTier(tier), 0);
  const aiSpend = store.getAiSpendTotal();
  const ingestion = store.getFileIngestionStats();
  const serverCostRaw = store.getAdminSetting('server_cost_monthly_usd');
  const advisoryClicks = store.getAdvisoryClickCount();
  const flags = store.listFeatureFlags();
  const feedback = store.listFeedbackForAdmin();
  const openFeedback = feedback.filter(f => !f.reviewed);
  const reviewedCount = feedback.length - openFeedback.length;

  const flagLines = flags.map(f => `- ${f.name} (${f.id}): ${f.enabled ? 'ON' : 'OFF'} — ${f.description}`).join('\n') || '(none)';
  const openFeedbackLines = openFeedback.slice(0, 10)
    .map(f => `- [${f.user_email}] ${f.message}`).join('\n') || '(none open)';

  return `Real operational data, live snapshot from the production database:

REVENUE
- MRR: $${mrrUsd.toLocaleString()}
- Paying accounts by tier: ${counts.starter} Starter, ${counts.pro} Pro, ${counts.teams} Teams (${counts.free} on Free)

AI COST (customer-facing Ask Ordo + narrative generation, all-time)
- Total spend: $${aiSpend.costUsd.toFixed(2)}
- Total tokens: ${aiSpend.tokens.toLocaleString()}
- Manually-maintained monthly server/hosting cost: ${serverCostRaw ? '$' + Number(serverCostRaw).toLocaleString() + '/mo' : 'not set'} (no automated gross-margin % exists — this app doesn't compute one)

PRODUCT USAGE
- Schedule files analyzed in the last 30 days: ${ingestion.total} (${ingestion.xer} .xer, ${ingestion.xml} XML, ${ingestion.csv} CSV, ${ingestion.other} other)
- "Book Strategy Session" advisory-CTA clicks, all-time: ${advisoryClicks}

FEATURE FLAGS (kill switches — OFF means that feature is currently unavailable to every customer)
${flagLines}

PRODUCT FEEDBACK BACKLOG
- ${openFeedback.length} open, ${reviewedCount} reviewed (${feedback.length} total, all-time)
- Most recent open items:
${openFeedbackLines}`;
}

route('POST', '/api/admin/advisor/chat', async (req, res, params, user) => {
  if (!isAdmin(user)) return sendJSON(res, 403, { error: 'Admin access required' });
  if (!ai.aiConfigured()) return sendJSON(res, 503, { error: 'AI is not configured yet' });

  const body = await readBody(req);
  let payload;
  try { payload = JSON.parse(body.toString('utf8')); } catch (e) { return sendJSON(res, 400, { error: 'Invalid JSON body' }); }
  const message = String(payload.message || '').trim();
  if (!message) return sendJSON(res, 400, { error: 'Message cannot be empty' });
  if (message.length > 2000) return sendJSON(res, 400, { error: 'Keep questions under 2000 characters' });
  // The advisor conversation isn't persisted server-side (no dedicated table) — the client resends
  // prior turns each request, same shape as chat_messages rows ({role, content}), capped the same
  // way the schedule chat caps its own history.
  const history = Array.isArray(payload.history)
    ? payload.history.slice(-CHAT_HISTORY_LIMIT).map(m => ({ role: m.role, content: String(m.content || '') }))
    : [];

  const dataContext = buildAdvisorDataContext();

  let headersSent = false;
  const result = await ai.generateAdvisorReplyStream(dataContext, history, message, (chunk) => {
    if (!headersSent) { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); headersSent = true; }
    res.write(chunk);
  }).catch(err => { console.error('[advisor] stream error', err.message); return null; });

  if (!result) {
    if (!headersSent) return sendJSON(res, 502, { error: 'Could not get a reply right now — try again in a moment' });
    return res.end();
  }

  const cost = pricing.costUsd(result.inputTokens, result.outputTokens);
  store.logAdminAiUsage(user.id, result.inputTokens, result.outputTokens, cost);

  res.end(CHAT_STREAM_META_MARKER + JSON.stringify({ costUsd: cost, tokens: result.inputTokens + result.outputTokens }));
});

// --- Advisory click tracking (any authenticated user, not admin-only) ---

route('POST', '/api/advisory/click', async (req, res, params, user) => {
  store.logAdvisoryClick(user.id);
  sendJSON(res, 200, { ok: true });
});

// --- Feature flags (any authenticated user — the frontend needs current state to gate its own UI) ---

route('GET', '/api/feature-flags', async (req, res, params, user) => {
  const flags = store.listFeatureFlags();
  sendJSON(res, 200, { flags: flags.map(f => ({ id: f.id, enabled: !!f.enabled })) });
});

route('POST', '/api/analyze', async (req, res, params, user) => {
  // analyze.js has no sub-togglable pieces — DCMA-14 checks run as one inseparable pass over the
  // schedule, so this flag's blast radius is the entire upload/analyze pipeline, not just the
  // DCMA-specific findings. Disclosed, not hidden: flipping this off blocks all new uploads.
  if (!store.isFeatureEnabled('dcma-14-check')) return sendJSON(res, 503, { error: 'Schedule analysis is temporarily unavailable' });
  const contentType = req.headers['content-type'] || '';
  const buffer = await readBody(req);

  let filename, fileText, projectName;

  if (contentType.includes('multipart/form-data')) {
    const { fields, file } = parseMultipart(buffer, contentType);
    if (!file) return sendJSON(res, 400, { error: 'No file field found in form data' });
    filename = file.filename;
    fileText = file.content;
    projectName = fields.project || 'Untitled project';
  } else {
    // JSON body: { project, filename, content }
    let payload;
    try { payload = JSON.parse(buffer.toString('utf8')); } catch (e) { return sendJSON(res, 400, { error: 'Invalid JSON body' }); }
    filename = payload.filename || 'upload.xer';
    fileText = payload.content || '';
    projectName = payload.project || 'Untitled project';
  }

  if (!fileText) return sendJSON(res, 400, { error: 'No file content received' });

  let result;
  try {
    result = analyzeMod.analyzeFile(filename, fileText);
  } catch (e) {
    return sendJSON(res, 400, { error: 'Failed to parse schedule file: ' + e.message });
  }

  const { project, snapshot } = store.saveSnapshot(user.id, projectName, result, filename);
  const issues = store.getIssuesForSnapshot(snapshot.id);
  const earnedSchedule = analyzeMod.computeEarnedSchedule(result.activities || []);
  sendJSON(res, 200, {
    project, snapshot, issues, activities: result.activities || [], hasDates: !!result.hasDates,
    earnedSchedule, budgetAtCompletion: project.budget_at_completion ?? null, actualCostToDate: snapshot.actual_cost_to_date ?? null
  });
});

// Static file serving for the frontend (public/index.html etc.)
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
// Clean-URL aliases for static pages that external services (OAuth app registration forms, etc.)
// expect at a plain path rather than a .html extension.
const STATIC_ALIASES = { '/privacy': '/privacy.html', '/terms': '/terms.html', '/admin': '/admin.html' };

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Shared dark-theme chrome, reusing the same palette/typography as shared-snapshot.html so the
// blog reads as the same product rather than a bolted-on marketing microsite.
function renderBlogLayout({ title, description, canonicalPath, bodyHtml }) {
  const canonical = `https://www.ordo7.pro${canonicalPath}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:site_name" content="Ordo7">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<style>
  :root {
    --ink: #e7ecf2; --paper: #0a0e14; --line: #232b36; --muted: #8b96a5;
    --card: #121821; --teal: #2dd6c4; --accent: var(--teal);
  }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; background: var(--paper); color: var(--ink); margin: 0; padding: 32px 20px 80px; line-height: 1.65; }
  .wrap { max-width: 720px; margin: 0 auto; }
  a { color: var(--accent); }
  .back { display: inline-block; margin-bottom: 24px; font-size: 13px; color: var(--muted); text-decoration: none; }
  .brand { font-weight: 800; font-size: 22px; margin: 0 0 28px; }
  .brand span { color: #f37443; }
  h1 { font-size: 28px; line-height: 1.25; margin: 0 0 10px; }
  .post-meta { color: var(--muted); font-size: 13px; margin-bottom: 28px; }
  .post-list-item { border-bottom: 1px solid var(--line); padding: 20px 0; }
  .post-list-item:first-child { padding-top: 0; }
  .post-list-item h2 { font-size: 19px; margin: 0 0 6px; }
  .post-list-item h2 a { color: var(--ink); text-decoration: none; }
  .post-list-item h2 a:hover { color: var(--accent); }
  .post-list-item p { color: var(--muted); font-size: 14px; margin: 0; }
  .post-body { font-size: 15.5px; }
  .post-body h2 { font-size: 20px; margin: 32px 0 12px; }
  .post-body p { margin: 0 0 16px; }
  .post-body ul, .post-body ol { margin: 0 0 16px; padding-left: 22px; }
  .post-body li { margin-bottom: 8px; }
  .empty { color: var(--muted); font-size: 13px; }
  .cta { margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--line); text-align: center; font-size: 13px; color: var(--muted); }
  .cta a { font-weight: 600; }
</style>
</head>
<body>
<div class="wrap">
  <a class="back" href="/">&larr; www.ordo7.pro</a>
  <p class="brand">Ordo<span>7</span></p>
  ${bodyHtml}
  <p class="cta">Want to check your own schedule? <a href="/">Try Ordo7 free →</a></p>
</div>
</body>
</html>
`;
}

function serveBlogIndex(req, res) {
  const posts = store.listBlogPosts();
  const listHtml = posts.length
    ? posts.map(p => `<div class="post-list-item">
      <h2><a href="/blog/${escapeHtml(p.slug)}">${escapeHtml(p.title)}</a></h2>
      <p>${escapeHtml(p.description)}</p>
    </div>`).join('')
    : '<p class="empty">No posts yet — check back soon.</p>';
  const html = renderBlogLayout({
    title: 'Blog — Ordo7',
    description: 'Practical guidance on construction schedule health, DCMA checks, and spotting a bad baseline before it costs you.',
    canonicalPath: '/blog',
    bodyHtml: `<h1>The Ordo7 Blog</h1><p class="post-meta">Schedule health, explained without the jargon.</p>${listHtml}`
  });
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
}

function serveBlogPost(req, res, slug) {
  const post = store.getBlogPostBySlug(slug);
  if (!post) {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    return res.end(renderBlogLayout({
      title: 'Post not found — Ordo7 Blog',
      description: 'This post could not be found.',
      canonicalPath: `/blog/${slug}`,
      bodyHtml: '<h1>Post not found</h1><p class="empty">This post may have been moved or removed. <a href="/blog">Back to the blog</a>.</p>'
    }));
  }
  const publishedDate = new Date(post.published_at.includes('T') ? post.published_at : post.published_at + 'Z').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const html = renderBlogLayout({
    title: `${post.title} — Ordo7 Blog`,
    description: post.description,
    canonicalPath: `/blog/${post.slug}`,
    // content_html is authored server-side by us (seeded content or the reviewed output of the
    // marketing Routine's draft PR flow), never user-submitted, so it's trusted to render as-is.
    bodyHtml: `<h1>${escapeHtml(post.title)}</h1><p class="post-meta">${publishedDate} · Ordo7, powered by Level 7</p><div class="post-body">${post.content_html}</div>`
  });
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
}

function serveStatic(req, res, pathname) {
  pathname = STATIC_ALIASES[pathname] || pathname;
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(filePath);
    const type = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.txt': 'text/plain', '.xml': 'application/xml', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS'
    });
    return res.end();
  }

  if (pathname.startsWith('/api/')) {
    const match = matchRoute(req.method, pathname);
    if (!match) return sendJSON(res, 404, { error: 'No such route' });

    // GET /api/team/invite/:token is deliberately public — an invitee needs to see who invited
    // them before they've logged in or even have an account yet (see the accept flow's UI).
    const isPublicRoute = pathname.startsWith('/api/auth/') || pathname === '/api/billing/webhook' || pathname.startsWith('/api/public/') || pathname === '/api/health' ||
      (req.method === 'GET' && /^\/api\/team\/invite\/[^/]+$/.test(pathname));
    const cookies = auth.parseCookies(req);
    const user = auth.getUserForToken(cookies.session);
    if (!isPublicRoute && !user) return sendJSON(res, 401, { error: 'Not authenticated' });

    // Every account (including the free tier) can use the core app — there is no longer a
    // blanket "subscribe or you're locked out" gate. The only thing a plan/credit balance
    // restricts is AI narrative generation, enforced in that route itself (see /api/snapshots/:id/narrative).

    // Unverified accounts are blocked everywhere except the auth routes themselves (so they can
    // still log out, check /api/auth/me, or resend the verification email). Only applies to
    // accounts created while verification was configured — see the DEFAULT 1 migration note in
    // db.js for why existing/grandfathered accounts are never affected by this.
    if (!isPublicRoute && user && !user.email_verified) {
      return sendJSON(res, 403, { error: 'Verify your email to continue', code: 'EMAIL_NOT_VERIFIED' });
    }

    try {
      await match.handler(req, res, match.params, user);
    } catch (e) {
      console.error(e);
      sendJSON(res, 500, { error: 'Internal server error', detail: e.message });
    }
    return;
  }

  // /shared/<token> is a single client-side page — the token is read from location.pathname in
  // the browser and resolved via GET /api/public/snapshot/:token, so any path under /shared/
  // serves the same static file regardless of the token segment.
  if (pathname.startsWith('/shared/')) return serveStatic(req, res, '/shared-snapshot.html');

  // The blog is rendered server-side (unlike the rest of this app, which is a static shell that
  // fetches from /api/) because its entire purpose is search-engine indexing — a client-only
  // render would leave non-JS crawlers with an empty page.
  if (pathname === '/blog' || pathname === '/blog/') return serveBlogIndex(req, res);
  if (pathname.startsWith('/blog/')) return serveBlogPost(req, res, pathname.slice('/blog/'.length));

  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`Schedule health API running at http://localhost:${PORT}`);
  const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  console.log(`Database file: ${path.join(dataDir, 'schedule-health.db')}`);
});
