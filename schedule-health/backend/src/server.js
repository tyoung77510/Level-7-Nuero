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

store.deleteExpiredSessions();

const PORT = process.env.PORT || 3000;

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
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    subscriptionStatus: user.subscription_status
  };
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

  const { salt, hash } = auth.hashPassword(password);
  const user = store.createUser(name, email, phone, hash, salt);
  const { token } = auth.createSession(user.id);
  res.setHeader('Set-Cookie', auth.sessionCookie(token, req, auth.SESSION_TTL_MS / 1000));
  knock.identifyUser(user).catch(() => {}); // never let a marketing-sync failure block signup
  sendJSON(res, 200, { user: publicUser(user) });
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

// --- Billing routes (session required, active subscription NOT required — you need one to get one) ---

route('POST', '/api/billing/checkout', async (req, res, params, user) => {
  if (!billing.stripeConfigured()) return sendJSON(res, 503, { error: 'Billing is not configured yet' });
  const origin = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
  try {
    const session = await billing.createCheckoutSession({
      userId: user.id,
      email: user.email,
      customerId: user.stripe_customer_id,
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

  let updated = user;
  if (session.customer) updated = store.setStripeCustomerId(user.id, session.customer);
  const subscriptionStatus = session.subscription?.status || 'active';
  const subscriptionId = session.subscription?.id;
  updated = store.setSubscriptionStatus(user.id, subscriptionStatus, subscriptionId);
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

  const sub = event.data?.object;
  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const owner = store.getUserByStripeSubscriptionId(sub.id) || store.getUserByStripeCustomerId(sub.customer);
    if (owner) store.setSubscriptionStatus(owner.id, event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status, sub.id);
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
    date: s.created_at, score: s.score, critCount: s.crit_count, riskCount: s.risk_count, totalActivities: s.total_activities
  }));
  sendJSON(res, 200, history);
});

route('GET', '/api/projects/:name/latest', async (req, res, params, user) => {
  const snapshot = store.getLatestSnapshot(user.id, params.name);
  if (!snapshot) return sendJSON(res, 404, { error: 'No analysis yet for this project' });
  const issues = store.getIssuesForSnapshot(snapshot.id);
  sendJSON(res, 200, { snapshot, issues });
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

route('POST', '/api/analyze', async (req, res, params, user) => {
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
  sendJSON(res, 200, { project, snapshot, issues });
});

// Static file serving for the frontend (public/index.html etc.)
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
function serveStatic(req, res, pathname) {
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(filePath);
    const type = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' }[ext] || 'application/octet-stream';
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

    const isPublicRoute = pathname.startsWith('/api/auth/') || pathname === '/api/billing/webhook';
    const isBillingRoute = pathname.startsWith('/api/billing/');
    const cookies = auth.parseCookies(req);
    const user = auth.getUserForToken(cookies.session);
    if (!isPublicRoute && !user) return sendJSON(res, 401, { error: 'Not authenticated' });

    // Paid routes: once billing is configured, require an active (or trialing) subscription.
    // Auth and billing routes themselves stay exempt — you need to be able to log in and pay
    // before you can have a subscription.
    if (!isPublicRoute && !isBillingRoute && billing.stripeConfigured() && !['active', 'trialing'].includes(user.subscription_status)) {
      return sendJSON(res, 402, { error: 'An active subscription is required to use Schedule Health', subscriptionStatus: user.subscription_status });
    }

    try {
      await match.handler(req, res, match.params, user);
    } catch (e) {
      console.error(e);
      sendJSON(res, 500, { error: 'Internal server error', detail: e.message });
    }
    return;
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`Schedule health API running at http://localhost:${PORT}`);
  console.log(`Database file: ${path.join(__dirname, '..', 'data', 'schedule-health.db')}`);
});
