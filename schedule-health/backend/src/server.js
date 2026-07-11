// server.js — dependency-free HTTP API for the schedule health app
// Run with: node src/server.js
// No `npm install` required — uses only Node's built-in http and node:sqlite modules (Node 22+).

const http = require('node:http');
const url = require('node:url');
const fs = require('node:fs');
const path = require('node:path');

const analyzeMod = require('./analyze');
const store = require('./db');
const auth = require('./auth');

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

route('POST', '/api/auth/signup', async (req, res) => {
  const body = await readBody(req);
  let payload;
  try { payload = JSON.parse(body.toString('utf8')); } catch (e) { return sendJSON(res, 400, { error: 'Invalid JSON body' }); }
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '');
  if (!auth.EMAIL_RE.test(email)) return sendJSON(res, 400, { error: 'Enter a valid email address' });
  if (password.length < 8) return sendJSON(res, 400, { error: 'Password must be at least 8 characters' });
  if (store.getUserByEmail(email)) return sendJSON(res, 409, { error: 'An account with that email already exists' });

  const { salt, hash } = auth.hashPassword(password);
  const user = store.createUser(email, hash, salt);
  const { token } = auth.createSession(user.id);
  res.setHeader('Set-Cookie', auth.sessionCookie(token, req, auth.SESSION_TTL_MS / 1000));
  sendJSON(res, 200, { user: { id: user.id, email: user.email } });
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
  sendJSON(res, 200, { user: { id: user.id, email: user.email } });
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
  sendJSON(res, 200, { user: user ? { id: user.id, email: user.email } : null });
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

    const isAuthRoute = pathname.startsWith('/api/auth/');
    const cookies = auth.parseCookies(req);
    const user = auth.getUserForToken(cookies.session);
    if (!isAuthRoute && !user) return sendJSON(res, 401, { error: 'Not authenticated' });

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
