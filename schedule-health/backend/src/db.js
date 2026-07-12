// db.js — SQLite storage layer using Node's built-in node:sqlite (no npm dependency needed)
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'schedule-health.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    subscription_status TEXT NOT NULL DEFAULT 'none',
    plan_tier TEXT NOT NULL DEFAULT 'free',
    credit_balance INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, name)
  );

  CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    score INTEGER NOT NULL,
    healthy_pct INTEGER NOT NULL,
    risk_pct INTEGER NOT NULL,
    crit_pct INTEGER NOT NULL,
    total_activities INTEGER NOT NULL,
    crit_count INTEGER NOT NULL,
    risk_count INTEGER NOT NULL,
    source_filename TEXT,
    narrative TEXT
  );

  CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_id INTEGER NOT NULL REFERENCES snapshots(id),
    name TEXT NOT NULL,
    sub TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('crit','risk')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved'))
  );

  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ai_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    snapshot_id INTEGER NOT NULL REFERENCES snapshots(id),
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    cost_usd REAL NOT NULL,
    credits_charged INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_snapshots_project ON snapshots(project_id);
  CREATE INDEX IF NOT EXISTS idx_issues_snapshot ON issues(snapshot_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
  CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);
  CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ai_usage(user_id);
`);

// Lightweight migration: CREATE TABLE IF NOT EXISTS doesn't add columns to a table that already
// existed from an earlier version of this schema (e.g. a local dev database created before the
// narrative/plan_tier/credit_balance columns existed). Add anything missing.
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
ensureColumn('snapshots', 'narrative', 'TEXT');
ensureColumn('users', 'plan_tier', "TEXT NOT NULL DEFAULT 'free'");
ensureColumn('users', 'credit_balance', 'INTEGER NOT NULL DEFAULT 0');

function createUser(name, email, phone, passwordHash, passwordSalt, signupCredits) {
  db.prepare('INSERT INTO users (name, email, phone, password_hash, password_salt, credit_balance) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name, email, phone || null, passwordHash, passwordSalt, signupCredits || 0);
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function getUserByStripeCustomerId(customerId) {
  return db.prepare('SELECT * FROM users WHERE stripe_customer_id = ?').get(customerId);
}

function getUserByStripeSubscriptionId(subscriptionId) {
  return db.prepare('SELECT * FROM users WHERE stripe_subscription_id = ?').get(subscriptionId);
}

function setStripeCustomerId(userId, customerId) {
  db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customerId, userId);
  return getUserById(userId);
}

function setSubscriptionStatus(userId, status, subscriptionId) {
  db.prepare('UPDATE users SET subscription_status = ?, stripe_subscription_id = COALESCE(?, stripe_subscription_id) WHERE id = ?')
    .run(status, subscriptionId || null, userId);
  return getUserById(userId);
}

// Sets a user's plan and refills their credit balance to that plan's monthly allotment —
// used both on initial checkout and (once webhooks are live post-deploy) on each renewal.
function setUserTier(userId, tier, monthlyCredits) {
  db.prepare('UPDATE users SET plan_tier = ?, credit_balance = ? WHERE id = ?').run(tier, monthlyCredits, userId);
  return getUserById(userId);
}

function deductCredits(userId, amount) {
  db.prepare('UPDATE users SET credit_balance = credit_balance - ? WHERE id = ?').run(amount, userId);
  return getUserById(userId);
}

function logAiUsage(userId, snapshotId, inputTokens, outputTokens, costUsd, creditsCharged) {
  db.prepare(`
    INSERT INTO ai_usage (user_id, snapshot_id, input_tokens, output_tokens, cost_usd, credits_charged)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, snapshotId, inputTokens, outputTokens, costUsd, creditsCharged);
}

function createSession(token, userId, expiresAt) {
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
}

function getSession(token) {
  return db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
}

function deleteSession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function deleteExpiredSessions() {
  db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
}

function getOrCreateProject(userId, name) {
  let row = db.prepare('SELECT * FROM projects WHERE user_id = ? AND name = ?').get(userId, name);
  if (!row) {
    db.prepare('INSERT INTO projects (user_id, name) VALUES (?, ?)').run(userId, name);
    row = db.prepare('SELECT * FROM projects WHERE user_id = ? AND name = ?').get(userId, name);
  }
  return row;
}

function listProjects(userId) {
  return db.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY name').all(userId);
}

function getIssueOwnerUserId(issueId) {
  const row = db.prepare(`
    SELECT p.user_id AS user_id
    FROM issues i
    JOIN snapshots s ON s.id = i.snapshot_id
    JOIN projects p ON p.id = s.project_id
    WHERE i.id = ?
  `).get(issueId);
  return row ? row.user_id : null;
}

function saveSnapshot(userId, projectName, result, sourceFilename) {
  const project = getOrCreateProject(userId, projectName);
  db.prepare(`
    INSERT INTO snapshots
      (project_id, score, healthy_pct, risk_pct, crit_pct, total_activities, crit_count, risk_count, source_filename)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    project.id, result.score, result.healthyPct, result.riskPct, result.critPct,
    result.totalActivities, result.critCount, result.riskCount, sourceFilename || null
  );
  const snapshot = db.prepare('SELECT * FROM snapshots WHERE project_id = ? ORDER BY id DESC LIMIT 1').get(project.id);

  const insertIssue = db.prepare(`
    INSERT INTO issues (snapshot_id, name, sub, severity) VALUES (?, ?, ?, ?)
  `);
  for (const issue of result.issues) {
    insertIssue.run(snapshot.id, issue.name, issue.sub, issue.sev);
  }
  return { project, snapshot };
}

function getHistory(userId, projectName) {
  const project = db.prepare('SELECT * FROM projects WHERE user_id = ? AND name = ?').get(userId, projectName);
  if (!project) return [];
  return db.prepare('SELECT * FROM snapshots WHERE project_id = ? ORDER BY id ASC').all(project.id);
}

function getLatestSnapshot(userId, projectName) {
  const project = db.prepare('SELECT * FROM projects WHERE user_id = ? AND name = ?').get(userId, projectName);
  if (!project) return null;
  return db.prepare('SELECT * FROM snapshots WHERE project_id = ? ORDER BY id DESC LIMIT 1').get(project.id);
}

function getIssuesForSnapshot(snapshotId) {
  return db.prepare('SELECT * FROM issues WHERE snapshot_id = ? ORDER BY severity, id').all(snapshotId);
}

function getSnapshotById(snapshotId) {
  return db.prepare('SELECT * FROM snapshots WHERE id = ?').get(snapshotId);
}

function getSnapshotOwnerUserId(snapshotId) {
  const row = db.prepare(`
    SELECT p.user_id AS user_id
    FROM snapshots s
    JOIN projects p ON p.id = s.project_id
    WHERE s.id = ?
  `).get(snapshotId);
  return row ? row.user_id : null;
}

function setSnapshotNarrative(snapshotId, narrative) {
  db.prepare('UPDATE snapshots SET narrative = ? WHERE id = ?').run(narrative, snapshotId);
  return getSnapshotById(snapshotId);
}

function updateIssueStatus(issueId, status) {
  db.prepare('UPDATE issues SET status = ? WHERE id = ?').run(status, issueId);
  return db.prepare('SELECT * FROM issues WHERE id = ?').get(issueId);
}

function createFeedback(userId, message) {
  db.prepare('INSERT INTO feedback (user_id, message) VALUES (?, ?)').run(userId, message);
  return db.prepare('SELECT * FROM feedback WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(userId);
}

function getPortfolio(userId) {
  const projects = listProjects(userId);
  return projects.map(p => {
    const latest = db.prepare('SELECT * FROM snapshots WHERE project_id = ? ORDER BY id DESC LIMIT 1').get(p.id);
    return { project: p, latest };
  }).filter(row => row.latest);
}

module.exports = {
  db, getOrCreateProject, listProjects, saveSnapshot,
  getHistory, getLatestSnapshot, getIssuesForSnapshot, updateIssueStatus, getPortfolio,
  getIssueOwnerUserId, createFeedback,
  getSnapshotById, getSnapshotOwnerUserId, setSnapshotNarrative,
  createUser, getUserByEmail, getUserById,
  getUserByStripeCustomerId, getUserByStripeSubscriptionId, setStripeCustomerId, setSubscriptionStatus,
  setUserTier, deductCredits, logAiUsage,
  createSession, getSession, deleteSession, deleteExpiredSessions
};
