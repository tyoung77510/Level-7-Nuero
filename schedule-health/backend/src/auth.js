// auth.js — password hashing, sessions, and cookie handling.
// Zero-dependency by design: uses node:crypto's scrypt for password hashing
// and opaque random session tokens stored in SQLite (via db.js), rather than
// pulling in bcrypt or a JWT library.
const crypto = require('node:crypto');
const store = require('./db');

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
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

module.exports = {
  hashPassword, verifyPassword, createSession, getUserForToken,
  parseCookies, sessionCookie, clearCookie, EMAIL_RE, SESSION_TTL_MS
};
