// oauth.js — "Sign in with X" for Google, LinkedIn, Facebook, and X (Twitter).
// Zero-dependency: hand-rolled OAuth 2.0 authorization-code flow using node:crypto and fetch,
// same philosophy as the rest of this app. Each provider config below is just data — the flow
// itself (buildAuthUrl / exchangeCode / fetchProfile) is generic over all four.
const crypto = require('node:crypto');

// X's OAuth 2.0 requires PKCE even for confidential (server-side) clients — the others don't
// require it but accept it harmlessly, so nothing provider-specific leaks into server.js for this.
function generatePkce() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function generateState() {
  return crypto.randomBytes(24).toString('base64url');
}

const PROVIDERS = {
  google: {
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile',
    usesPkce: false,
    extraAuthParams: { access_type: 'online', prompt: 'select_account' },
    parseProfile: (data) => ({
      id: data.sub,
      email: data.email || null,
      emailVerified: Boolean(data.email_verified),
      name: data.name || [data.given_name, data.family_name].filter(Boolean).join(' ') || 'Google user'
    })
  },
  linkedin: {
    clientIdEnv: 'LINKEDIN_CLIENT_ID',
    clientSecretEnv: 'LINKEDIN_CLIENT_SECRET',
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
    scope: 'openid profile email',
    usesPkce: false,
    extraAuthParams: {},
    parseProfile: (data) => ({
      id: data.sub,
      email: data.email || null,
      emailVerified: Boolean(data.email_verified),
      name: data.name || 'LinkedIn user'
    })
  },
  facebook: {
    clientIdEnv: 'FACEBOOK_CLIENT_ID',
    clientSecretEnv: 'FACEBOOK_CLIENT_SECRET',
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/me',
    scope: 'email public_profile',
    usesPkce: false,
    extraAuthParams: {},
    // Facebook's token endpoint takes GET with query params (not a POST body like the others).
    tokenMethod: 'GET',
    userInfoParams: { fields: 'id,name,email' },
    parseProfile: (data) => ({
      id: data.id,
      email: data.email || null,
      emailVerified: Boolean(data.email), // Facebook only returns an email address once it's confirmed
      name: data.name || 'Facebook user'
    })
  },
  x: {
    clientIdEnv: 'X_CLIENT_ID',
    clientSecretEnv: 'X_CLIENT_SECRET',
    authUrl: 'https://x.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    userInfoUrl: 'https://api.twitter.com/2/users/me',
    scope: 'users.read tweet.read offline.access',
    usesPkce: true,
    extraAuthParams: {},
    // X's API does not expose email addresses through this scope — accounts created via X sign-in
    // fall back to the "finish signing up" step in server.js that asks for an email directly.
    parseProfile: (data) => ({
      id: data.data.id,
      email: null,
      emailVerified: false,
      name: data.data.name || 'X user'
    })
  }
};

function requireProvider(providerKey) {
  const provider = PROVIDERS[providerKey];
  if (!provider) throw new Error(`Unknown OAuth provider: ${providerKey}`);
  return provider;
}

function credentialsConfigured(providerKey) {
  const provider = requireProvider(providerKey);
  return Boolean(process.env[provider.clientIdEnv] && process.env[provider.clientSecretEnv]);
}

function redirectUri(providerKey, req) {
  const origin = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
  return `${origin}/api/auth/${providerKey}/callback`;
}

function buildAuthUrl(providerKey, req, state, pkce) {
  const provider = requireProvider(providerKey);
  const params = new URLSearchParams({
    client_id: process.env[provider.clientIdEnv],
    redirect_uri: redirectUri(providerKey, req),
    response_type: 'code',
    scope: provider.scope,
    state,
    ...provider.extraAuthParams
  });
  if (provider.usesPkce) {
    params.set('code_challenge', pkce.challenge);
    params.set('code_challenge_method', 'S256');
  }
  return `${provider.authUrl}?${params.toString()}`;
}

async function exchangeCode(providerKey, code, req, pkceVerifier) {
  const provider = requireProvider(providerKey);
  const clientId = process.env[provider.clientIdEnv];
  const clientSecret = process.env[provider.clientSecretEnv];
  const body = new URLSearchParams({
    client_id: clientId,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri(providerKey, req)
  });
  if (provider.usesPkce) body.set('code_verifier', pkceVerifier);

  let res;
  if (provider.tokenMethod === 'GET') {
    // Facebook only — token endpoint takes these as query params on a GET, not a POST body.
    body.set('client_secret', clientSecret);
    res = await fetch(`${provider.tokenUrl}?${body.toString()}`);
  } else {
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (providerKey === 'x') {
      // X requires the confidential client to authenticate via HTTP Basic auth rather than a
      // client_secret body field.
      headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
    } else {
      body.set('client_secret', clientSecret);
    }
    res = await fetch(provider.tokenUrl, { method: 'POST', headers, body: body.toString() });
  }
  if (!res.ok) {
    throw new Error(`${providerKey} token exchange failed: ${res.status} ${await res.text().catch(() => '')}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function fetchProfile(providerKey, accessToken) {
  const provider = requireProvider(providerKey);
  const params = new URLSearchParams(provider.userInfoParams || {});
  const url = params.toString() ? `${provider.userInfoUrl}?${params.toString()}` : provider.userInfoUrl;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new Error(`${providerKey} profile fetch failed: ${res.status} ${await res.text().catch(() => '')}`);
  }
  const data = await res.json();
  return provider.parseProfile(data);
}

module.exports = {
  PROVIDERS, generateState, generatePkce,
  credentialsConfigured, buildAuthUrl, exchangeCode, fetchProfile
};
