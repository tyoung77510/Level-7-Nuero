// server.js — dependency-free HTTP API for the schedule health app
// Run with: node src/server.js
// No `npm install` required — uses only Node's built-in http and node:sqlite modules (Node 22+).

const http = require('node:http');
const url = require('node:url');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

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
const rateLimit = require('./rate-limit');
const webhook = require('./webhook');

store.deleteExpiredSessions();
store.pruneOldErrors();

// Logs a server-side error to the admin-visible error_log table and, if configured, alerts the
// team via Knock — deduped to at most one alert per distinct error message per hour (via
// rate-limit.js's bucket mechanism, repurposed here for dedup rather than per-client throttling)
// so a repeating error doesn't spam the inbox. Errors are always recorded regardless of whether
// the alert is configured — see errorAlertConfigured() in knock.js.
function recordError(err, req, userEmail) {
  try {
    store.logError({
      message: err && err.message,
      stack: err && err.stack,
      method: req && req.method,
      path: req && req.url,
      userEmail: userEmail || null
    });
  } catch (e) {
    console.error('[error-log] failed to persist error record:', e.message);
  }
  const signature = String((err && err.message) || 'Unknown error').slice(0, 100);
  if (rateLimit.checkRateLimit('error-alert', signature, 1, 60 * 60 * 1000).allowed) {
    knock.notifyError(signature, req && req.url).catch(() => {});
  }
}

// Backstop for anything that slips past the dispatcher's own try/catch below (e.g. a
// fire-and-forget `.catch(() => {})` callback that itself throws, or a truly unawaited promise).
// unhandledRejection is logged without crashing — extremely common in a long-running Node HTTP
// server and rarely indicates corrupted process state. uncaughtException is logged and then
// rethrown deliberately: Node's own advice is not to resume normal operation after one, since
// state may be inconsistent — better to let Railway restart the container than keep serving from
// a possibly-broken process.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
  recordError(reason instanceof Error ? reason : new Error(String(reason)), null);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  recordError(err, null);
  process.exit(1);
});

// Blog posts are authored in blog-content.js (reviewed like any other code change) and synced
// into the DB on boot — adding a post, or editing an existing one, is a normal code change, not
// a manual DB write. Existing rows are updated in place so title/description/copy fixes actually
// reach production instead of being silently stuck at whatever was first seeded.
for (const post of blogContent) {
  const existing = store.getBlogPostBySlug(post.slug);
  const tocJson = post.toc ? JSON.stringify(post.toc) : null;
  if (!existing) {
    store.createBlogPost(post.slug, post.title, post.description, post.contentHtml, post.category, post.toc, post.headline);
  } else if (
    existing.title !== post.title || existing.description !== post.description || existing.content_html !== post.contentHtml ||
    existing.category !== (post.category || 'Fundamentals') || (existing.toc_json || null) !== tocJson ||
    (existing.headline || null) !== (post.headline || null)
  ) {
    store.updateBlogPost(post.slug, post.title, post.description, post.contentHtml, post.category, post.toc, post.headline);
  }
}
// A post removed from blogContent (unpublished) or given a new slug (renamed) must not keep
// serving from a stale DB row — see pruneBlogPosts in db.js. Old-slug requests are still handled
// gracefully via BLOG_SLUG_REDIRECTS (301), not left as a broken link.
store.pruneBlogPosts(blogContent.map(post => post.slug));

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

// Checks and, on a miss, immediately sends the 429 response — so a route just does
// `if (rateLimited(...)) return;` at the top rather than handling the result itself. Bucketed by
// name + IP (see rate-limit.js): auth routes get a tight window (brute-force/enumeration/spam
// protection with no other mitigation), AI routes get a looser one (defense-in-depth on top of
// the credit-balance gate that already caps real cost per account).
function rateLimited(res, name, req, maxRequests, windowMs) {
  const ip = rateLimit.clientIp(req);
  const result = rateLimit.checkRateLimit(name, ip, maxRequests, windowMs);
  if (!result.allowed) {
    res.setHeader('Retry-After', String(result.retryAfterSeconds));
    sendJSON(res, 429, { error: 'Too many requests — try again shortly' });
    return true;
  }
  return false;
}

function sendRedirect(res, location, cookies) {
  const headers = { Location: location };
  if (cookies && cookies.length) headers['Set-Cookie'] = cookies;
  res.writeHead(302, headers);
  res.end();
}

// Generous enough for a genuinely huge schedule export (tens of thousands of activities,
// verbose MSPDI XML) while still bounding how much an unbounded/malicious upload can force this
// single process to buffer into memory at once. Enforced here, not per-route, so every one of
// this function's ~20 call sites gets the same protection without having to remember to add it.
const MAX_BODY_BYTES = 25 * 1024 * 1024; // 25MB

function readBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    let total = 0;
    let rejected = false;
    req.on('data', c => {
      total += c.length;
      if (total > MAX_BODY_BYTES) {
        // Deliberately NOT req.destroy() here — that kills the underlying socket outright, which
        // (tested) drops the connection before the 413 response below can ever reach the client.
        // Instead: stop retaining further chunks (the actual memory-safety fix) and let the
        // dispatcher's catch block write a real 413 response; the client's remaining upload gets
        // reset once that response closes the connection, same as e.g. nginx's client_max_body_size.
        if (!rejected) {
          rejected = true;
          const err = new Error('Request body too large (max 25MB)');
          err.statusCode = 413;
          reject(err);
        }
        return;
      }
      chunks.push(c);
    });
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

// Which trackers are actually configured, for the consent banner to decide which categories to
// even offer (never show "Marketing" as an option if no marketing tracker has an ID set — asking
// for consent to something that doesn't exist is its own kind of dishonest UI) and for
// consent.js to know which script(s) to inject once a category is actually consented to. IDs
// themselves aren't secret (they end up in public page source the moment a script loads), so
// this is safe to expose unauthenticated.
route('GET', '/api/public/tracking-config', async (req, res) => {
  sendJSON(res, 200, {
    gaId: process.env.GA4_MEASUREMENT_ID || null,
    metaPixelId: process.env.META_PIXEL_ID || null,
    linkedinPartnerId: process.env.LINKEDIN_PARTNER_ID || null
  });
});

// Records what a visitor consented to, for audit purposes -- separate from the ordo7_consent
// cookie itself (which is what actually gates script loading; this is just the durable log in
// case a consent decision is ever questioned). Public: most visitors haven't logged in when they
// first hit the consent banner (blog readers, marketing-site traffic before signup).
route('POST', '/api/public/consent', async (req, res, params, user) => {
  const body = await readBody(req);
  let payload;
  try { payload = JSON.parse(body.toString('utf8')); } catch (e) { return sendJSON(res, 400, { error: 'Invalid JSON body' }); }
  const categories = payload.categories;
  if (!categories || typeof categories !== 'object') return sendJSON(res, 400, { error: 'categories object required' });
  const cookies = auth.parseCookies(req);
  let consentId = cookies.ordo7_consent_id;
  if (!consentId) consentId = crypto.randomUUID();
  store.recordConsent(consentId, user ? user.id : null, categories);
  res.setHeader('Set-Cookie', `ordo7_consent_id=${consentId}; Path=/; Max-Age=63072000; SameSite=Lax` + (isSecureRequest(req) ? '; Secure' : ''));
  sendJSON(res, 200, { consentId });
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
    isAdmin: isAdmin(user),
    webhookUrl: user.webhook_url || null
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
  if (rateLimited(res, 'signup', req, 5, 60 * 60 * 1000)) return; // 5/hour per IP — mass fake-account prevention
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
  if (rateLimited(res, 'forgot-password', req, 5, 60 * 60 * 1000)) return; // 5/hour per IP — prevents email-bombing a victim's inbox
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
  if (rateLimited(res, 'login', req, 10, 15 * 60 * 1000)) return; // 10/15min per IP — brute-force protection
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

// One webhook URL per account (see the ensureColumn comment in db.js for why not per-project).
// Validated with the same isSafeWebhookUrl check used at delivery time, so a user gets an
// immediate, clear error for an unsafe/malformed URL instead of a silently-broken integration.
route('PATCH', '/api/account/webhook', async (req, res, params, user) => {
  const body = await readBody(req);
  let payload;
  try { payload = JSON.parse(body.toString('utf8')); } catch (e) { return sendJSON(res, 400, { error: 'Invalid JSON body' }); }
  const url = payload.webhookUrl;
  if (url === null || url === '') {
    return sendJSON(res, 200, { user: publicUser(store.setWebhookUrl(user.id, null)) });
  }
  if (typeof url !== 'string' || !(await webhook.isSafeWebhookUrl(url))) {
    return sendJSON(res, 400, { error: 'That URL isn\'t reachable or isn\'t allowed — must be a public https:// URL (not localhost or an internal address).' });
  }
  sendJSON(res, 200, { user: publicUser(store.setWebhookUrl(user.id, url)) });
});

route('POST', '/api/account/webhook/test', async (req, res, params, user) => {
  if (!user.webhook_url) return sendJSON(res, 400, { error: 'No webhook URL saved yet' });
  const result = await webhook.deliverWebhook(user.webhook_url, {
    text: 'Ordo7: this is a test notification — your webhook is connected correctly.',
    event: 'test',
    project: null, score: null, critCount: null, riskCount: null, totalActivities: null,
    url: 'https://www.ordo7.pro/'
  });
  if (!result.ok) return sendJSON(res, 502, { error: result.reason });
  sendJSON(res, 200, { sent: true });
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
  const parsed = url.parse(req.url, true);
  const archived = parsed.query.archived === '1';
  sendJSON(res, 200, archived ? store.listArchivedProjects(user.id) : store.listProjects(user.id));
});

route('POST', '/api/projects/:name/archive', async (req, res, params, user) => {
  const project = store.getProjectByName(user.id, params.name);
  if (!project) return sendJSON(res, 404, { error: 'No such project' });
  sendJSON(res, 200, { project: store.archiveProject(user.id, params.name) });
});

route('POST', '/api/projects/:name/unarchive', async (req, res, params, user) => {
  const project = store.getProjectByName(user.id, params.name);
  if (!project) return sendJSON(res, 404, { error: 'No such project' });
  sendJSON(res, 200, { project: store.unarchiveProject(user.id, params.name) });
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
  // Defense-in-depth on top of the credit-balance gate below, which already caps total real cost
  // per account — this just stops a burst of rapid-fire requests (buggy client retry loop, or a
  // user with credits to burn hammering the endpoint) rather than budget abuse.
  if (rateLimited(res, 'ai-chat', req, 30, 10 * 60 * 1000)) return;
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

route('GET', '/api/admin/errors', async (req, res, params, user) => {
  if (!isAdmin(user)) return sendJSON(res, 403, { error: 'Admin access required' });
  sendJSON(res, 200, { errors: store.listErrorsForAdmin(100) });
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
  // No credit-balance gate on this route (staff-only, no billing model here) — the rate limit is
  // the only cost guard, same reasoning as the customer-facing chat route above.
  if (rateLimited(res, 'admin-advisor-chat', req, 30, 10 * 60 * 1000)) return;
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

  // Not awaited: a slow or broken webhook must never delay the response the user is waiting on
  // for their own analysis result.
  if (user.webhook_url) {
    webhook.deliverWebhook(user.webhook_url, {
      text: `Ordo7: "${projectName}" scored ${snapshot.score} (${snapshot.crit_count} critical, ${snapshot.risk_count} risk) — https://www.ordo7.pro/`,
      event: 'analysis_complete',
      project: projectName,
      score: snapshot.score,
      critCount: snapshot.crit_count,
      riskCount: snapshot.risk_count,
      totalActivities: snapshot.total_activities,
      url: 'https://www.ordo7.pro/'
    });
  }

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

// Per-category tag-pill styling for post-list rows and related cards. A category not in this map
// (a future post using a new one) still renders — just in a neutral gray rather than crashing —
// since this list isn't meant to be the source of truth for which categories exist, only how the
// four the index's own filter chips advertise happen to be colored.
const BLOG_CATEGORY_STYLES = {
  'Fundamentals': { label: 'FUNDAMENTALS', color: '#5eead4', bg: 'rgba(94,234,212,0.1)' },
  'DCMA & compliance': { label: 'DCMA', color: '#f4b955', bg: 'rgba(244,185,85,0.1)' },
  'For owners & PMs': { label: 'FOR OWNERS', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  'Product': { label: 'PRODUCT', color: '#46d19e', bg: 'rgba(70,209,158,0.1)' }
};
function categoryStyle(category) {
  return BLOG_CATEGORY_STYLES[category] || { label: String(category || '').toUpperCase(), color: '#8695a8', bg: 'rgba(148,163,184,0.1)' };
}

// No stored read-time column — derived from the post's own word count (strip tags, ~200wpm)
// rather than a number an author has to remember to keep in sync with edits.
function estimateReadTime(html) {
  const text = String(html || '').replace(/<[^>]+>/g, ' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function blogCanonicalUrl(slug) {
  return `https://www.ordo7.pro/blog/${slug}`;
}

// Old slug -> new slug (or null -> the blog index, for an unpublished post) — real 301s so nothing
// that indexed or linked to a since-renamed/removed post URL hits a dead end. Cresco work order,
// 2026-07-22: B5 stripped Founder Log numbering from every surviving entry's slug (visible gaps in
// the numbering implied more entries existed than actually do); B2 unpublished 014 outright
// (covered a competitor's feature launch — remove, don't rewrite); the survival-guide slug was
// tightened to match its actual search intent under the new title-tag/slug convention (A5).
const BLOG_SLUG_REDIRECTS = {
  'founder-log-035-no-fabrication': 'why-ordo7-never-fabricates-a-metric',
  'founder-log-014-ask-ordo': null,
  'founder-log-003-logic': 'missing-predecessors-successors-p6-dcma-check-1',
  'founder-log-004-utility-safety': 'utility-maintenance-schedule-discipline-safety',
  'founder-log-005-eight-years': 'eight-years-in-project-controls',
  'founder-log-007-building-in-public': 'building-ordo7-in-public',
  'founder-log-009-staffing-shortage': 'project-controls-staffing-shortage',
  'the-non-schedulers-survival-guide': 'contractor-baseline-red-flags-checklist'
};

function buildShareLinks(url, title) {
  const enc = encodeURIComponent;
  // Facebook and X dropped per work order A2 (trim the share row to LinkedIn + email) — Facebook
  // and X were never meaningful referral sources for this audience, and fewer inert-looking icons
  // reads cleaner than two that rarely get clicked.
  return {
    li: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
    wa: `https://wa.me/?text=${enc(title + ' ' + url)}`,
    mail: `mailto:?subject=${enc(title)}&body=${enc(url)}`
  };
}

function parsePublishedAt(raw) {
  const iso = raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z';
  return new Date(iso);
}
// published_at is stored (and parsed just above) as a UTC instant — datetime('now')'s SQLite
// default. Formatting it with the *server process's* local timezone (no timeZone option) shifts
// the displayed calendar date by however far that timezone sits from UTC — a post published a few
// hours before midnight UTC renders one day ahead for any host whose TZ is east of UTC. Pinning
// timeZone: 'UTC' here makes the displayed date match the UTC calendar day the timestamp actually
// falls on, regardless of what TZ the Node process happens to be running under (fixes A3).
function formatDateShort(d) { return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); }
function formatDateLong(d) { return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); }

// Derives every display-ready field a template needs from a raw blog_posts row, in one place, so
// the index and article renderers stay in sync instead of two hand-rolled copies of this math.
function postViewModel(post) {
  const url = blogCanonicalUrl(post.slug);
  const headline = post.headline || post.title;
  const date = parsePublishedAt(post.published_at);
  const toc = post.toc_json ? JSON.parse(post.toc_json) : null;
  return {
    ...post,
    url, headline, date,
    dateShort: formatDateShort(date),
    dateLong: formatDateLong(date),
    readMins: estimateReadTime(post.content_html),
    share: buildShareLinks(url, headline),
    cat: categoryStyle(post.category),
    toc: toc && toc.length ? toc : null
  };
}

const BLOG_FONTS_HEAD = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">`;

// One shared stylesheet for both blog pages (as opposed to two near-duplicate <style> blocks) —
// class-based rather than the design handoff's inline-style-per-element approach, since this is
// server-rendered from data (posts, categories) rather than a static one-off mockup.
const BLOG_STYLE = `
* { box-sizing: border-box; }
body { margin: 0; background: #06090f; font-family: 'Manrope', sans-serif; color: #e8eef6; }
a { color: #5eead4; text-decoration: none; }
a:hover { color: #99f6e4; }
::selection { background: rgba(94,234,212,0.25); color: #f4f8fc; }
.navlink:hover { color: #e8eef6 !important; }
.postrow:hover { border-color: rgba(94,234,212,0.35) !important; transform: translateY(-2px); }
.postrow:hover .arrow { transform: translateX(4px); color: #5eead4 !important; }
.tocitem:hover { color: #cdd7e3 !important; border-color: rgba(94,234,212,0.4) !important; }
.cta-pill:hover, .cta-block:hover { filter: brightness(1.06); transform: translateY(-1px); }
.ghost:hover { border-color: rgba(94,234,212,0.4); color: #eaf2f9; }
.chip:hover { border-color: rgba(94,234,212,0.4); color: #eaf2f9; }
.callout:hover { border-color: rgba(94,234,212,0.28); }
@keyframes riseIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
@keyframes floatGlow { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(40px,30px) scale(1.08); } }
@keyframes floatGlow2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-50px,20px) scale(1.12); } }
.reveal { opacity: 0; transform: translateY(22px); transition: opacity .7s cubic-bezier(.22,1,.36,1), transform .7s cubic-bezier(.22,1,.36,1); }
.reveal.in { opacity: 1; transform: none; }
.rise { animation: riseIn .5s ease both; }
@media (prefers-reduced-motion: reduce) { .reveal { opacity:1 !important; transform:none !important; } .glow, .rise { animation:none !important; } }
.blog-shell { position: relative; min-height: 100vh; overflow-x: hidden; }
.blog-ambient { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
.blog-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(148,163,184,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.04) 1px, transparent 1px); background-size: 64px 64px; -webkit-mask-image: radial-gradient(1200px 800px at 50% -5%, #000 0%, transparent 75%); mask-image: radial-gradient(1200px 800px at 50% -5%, #000 0%, transparent 75%); }
.glow { position: absolute; border-radius: 50%; filter: blur(30px); }
.glow-a { top: -180px; left: -140px; width: 620px; height: 620px; background: radial-gradient(circle, rgba(20,184,166,0.16), transparent 62%); animation: floatGlow 16s ease-in-out infinite; }
.glow-b { top: 260px; right: -200px; width: 560px; height: 560px; background: radial-gradient(circle, rgba(94,234,212,0.10), transparent 64%); animation: floatGlow2 20s ease-in-out infinite; }
#blogSpotlight { position: fixed; top: 0; left: 0; z-index: 1; pointer-events: none; width: 640px; height: 640px; margin: -320px 0 0 -320px; border-radius: 50%; background: radial-gradient(circle, rgba(94,234,212,0.10), transparent 60%); opacity: 0; transition: opacity .4s ease; transform: translate(-100px,-100px); }
.blog-content { position: relative; z-index: 2; }
#blogProgressTrack { position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 40; background: rgba(148,163,184,0.08); }
#blogProgressFill { height: 100%; width: 0%; background: linear-gradient(90deg,#5eead4,#22d3b0); transition: width .12s linear; }
.blog-header { position: sticky; top: 0; z-index: 30; backdrop-filter: blur(10px); background: rgba(6,9,15,0.72); border-bottom: 1px solid rgba(148,163,184,0.08); }
.blog-header-inner { max-width: 1120px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; padding: 16px 40px; }
.blog-logo { display: flex; align-items: center; gap: 11px; }
.blog-logo img { width: 28px; height: 28px; }
.blog-wordmark { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 19px; color: #e8eef6; letter-spacing: -0.01em; }
.blog-wordmark span { color: #5eead4; }
.blog-tag { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #5b6b7f; border-left: 1px solid rgba(148,163,184,0.2); padding-left: 11px; margin-left: 3px; }
.blog-navlinks { display: flex; align-items: center; gap: 28px; }
.navlink { color: #aab6c6; font-size: 14px; }
.navlink.active { color: #e8eef6; }
.cta-pill { font-family: 'Manrope', sans-serif; font-weight: 700; font-size: 13.5px; color: #06231f; background: linear-gradient(135deg,#5eead4,#22d3b0); padding: 9px 16px; border-radius: 9px; transition: all .18s ease; display: inline-block; }
.blog-footer { border-top: 1px solid rgba(148,163,184,0.08); background: #080c13; position: relative; z-index: 2; }
.blog-footer-inner { max-width: 1120px; margin: 0 auto; padding: 44px 40px; display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
.blog-footer-brand { display: flex; align-items: center; gap: 11px; }
.blog-footer-brand img { width: 24px; height: 24px; }
.blog-footer-links { display: flex; gap: 26px; font-size: 13.5px; color: #8695a8; align-items: center; flex-wrap: wrap; }
main.blog-main { max-width: 1120px; margin: 0 auto; padding: 76px 40px 120px; }
.blog-kicker { font-family: 'JetBrains Mono', monospace; font-size: 12px; letter-spacing: .18em; color: #5eead4; margin-bottom: 18px; }
.blog-h1 { font-family: 'Space Grotesk', sans-serif; font-size: 56px; line-height: 1.05; font-weight: 700; letter-spacing: -0.025em; margin: 0 0 20px; color: #f4f8fc; max-width: 760px; text-wrap: balance; }
.blog-sub { font-size: 19px; line-height: 1.6; color: #9aa8ba; margin: 0; max-width: 600px; }
.chips { display: flex; gap: 10px; margin: 44px 0 40px; flex-wrap: wrap; }
.chip-active, .chip { font-family: 'Manrope', sans-serif; cursor: pointer; }
.chip-active { font-weight: 600; font-size: 13px; color: #06231f; background: linear-gradient(135deg,#5eead4,#22d3b0); border: none; padding: 8px 15px; border-radius: 20px; }
.chip { font-size: 13px; color: #aab6c6; background: transparent; border: 1px solid rgba(148,163,184,0.18); padding: 8px 15px; border-radius: 20px; transition: all .18s ease; }
/* Cards use the "stretched link" pattern, not a card-wide <a>: an <a> can't contain another <a>
   (share icons are real nested links), so a full-card anchor would make browsers silently
   un-nest them and break the share links. .stretch-link is an invisible full-card overlay anchor
   sitting at z-index 0; any element that needs its own independent click target (the share row)
   gets position:relative + a higher z-index to float above the overlay instead. */
.stretch-link { position: absolute; inset: 0; z-index: 0; }
.card-interactive { position: relative; z-index: 1; }
.featured { position: relative; display: grid; grid-template-columns: 1.15fr 1fr; border: 1px solid rgba(148,163,184,0.14); border-radius: 18px; overflow: hidden; background: #0b111c; transition: all .22s ease; margin-bottom: 44px; }
.featured-left { padding: 40px 42px; }
.featured-badges { display: flex; gap: 10px; align-items: center; margin-bottom: 18px; }
.badge-featured { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #5eead4; background: rgba(94,234,212,0.1); border: 1px solid rgba(94,234,212,0.28); padding: 4px 10px; border-radius: 20px; }
.featured-cat { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #5b6b7f; }
.featured-title { position: relative; z-index: 1; display: block; font-family: 'Space Grotesk', sans-serif; font-size: 31px; line-height: 1.15; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 16px; color: #f4f8fc; text-wrap: balance; }
.featured-excerpt { font-size: 16px; line-height: 1.65; color: #9aa8ba; margin: 0 0 26px; }
.byline-row { display: flex; align-items: center; gap: 14px; }
.avatar { border-radius: 50%; background: linear-gradient(135deg,#5eead4,#22d3b0); display: flex; align-items: center; justify-content: center; color: #06231f; font-weight: 700; font-family: 'Space Grotesk', sans-serif; flex-shrink: 0; }
.byline-text { font-size: 13px; color: #8695a8; }
.byline-text b { color: #cdd7e3; font-weight: 600; }
.featured-right { position: relative; background: radial-gradient(420px 340px at 70% 30%, #0f2b26 0%, #0a1119 70%); border-left: 1px solid rgba(148,163,184,0.08); min-height: 340px; overflow: hidden; }
/* Purely decorative — its own mouse-tilt listens on window, not itself — so let clicks pass
   through to .stretch-link underneath instead of swallowing them (it paints on top by DOM order). */
.featured-right schedule-net, .featured-right canvas { pointer-events: none; }
.featured-right-label { position: absolute; left: 22px; bottom: 20px; z-index: 2; pointer-events: none; }
.featured-right-label .k { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: .16em; color: #5eead4; }
.featured-right-label .m { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #8695a8; margin-top: 3px; }
.section-label { font-family: 'JetBrains Mono', monospace; font-size: 12px; letter-spacing: .14em; color: #5b6b7f; margin-bottom: 20px; }
.postlist { display: flex; flex-direction: column; gap: 14px; }
.postrow { position: relative; cursor: pointer; display: flex; align-items: center; gap: 24px; border: 1px solid rgba(148,163,184,0.12); border-radius: 14px; padding: 22px 26px; background: #0a0f18; transition: all .22s ease; }
.postrow-body { flex: 1; min-width: 0; }
.tag-row { display: flex; gap: 10px; align-items: center; margin-bottom: 9px; }
.tag-pill { font-family: 'JetBrains Mono', monospace; font-size: 11px; padding: 3px 9px; border-radius: 20px; }
.postrow-meta { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #5b6b7f; }
.postrow-title { position: relative; z-index: 1; display: block; font-family: 'Space Grotesk', sans-serif; font-size: 19px; font-weight: 600; color: #f4f8fc; margin-bottom: 6px; letter-spacing: -0.01em; }
.postrow-excerpt { font-size: 14.5px; color: #8695a8; line-height: 1.5; margin-bottom: 14px; }
.arrow { flex-shrink: 0; font-size: 22px; color: #5b6b7f; transition: all .2s ease; }
.newsletter { margin-top: 60px; border: 1px solid rgba(94,234,212,0.22); border-radius: 18px; background: linear-gradient(135deg,rgba(94,234,212,0.07),rgba(94,234,212,0.01)); padding: 40px 44px; display: flex; align-items: center; justify-content: space-between; gap: 32px; flex-wrap: wrap; }
.newsletter h3 { font-family: 'Space Grotesk', sans-serif; font-size: 24px; font-weight: 700; color: #f4f8fc; margin: 0 0 8px; letter-spacing: -0.01em; }
.newsletter p { font-size: 15px; color: #9aa8ba; margin: 0; line-height: 1.55; max-width: 520px; }
.newsletter-form { display: flex; gap: 10px; flex: 1; min-width: 280px; max-width: 400px; }
.newsletter-form input { flex: 1; background: #090d16; border: 1px solid rgba(148,163,184,0.2); border-radius: 10px; padding: 13px 15px; color: #e8eef6; font-size: 14px; font-family: inherit; }
.share-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.share-label { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #5b6b7f; margin-right: 2px; }
.ghost { border-radius: 8px; border: 1px solid rgba(148,163,184,0.18); display: flex; align-items: center; justify-content: center; color: #aab6c6; font-size: 12px; transition: all .18s ease; }
main.blog-article-main { max-width: 1120px; margin: 0 auto; padding: 0 40px; }
.article-header { max-width: 760px; margin: 0 auto; padding: 64px 0 40px; }
.back-link { display: inline-flex; align-items: center; gap: 7px; font-size: 14px; color: #8695a8; margin-bottom: 34px; transition: color .15s ease; }
.back-link:hover { color: #99f6e4; }
.article-badges { display: flex; gap: 10px; align-items: center; margin-bottom: 22px; }
.article-h1 { font-family: 'Space Grotesk', sans-serif; font-size: 44px; line-height: 1.1; font-weight: 700; letter-spacing: -0.025em; margin: 0 0 26px; color: #f4f8fc; text-wrap: balance; }
.article-byline { display: flex; align-items: center; gap: 14px; padding-bottom: 34px; border-bottom: 1px solid rgba(148,163,184,0.12); flex-wrap: wrap; }
.byline-name { font-size: 14px; color: #cdd7e3; font-weight: 600; }
.byline-sub { font-size: 13px; color: #8695a8; }
.article-share { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.article-grid { display: grid; grid-template-columns: 1fr 224px; gap: 56px; max-width: 1040px; margin: 0 auto; align-items: start; padding-bottom: 100px; }
.article-body { max-width: 720px; font-size: 17px; line-height: 1.75; color: #9aa8ba; }
.article-body p.lead { font-size: 20px; line-height: 1.7; color: #c5d0dc; margin: 0 0 26px; font-weight: 500; }
.article-body > p { margin: 0 0 22px; }
.article-body em { color: #cdd7e3; font-style: italic; }
.article-body .flag { scroll-margin-top: 90px; }
.article-body .flag-head { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
.article-body .flag-num { flex-shrink: 0; width: 38px; height: 38px; border-radius: 11px; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 19px; display: flex; align-items: center; justify-content: center; background: var(--fc-bg); border: 1px solid var(--fc-bd); color: var(--fc); }
.article-body .flag h2 { font-family: 'Space Grotesk', sans-serif; font-size: 27px; font-weight: 600; color: #f4f8fc; margin: 2px 0 0; letter-spacing: -0.01em; }
.article-body .flag > p { margin: 0 0 20px; }
.article-body #s6 { scroll-margin-top: 90px; }
.article-body #s6 h2 { font-family: 'Space Grotesk', sans-serif; font-size: 27px; font-weight: 600; color: #f4f8fc; margin: 0 0 16px; letter-spacing: -0.01em; }
.callout { border: 1px solid rgba(148,163,184,0.14); border-left: 2px solid var(--fc); border-radius: 12px; background: #0b111c; padding: 18px 20px; margin: 0 0 40px; transition: border-color .2s ease; }
.callout-kicker { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: .1em; color: var(--fc); margin-bottom: 8px; }
.callout-body { font-size: 15px; line-height: 1.6; color: #cdd7e3; }
.flag-1 { --fc: #f2716a; --fc-bg: rgba(242,113,106,0.14); --fc-bd: rgba(242,113,106,0.4); }
.flag-2 { --fc: #f4b955; --fc-bg: rgba(244,185,85,0.14); --fc-bd: rgba(244,185,85,0.4); }
.flag-3 { --fc: #5eead4; --fc-bg: rgba(94,234,212,0.14); --fc-bd: rgba(94,234,212,0.4); }
.flag-4 { --fc: #a78bfa; --fc-bg: rgba(167,139,250,0.14); --fc-bd: rgba(167,139,250,0.4); }
.flag-5 { --fc: #46d19e; --fc-bg: rgba(70,209,158,0.14); --fc-bd: rgba(70,209,158,0.4); }
.inline-cta { margin-top: 20px; border: 1px solid rgba(94,234,212,0.3); border-radius: 16px; background: radial-gradient(600px 300px at 20% 0%, rgba(94,234,212,0.08), transparent 70%), #0b111c; padding: 32px 34px; }
.inline-cta h3 { font-family: 'Space Grotesk', sans-serif; font-size: 23px; font-weight: 700; color: #f4f8fc; margin: 0 0 10px; letter-spacing: -0.01em; }
.inline-cta p { font-size: 15.5px; line-height: 1.6; color: #9aa8ba; margin: 0 0 22px; max-width: 520px; }
.inline-cta-actions { display: flex; gap: 12px; flex-wrap: wrap; }
.cta-block { font-family: 'Manrope', sans-serif; font-weight: 700; font-size: 15px; color: #06231f; background: linear-gradient(135deg,#5eead4,#22d3b0); padding: 13px 24px; border-radius: 11px; transition: all .18s ease; display: inline-block; }
.ghost-btn { font-family: 'Manrope', sans-serif; font-weight: 600; font-size: 15px; color: #cdd7e3; border: 1px solid rgba(148,163,184,0.22); padding: 13px 22px; border-radius: 11px; transition: all .18s ease; display: inline-block; }
.ghost-btn:hover, .cta-block:hover { border-color: rgba(94,234,212,0.4); }
.toc-aside { position: sticky; top: 96px; align-self: start; }
.toc-label { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: .14em; color: #5b6b7f; margin-bottom: 16px; }
.toc-nav { display: flex; flex-direction: column; gap: 2px; border-left: 1px solid rgba(148,163,184,0.14); margin-bottom: 24px; }
.tocitem { font-size: 13px; color: #8695a8; padding: 7px 0 7px 16px; margin-left: -1px; border-left: 2px solid transparent; line-height: 1.4; transition: all .15s ease; }
.toc-share-block { padding-top: 20px; border-top: 1px solid rgba(148,163,184,0.12); }
.toc-share-block > .share-caption { font-size: 13px; color: #8695a8; line-height: 1.55; margin-bottom: 12px; }
.toc-book-cta { display: block; text-align: center; margin-top: 18px; font-family: 'Manrope', sans-serif; font-weight: 700; font-size: 13px; color: #06231f; background: linear-gradient(135deg,#5eead4,#22d3b0); padding: 11px; border-radius: 10px; transition: all .18s ease; }
.related-wrap { max-width: 1040px; margin: 0 auto; padding: 0 0 100px; }
.related-inner { border-top: 1px solid rgba(148,163,184,0.12); padding-top: 40px; }
.related-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; }
.related-card { position: relative; border: 1px solid rgba(148,163,184,0.12); border-radius: 14px; padding: 22px; background: #0a0f18; transition: all .22s ease; }
.related-card-title { position: relative; z-index: 1; display: block; font-family: 'Space Grotesk', sans-serif; font-size: 17px; font-weight: 600; color: #f4f8fc; margin: 14px 0 8px; line-height: 1.25; letter-spacing: -0.01em; }
.related-card-excerpt { font-size: 13.5px; color: #8695a8; line-height: 1.5; margin-bottom: 14px; }
.copied { color: #5eead4 !important; }
@media (max-width: 860px) {
  main.blog-main, main.blog-article-main { padding-left: 20px; padding-right: 20px; }
  .featured { grid-template-columns: 1fr; }
  .featured-right { min-height: 220px; }
  .article-grid { grid-template-columns: 1fr; }
  .toc-aside { position: static; }
  .related-grid { grid-template-columns: 1fr; }
  .blog-h1 { font-size: 38px; }
  .article-h1 { font-size: 32px; }
}
@media (max-width: 560px) {
  /* Product/Pricing don't fit alongside the logo + BLOG tag + Blog link + Try free pill at this
     width and the header (unlike the footer) has no flex-wrap — drop the two least-essential
     links rather than letting them overlap. Blog (home) and Try free (the conversion action)
     stay since they're the point of this page. */
  .blog-header-inner { padding: 14px 20px; }
  .blog-navlinks { gap: 14px; }
  .blog-navlinks a.navlink:not(.active) { display: none; }
}
`;

// Vanilla JS (no framework, matching this app's zero-build-step convention) driving: the mouse
// spotlight, scroll-reveal via IntersectionObserver, the article reading-progress bar, and
// copy-link buttons. Runs on both blog pages; the progress-bar/copy-link pieces are no-ops on the
// index page since those elements simply don't exist there.
const BLOG_SCRIPT = `
window.addEventListener('mousemove', function (e) {
  var sp = document.getElementById('blogSpotlight');
  if (!sp) return;
  sp.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)';
  sp.style.opacity = '1';
}, { passive: true });

(function () {
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
})();

(function () {
  var track = document.getElementById('blogProgressTrack');
  var fill = document.getElementById('blogProgressFill');
  if (!track || !fill) return;
  var onScroll = function () {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    var pct = max > 0 ? Math.min(100, Math.max(0, (h.scrollTop / max) * 100)) : 0;
    fill.style.width = pct.toFixed(1) + '%';
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

document.querySelectorAll('[data-copy-url]').forEach(function (btn) {
  btn.addEventListener('click', function (e) {
    e.preventDefault();
    var url = btn.getAttribute('data-copy-url');
    if (navigator.clipboard) { try { navigator.clipboard.writeText(url); } catch (err) {} }
    var original = btn.textContent;
    btn.textContent = '\\u2713';
    btn.classList.add('copied');
    setTimeout(function () { btn.textContent = original; btn.classList.remove('copied'); }, 1800);
  });
});

// Category chip filtering — only present on the index page, so this whole block is a silent
// no-op (chipBar is null) on the article page rather than needing a separate script include.
(function () {
  var chipBar = document.getElementById('blogChips');
  if (!chipBar) return;
  var featured = document.querySelector('.featured');
  var rows = Array.prototype.slice.call(document.querySelectorAll('.postrow'));
  var moreSection = document.getElementById('blogMoreSection');
  var emptyState = document.getElementById('blogEmptyState');

  function applyFilter(cat) {
    var anyVisible = false;
    if (featured) {
      var show = cat === 'all' || featured.getAttribute('data-cat') === cat;
      featured.style.display = show ? '' : 'none';
      if (show) anyVisible = true;
    }
    var anyRowVisible = false;
    rows.forEach(function (row) {
      var show = cat === 'all' || row.getAttribute('data-cat') === cat;
      row.style.display = show ? '' : 'none';
      if (show) { anyRowVisible = true; anyVisible = true; }
    });
    if (moreSection) moreSection.style.display = anyRowVisible ? '' : 'none';
    if (emptyState) emptyState.style.display = anyVisible ? 'none' : '';
  }

  chipBar.querySelectorAll('button').forEach(function (chip) {
    chip.addEventListener('click', function () {
      chipBar.querySelectorAll('button').forEach(function (c) { c.className = 'chip'; });
      chip.className = 'chip-active';
      applyFilter(chip.getAttribute('data-cat'));
    });
  });
})();
`;

function blogHeader(active) {
  return `<header class="blog-header">
    <div class="blog-header-inner">
      <a href="/blog" class="blog-logo">
        <img src="/brand/musk/glyph.png" alt="">
        <span class="blog-wordmark">Ordo<span>7</span></span>
        <span class="blog-tag">BLOG</span>
      </a>
      <nav class="blog-navlinks">
        <a href="/" class="navlink">Product</a>
        <a href="/" class="navlink">Pricing</a>
        <a href="/blog" class="navlink${active === 'blog' ? ' active' : ''}">Blog</a>
        <a href="/blog/founder-log" class="navlink${active === 'founder-log' ? ' active' : ''}">Founder Log</a>
        <a href="/" class="cta-pill">Try free →</a>
      </nav>
    </div>
  </header>`;
}

function blogFooter() {
  return `<footer class="blog-footer">
    <div class="blog-footer-inner">
      <div class="blog-footer-brand">
        <img src="/brand/musk/glyph.png" alt="">
        <span class="blog-wordmark">Ordo<span>7</span></span>
        <span style="font-size:13px; color:#5b6b7f; margin-left:6px;">Schedule intelligence for construction</span>
      </div>
      <div class="blog-footer-links">
        <a href="/" class="navlink" style="color:#8695a8;">Product</a>
        <a href="/" class="navlink" style="color:#8695a8;">Pricing</a>
        <a href="/privacy" class="navlink" style="color:#8695a8;">Privacy</a>
        <a href="/terms" class="navlink" style="color:#8695a8;">Terms</a>
        <a href="https://level7data.com/" target="_blank" rel="noopener" class="navlink" style="color:#8695a8;">Powered by Level 7</a>
        <a href="/" class="cta-pill">Try Ordo7 free →</a>
      </div>
    </div>
  </footer>`;
}

// Icon labels are plain text glyphs (in / 𝕏 / f / ✆ / ✉ / ⧉), same as the design handoff — it
// calls out swapping these for a real icon set (Phosphor) as a follow-up, not required for
// launch fidelity.
function shareRow(share, { size = 32, withCopy = false, copyUrl = '', leading = true } = {}) {
  const btn = (href, label, glyph, extra = '') => `<a href="${href}" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="ghost" title="${label}" style="width:${size}px; height:${size}px;" ${extra}>${glyph}</a>`;
  const copy = withCopy
    ? `<a href="#" class="ghost" title="Copy link" data-copy-url="${escapeHtml(copyUrl)}" onclick="event.stopPropagation()" style="width:${size}px; height:${size}px;">⧉</a>`
    : '';
  const wa = withCopy ? btn(share.wa, 'Share on WhatsApp', '✆') : '';
  return `<div class="share-row">
    ${leading ? '<span class="share-label">SHARE</span>' : ''}
    ${btn(share.li, 'LinkedIn', 'in')}
    ${wa}
    ${btn(share.mail, 'Email', '✉')}
    ${copy}
  </div>`;
}

function postRowHtml(vm) {
  return `<div class="postrow" data-cat="${escapeHtml(vm.category)}">
    <a href="/blog/${escapeHtml(vm.slug)}" class="stretch-link" aria-label="${escapeHtml(vm.headline)}"></a>
    <div class="postrow-body">
      <div class="tag-row">
        <span class="tag-pill" style="color:${vm.cat.color}; background:${vm.cat.bg};">${escapeHtml(vm.cat.label)}</span>
        <span class="postrow-meta">${vm.dateShort} · ${vm.readMins} min</span>
      </div>
      <a href="/blog/${escapeHtml(vm.slug)}" class="postrow-title">${escapeHtml(vm.headline)}</a>
      <div class="postrow-excerpt">${escapeHtml(vm.description)}</div>
      <div class="card-interactive">${shareRow(vm.share, { size: 29, leading: true })}</div>
    </div>
    <span class="arrow">→</span>
  </div>`;
}

function relatedCardHtml(vm) {
  return `<div class="related-card">
    <a href="/blog/${escapeHtml(vm.slug)}" class="stretch-link" aria-label="${escapeHtml(vm.headline)}"></a>
    <span class="tag-pill" style="color:${vm.cat.color}; background:${vm.cat.bg};">${escapeHtml(vm.cat.label)}</span>
    <a href="/blog/${escapeHtml(vm.slug)}" class="related-card-title">${escapeHtml(vm.headline)}</a>
    <div class="related-card-excerpt">${escapeHtml(vm.description)}</div>
    <div class="card-interactive">${shareRow(vm.share, { size: 29, leading: false })}</div>
  </div>`;
}

// Shared page wrapper: ambient background, spotlight, sticky nav/footer, fonts, shared stylesheet
// and script. isArticle adds the fixed reading-progress bar (present but at 0% width / inert on
// the index page would be misleading, so it's only in the DOM when actually meaningful).
function renderBlogPage({ title, description, canonicalPath, ogImage, isArticle, jsonLd, bodyHtml, active }) {
  const canonical = `https://www.ordo7.pro${canonicalPath}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" type="image/png" sizes="32x32" href="/brand/musk/icon-32.png">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="${isArticle ? 'article' : 'website'}">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:site_name" content="Ordo7">
<meta property="og:image" content="${ogImage || 'https://www.ordo7.pro/brand/musk/icon-512.png'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${ogImage || 'https://www.ordo7.pro/brand/musk/icon-512.png'}">
${BLOG_FONTS_HEAD}
${jsonLd ? `<script type="application/ld+json">\n${JSON.stringify(jsonLd)}\n</script>\n` : ''}<style>${BLOG_STYLE}</style>
</head>
<body>
<div class="blog-shell">
  <div class="blog-ambient">
    <div class="blog-grid"></div>
    <div class="glow glow-a"></div>
    <div class="glow glow-b"></div>
  </div>
  <div id="blogSpotlight"></div>
  <div class="blog-content">
    ${isArticle ? '<div id="blogProgressTrack"><div id="blogProgressFill"></div></div>' : ''}
    ${blogHeader(active)}
    ${bodyHtml}
    ${blogFooter()}
  </div>
</div>
<script>${BLOG_SCRIPT}</script>
<script src="/js/consent.js" defer></script>
</body>
</html>
`;
}

// Category chips are only worth showing for categories that actually have a published post in
// this list — a hardcoded chip for a category with zero posts always renders the "No posts in this
// category yet" empty state the moment someone clicks it (A1). Order follows first appearance in
// the (already published_at DESC-ordered) posts list, so the most recently active category tends
// to lead.
function chipCategoriesFrom(posts) {
  const seen = [];
  posts.forEach(p => { if (!seen.includes(p.category)) seen.push(p.category); });
  return seen;
}

function serveBlogIndex(req, res) {
  // Founder Log has its own tab (A6) — the main index only ever shows non-Founder-Log posts, so it
  // never surfaces Founder Log as a category chip or featured/list slot here.
  const posts = store.listBlogPosts().map(postViewModel).filter(p => p.category !== 'Founder Log');
  const featured = posts[0];
  const rest = posts.slice(1);

  let bodyHtml;
  if (!featured) {
    bodyHtml = `<main class="blog-main">
      <div class="rise">
        <div class="blog-kicker">THE ORDO7 BLOG</div>
        <h1 class="blog-h1">Schedule health, explained without the jargon.</h1>
        <p class="blog-sub">Practical writing for the people who own construction schedules — no PSP certification required.</p>
      </div>
      <p style="color:#8695a8; font-size:14px; margin-top:44px;">No posts yet — check back soon.</p>
    </main>`;
  } else {
    const moreSection = rest.length ? `
      <div id="blogMoreSection">
        <div class="section-label reveal">MORE FROM THE BLOG</div>
        <div class="postlist reveal">
          ${rest.map(postRowHtml).join('\n')}
        </div>
      </div>` : '';
    bodyHtml = `<main class="blog-main">
      <div class="rise">
        <div class="blog-kicker">THE ORDO7 BLOG</div>
        <h1 class="blog-h1">Schedule health, explained without the jargon.</h1>
        <p class="blog-sub">Practical writing for the people who own construction schedules — no PSP certification required.</p>
      </div>

      <div class="chips rise" id="blogChips">
        <button type="button" class="chip-active" data-cat="all">All</button>
        ${chipCategoriesFrom(posts).map(cat => `<button type="button" class="chip" data-cat="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`).join('\n        ')}
      </div>

      <div class="featured rise" data-cat="${escapeHtml(featured.category)}">
        <a href="/blog/${escapeHtml(featured.slug)}" class="stretch-link" aria-label="${escapeHtml(featured.headline)}"></a>
        <div class="featured-left">
          <div class="featured-badges">
            <span class="badge-featured">FEATURED</span>
            <span class="featured-cat">${escapeHtml(featured.category)}</span>
          </div>
          <a href="/blog/${escapeHtml(featured.slug)}" class="featured-title">${escapeHtml(featured.headline)}</a>
          <p class="featured-excerpt">${escapeHtml(featured.description)}</p>
          <div class="byline-row">
            <div class="avatar" style="width:34px; height:34px; font-size:14px;">O7</div>
            <div class="byline-text"><b>Ordo7 Team</b> · ${featured.dateShort} · ${featured.readMins} min read</div>
          </div>
          <div class="card-interactive" style="margin-top:22px;">${shareRow(featured.share, { size: 32 })}</div>
        </div>
        <div class="featured-right">
          <schedule-net></schedule-net>
          <div class="featured-right-label">
            <div class="k">SCHEDULE NETWORK</div>
            <div class="m">${rest.length + 1} post${rest.length ? 's' : ''} · live logic map</div>
          </div>
        </div>
      </div>

      ${moreSection}

      <p id="blogEmptyState" style="display:none; color:#8695a8; font-size:14px; margin-top:20px;">No posts in this category yet — check back soon.</p>

      <div class="newsletter reveal">
        <div>
          <h3>Schedule tips, twice a month.</h3>
          <p>Plain-language writing on reading, fixing and defending construction schedules. No spam.</p>
        </div>
        <form class="newsletter-form" onsubmit="event.preventDefault(); this.querySelector('button').textContent='Coming soon';">
          <input type="email" placeholder="you@company.com" required>
          <button type="submit" class="cta-pill" style="border:none; cursor:pointer;">Subscribe</button>
        </form>
      </div>
    </main>
    <script type="module" src="/js/schedule-net.js"></script>`;
  }

  const html = renderBlogPage({
    title: 'Ordo7 Blog — Schedule health, explained without the jargon',
    description: 'Practical guidance on construction schedule health, DCMA checks, and spotting a bad baseline before it costs you.',
    canonicalPath: '/blog',
    isArticle: false,
    active: 'blog',
    bodyHtml
  });
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
}

// Founder Log's own tab (A6) — a plain chronological list, deliberately with no featured hero and
// no chip filter (it's a single category by definition), so it reads as an archive rather than a
// second front page competing with the real one.
function serveFounderLogIndex(req, res) {
  const posts = store.listBlogPosts().map(postViewModel).filter(p => p.category === 'Founder Log');
  const bodyHtml = `<main class="blog-main">
      <div class="rise">
        <div class="blog-kicker">THE FOUNDER LOG</div>
        <h1 class="blog-h1">Building Ordo7, in public.</h1>
        <p class="blog-sub">Real milestones, real setbacks, no highlight reel — the day-to-day of building this alone.</p>
      </div>
      ${posts.length ? `
      <div class="section-label reveal" style="margin-top:36px;">ALL ENTRIES</div>
      <div class="postlist reveal">
        ${posts.map(postRowHtml).join('\n')}
      </div>` : `<p style="color:#8695a8; font-size:14px; margin-top:44px;">No entries yet — check back soon.</p>`}
    </main>`;

  const html = renderBlogPage({
    title: 'The Founder Log — Ordo7',
    description: 'Building Ordo7 in public: real milestones, real setbacks, documented as they happen.',
    canonicalPath: '/blog/founder-log',
    isArticle: false,
    active: 'founder-log',
    bodyHtml
  });
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
}

function serveBlogPost(req, res, slug) {
  const raw = store.getBlogPostBySlug(slug);
  if (!raw) {
    const html = renderBlogPage({
      title: 'Post not found — Ordo7 Blog',
      description: 'This post could not be found.',
      canonicalPath: `/blog/${slug}`,
      isArticle: false,
      active: 'blog',
      bodyHtml: `<main class="blog-main"><h1 class="blog-h1" style="font-size:32px;">Post not found</h1><p style="color:#8695a8;">This post may have been moved or removed. <a href="/blog">Back to the blog</a>.</p></main>`
    });
    res.writeHead(404, { 'Content-Type': 'text/html' });
    return res.end(html);
  }
  const post = postViewModel(raw);
  const others = store.listBlogPosts().map(postViewModel).filter(p => p.slug !== post.slug).slice(0, 3);

  const tocHtml = post.toc
    ? `<div class="toc-label">ON THIS PAGE</div>
       <nav class="toc-nav">
         ${post.toc.map(item => `<a href="#${escapeHtml(item.id)}" class="tocitem">${escapeHtml(item.label)}</a>`).join('\n')}
       </nav>`
    : '';

  const relatedHtml = others.length
    ? `<div class="related-wrap">
        <div class="related-inner reveal">
          <div class="section-label">KEEP READING</div>
          <div class="related-grid">
            ${others.map(relatedCardHtml).join('\n')}
          </div>
        </div>
      </div>`
    : '';

  const bodyHtml = `<main class="blog-article-main">
    <div class="article-header rise">
      <a href="/blog" class="back-link">← All posts</a>
      <div class="article-badges">
        <span class="badge-featured">${escapeHtml(post.category.toUpperCase())}</span>
        <span class="featured-cat">${post.readMins} min read</span>
      </div>
      <h1 class="article-h1">${escapeHtml(post.headline)}</h1>
      <div class="article-byline">
        <div class="avatar" style="width:42px; height:42px; font-size:16px;">O7</div>
        <div>
          <div class="byline-name">Ordo7 Team</div>
          <div class="byline-sub">${post.dateLong} · Powered by <a href="https://level7data.com/" target="_blank" rel="noopener">Level 7</a></div>
        </div>
        <div class="article-share">
          ${shareRow(post.share, { size: 36, withCopy: true, copyUrl: post.url })}
        </div>
      </div>
    </div>

    <div class="article-grid">
      <article class="article-body rise">
        ${post.content_html}
        <div class="inline-cta reveal">
          <h3>Run every check in one upload.</h3>
          <p>Drop in a P6, XER or MS Project file and Ordo7 scores your schedule in seconds — free to start, no card required.</p>
          <div class="inline-cta-actions">
            <a href="/" class="cta-block">Check your schedule free →</a>
            <a href="https://level7data.com/" target="_blank" rel="noopener" class="ghost-btn">Book a consultation with Level 7 →</a>
          </div>
        </div>
      </article>
      <aside class="toc-aside">
        ${tocHtml}
        <div class="toc-share-block">
          <div class="share-caption">Share this article</div>
          ${shareRow(post.share, { size: 34, withCopy: true, copyUrl: post.url, leading: false })}
          <a href="https://level7data.com/" target="_blank" rel="noopener" class="toc-book-cta">Book a consultation →</a>
        </div>
      </aside>
    </div>

    ${relatedHtml}
  </main>`;

  const html = renderBlogPage({
    title: `${post.title} — Ordo7 Blog`,
    description: post.description,
    canonicalPath: `/blog/${post.slug}`,
    ogImage: (blogContent.find(p => p.slug === post.slug) || {}).ogImage || 'https://www.ordo7.pro/brand/musk/icon-512.png',
    isArticle: true,
    active: 'blog',
    bodyHtml,
    // content_html is authored server-side by us (seeded content or the reviewed output of the
    // marketing Routine's draft PR flow), never user-submitted, so it's trusted to render as-is.
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.headline,
      description: post.description,
      datePublished: post.date.toISOString(),
      mainEntityOfPage: post.url,
      url: post.url,
      publisher: {
        '@type': 'Organization',
        name: 'Ordo7',
        url: 'https://www.ordo7.pro/',
        logo: 'https://www.ordo7.pro/brand/musk/icon-512.png'
      }
    }
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
    const type = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.txt': 'text/plain', '.xml': 'application/xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

// Every browser resource this app actually loads is same-origin except Google Fonts (the
// stylesheet from fonts.googleapis.com, the font files themselves from fonts.gstatic.com) — every
// Stripe/Knock/Anthropic/OAuth-provider call happens server-side (see billing.js/knock.js/ai.js/
// oauth.js), never from browser JS, so none of those need a connect-src entry. 'unsafe-inline' on
// script-src/style-src is a real trade-off, not an oversight: this app has no build step (see the
// many "no build step to share code" comments elsewhere in this codebase) — every page is a
// single inline <script>/<style> block, so a nonce-based CSP would need a genuine refactor. This
// still blocks the more common attack shapes (loading a remote script, exfiltrating via an
// unexpected fetch target, framing the site) without breaking the app that exists today.
//
// Analytics/marketing trackers (consent.js, gated behind the cookie-consent banner) are the one
// exception, and only when actually configured — computed once at startup from the same env vars
// GET /api/public/tracking-config reads, so an unconfigured tracker never loosens the CSP at all.
const scriptSrc = ["'self'", "'unsafe-inline'"];
const connectSrc = ["'self'"];
const imgSrc = ["'self'", 'data:'];
if (process.env.GA4_MEASUREMENT_ID) {
  scriptSrc.push('https://www.googletagmanager.com');
  connectSrc.push('https://www.google-analytics.com', 'https://analytics.google.com');
}
if (process.env.META_PIXEL_ID) {
  scriptSrc.push('https://connect.facebook.net');
  imgSrc.push('https://www.facebook.com');
  connectSrc.push('https://www.facebook.com');
}
if (process.env.LINKEDIN_PARTNER_ID) {
  scriptSrc.push('https://snap.licdn.com');
  imgSrc.push('https://px.ads.linkedin.com');
  connectSrc.push('https://px.ads.linkedin.com');
}
const CSP = [
  "default-src 'self'",
  'script-src ' + scriptSrc.join(' '),
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  'img-src ' + imgSrc.join(' '),
  'connect-src ' + connectSrc.join(' '),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ');

function isSecureRequest(req) {
  return Boolean(req.socket.encrypted) || req.headers['x-forwarded-proto'] === 'https';
}

const server = http.createServer(async (req, res) => {
  // Set once per response via setHeader (not writeHead) specifically so every route's own
  // writeHead(status, {...}) call further down — and there are ~20 of them, for JSON, redirects,
  // streamed chat, static files, the blog — merges with these instead of needing to repeat them
  // at every call site. Node merges setHeader() values with a later writeHead()'s header object;
  // it only overrides a header if writeHead's own object names that exact header.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', CSP);
  if (isSecureRequest(req)) res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');

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
      // readBody() throws a tagged 413 when a request body exceeds MAX_BODY_BYTES — surfaced as
      // its real status/message here rather than falling into the generic 500 below.
      if (e.statusCode) return sendJSON(res, e.statusCode, { error: e.message });
      console.error(e);
      recordError(e, req, user && user.email);
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
  // Founder Log now lives behind its own tab (A6) — a plain nav link, not the default view and not
  // a featured slot on the main index. Checked before the generic /blog/:slug fallback below since
  // 'founder-log' isn't a post slug.
  if (pathname === '/blog/founder-log' || pathname === '/blog/founder-log/') return serveFounderLogIndex(req, res);
  if (pathname.startsWith('/blog/')) {
    const slug = pathname.slice('/blog/'.length);
    if (Object.prototype.hasOwnProperty.call(BLOG_SLUG_REDIRECTS, slug)) {
      const dest = BLOG_SLUG_REDIRECTS[slug];
      res.writeHead(301, { Location: dest === null ? '/blog' : `/blog/${dest}` });
      return res.end();
    }
    return serveBlogPost(req, res, slug);
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`Schedule health API running at http://localhost:${PORT}`);
  const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  console.log(`Database file: ${path.join(dataDir, 'schedule-health.db')}`);
});
