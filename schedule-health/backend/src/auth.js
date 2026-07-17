// auth.js — password hashing, sessions, and cookie handling.
// Zero-dependency by design: uses node:crypto's scrypt for password hashing
// and opaque random session tokens stored in SQLite (via db.js), rather than
// pulling in bcrypt or a JWT library.
const crypto = require('node:crypto');
const store = require('./db');

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const TEAM_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
// Shorter than verification's 24h — a password reset link is more sensitive (whoever holds it
// can take over the account outright), so it gets a tighter window.
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const SCRYPT_KEYLEN = 64;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(expectedHash, 'hex');
  if (hash.length !== expected.length) return false;
  return crypto.timingSafeEqual(hash, expected);
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  store.createSession(token, userId, expiresAt);
  return { token, expiresAt };
}

function getUserForToken(token) {
  if (!token) return null;
  const session = store.getSession(token);
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    store.deleteSession(token);
    return null;
  }
  return store.getUserById(session.user_id);
}

function createVerificationToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS).toISOString();
  store.createVerificationToken(token, userId, expiresAt);
  return token;
}

function createTeamInviteToken(ownerId, email) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TEAM_INVITE_TTL_MS).toISOString();
  store.createTeamInvite(token, ownerId, email, expiresAt);
  return token;
}

// Consumes (deletes) the token whether or not it's expired/valid, so a token can only ever be
// used once — a leaked verification link found in browser history or a logfile can't be replayed.
function verifyEmailToken(token) {
  const row = store.getVerificationToken(token);
  if (!row) return null;
  store.deleteVerificationToken(token);
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return row.user_id;
}

function createPasswordResetToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString();
  store.createPasswordResetToken(token, userId, expiresAt);
  return token;
}

// Same single-use consumption pattern as verifyEmailToken — see comment there.
function verifyPasswordResetToken(token) {
  const row = store.getPasswordResetToken(token);
  if (!row) return null;
  store.deletePasswordResetToken(token);
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return row.user_id;
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    cookies[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return cookies;
}

function isSecureRequest(req) {
  return Boolean(req.socket.encrypted) || req.headers['x-forwarded-proto'] === 'https';
}

function sessionCookie(token, req, maxAgeSeconds) {
  let cookie = `session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
  if (isSecureRequest(req)) cookie += '; Secure';
  return cookie;
}

function clearCookie(req) {
  let cookie = 'session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0';
  if (isSecureRequest(req)) cookie += '; Secure';
  return cookie;
}

// Short-lived cookie holding the OAuth CSRF state (and, for providers requiring PKCE, the code
// verifier) across the redirect round-trip to the provider and back. SameSite=Lax rather than
// Strict because it must still be sent on the top-level GET the provider redirects back with —
// Strict would drop it on that cross-site navigation and break every provider's callback.
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes — long enough for a human to complete login

function oauthStateCookie(payload, req) {
  const value = encodeURIComponent(JSON.stringify(payload));
  let cookie = `oauth_state=${value}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${OAUTH_STATE_TTL_MS / 1000}`;
  if (isSecureRequest(req)) cookie += '; Secure';
  return cookie;
}

function clearOAuthStateCookie(req) {
  let cookie = 'oauth_state=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0';
  if (isSecureRequest(req)) cookie += '; Secure';
  return cookie;
}

module.exports = {
  hashPassword, verifyPassword, createSession, getUserForToken,
  createVerificationToken, verifyEmailToken, createTeamInviteToken,
  createPasswordResetToken, verifyPasswordResetToken,
  parseCookies, sessionCookie, clearCookie,
  oauthStateCookie, clearOAuthStateCookie,
  EMAIL_RE, SESSION_TTL_MS, VERIFICATION_TTL_MS, PASSWORD_RESET_TTL_MS
};
