// db.js — SQLite storage layer using Node's built-in node:sqlite (no npm dependency needed)
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

// DATA_DIR is configurable so a deployed instance can point it at a mounted persistent volume
// (e.g. Railway/Render), instead of the app's own source directory, which is wiped on redeploy.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
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
    email_verified INTEGER NOT NULL DEFAULT 0,
    referral_code TEXT UNIQUE,
    referred_by INTEGER REFERENCES users(id),
    -- NULL means this user is either solo or a Team owner (their own plan_tier/credit_balance
    -- govern their access). Set means this user is a Team *member* riding on the owner's
    -- subscription — see getEffectiveTierUser() in this file, which is the single place that
    -- resolves "whose plan actually applies here" so that logic never has to be duplicated
    -- at each call site.
    team_owner_id INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS verification_tokens (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );

  -- One row per linked social account. A user can link more than one provider to the same
  -- account (matched by email at link time), so this is a separate table rather than columns
  -- bolted onto users — avoids a users table with google_id/linkedin_id/facebook_id/x_id all
  -- nullable and mostly empty.
  CREATE TABLE IF NOT EXISTS oauth_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(provider, provider_user_id)
  );

  -- Holds a provider profile for the brief window between "signed in with a provider that
  -- doesn't give us an email" (X, currently) and the user typing one in on the "finish signing
  -- up" screen. Single-use, short expiry — same lifecycle as verification_tokens.
  CREATE TABLE IF NOT EXISTS pending_oauth_signups (
    token TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    name TEXT NOT NULL,
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
    narrative TEXT,
    logic_quality INTEGER,
    float_distribution INTEGER,
    constraint_hygiene INTEGER,
    activities_json TEXT,
    milestone_health INTEGER,
    share_token TEXT
  );

  CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_id INTEGER NOT NULL REFERENCES snapshots(id),
    name TEXT NOT NULL,
    sub TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('crit','risk')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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

  CREATE TABLE IF NOT EXISTS credit_purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    stripe_session_id TEXT NOT NULL UNIQUE,
    amount_usd REAL NOT NULL,
    credits_purchased INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_id INTEGER NOT NULL REFERENCES snapshots(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    role TEXT NOT NULL CHECK (role IN ('user','assistant')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Pending Teams seat invitations. Single-use like verification_tokens (deleted on accept or
  -- cancel), scoped to one owner + one email — a real team membership row only exists once
  -- accepted (users.team_owner_id), so this table only ever holds the "not yet accepted" state.
  CREATE TABLE IF NOT EXISTS team_invites (
    token TEXT PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES users(id),
    email TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );

  -- Server-rendered marketing content, deliberately separate from the app's other tables — posts
  -- are public, unauthenticated, and exist purely to be crawled/indexed, unlike everything else
  -- in this schema which is gated behind a user_id.
  CREATE TABLE IF NOT EXISTS blog_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    content_html TEXT NOT NULL,
    published_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_snapshots_project ON snapshots(project_id);
  CREATE INDEX IF NOT EXISTS idx_issues_snapshot ON issues(snapshot_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
  CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);
  CREATE INDEX IF NOT EXISTS idx_chat_messages_snapshot ON chat_messages(snapshot_id);
  CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ai_usage(user_id);
  CREATE INDEX IF NOT EXISTS idx_credit_purchases_user ON credit_purchases(user_id);
  CREATE INDEX IF NOT EXISTS idx_verification_tokens_user ON verification_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_team_invites_owner ON team_invites(owner_id);
`);

// Lightweight migration: CREATE TABLE IF NOT EXISTS doesn't add columns to a table that already
// existed from an earlier version of this schema (e.g. a local dev database created before the
// narrative/plan_tier/credit_balance columns existed). Add anything missing.
function ensureColumn(table, column, definition, backfillSql) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    if (backfillSql) db.exec(backfillSql);
  }
}
ensureColumn('snapshots', 'narrative', 'TEXT');
ensureColumn('users', 'plan_tier', "TEXT NOT NULL DEFAULT 'free'");
ensureColumn('users', 'credit_balance', 'INTEGER NOT NULL DEFAULT 0');
// DEFAULT 1 here (not 0!) — this migration runs against real existing accounts created before
// email verification existed (including live production users). They should be grandfathered in
// as verified, not retroactively locked out. New signups always pass an explicit value via
// createUser() regardless of this table-level default.
ensureColumn('users', 'email_verified', 'INTEGER NOT NULL DEFAULT 1');
// Nullable — old snapshots/issues predate these and simply have no value for them; the frontend
// treats null as "not available" rather than backfilling a fake computed score.
ensureColumn('snapshots', 'logic_quality', 'INTEGER');
ensureColumn('snapshots', 'float_distribution', 'INTEGER');
ensureColumn('snapshots', 'constraint_hygiene', 'INTEGER');
// Per-activity data for the Gantt timeline (Pro/Teams feature) — old snapshots predate this and
// simply have no bars to draw; the frontend treats a missing/empty value as "not available".
ensureColumn('snapshots', 'activities_json', 'TEXT');
// Nullable — a file with zero milestones has nothing to score (see milestoneHealthFrom in
// analyze.js), same "old snapshots show — instead of a fabricated number" convention as above.
ensureColumn('snapshots', 'milestone_health', 'INTEGER');
// Null until a user actually clicks "share" on that snapshot — generated lazily, not at analysis
// time, so a snapshot nobody ever chose to share has no live public URL sitting around.
ensureColumn('snapshots', 'share_token', 'TEXT');
// node:sqlite's ALTER TABLE ADD COLUMN only accepts a literal constant default (not even
// CURRENT_TIMESTAMP, let alone a function call like datetime('now')) — that restriction doesn't
// apply to CREATE TABLE, which is why this worked in every fresh database but crashed the moment
// it ran a real migration against an existing production database. Use a literal default to
// satisfy NOT NULL, then backfill real timestamps via a plain UPDATE (unrestricted). New rows
// always get an explicit updated_at at insert time (see insertIssue above), so they never rely on
// this column's default at all.
ensureColumn(
  'issues',
  'updated_at',
  "TEXT NOT NULL DEFAULT ''",
  "UPDATE issues SET updated_at = datetime('now') WHERE updated_at = ''"
);
// No UNIQUE here (unlike the CREATE TABLE version above) — node:sqlite's ALTER TABLE ADD COLUMN
// rejects UNIQUE/PRIMARY KEY constraints outright, same restriction class as the non-constant
// default issue above. Uniqueness is instead enforced in generateReferralCode() at the
// application level, which is safe since codes are only ever minted there, never user-supplied.
ensureColumn('users', 'referral_code', 'TEXT');
ensureColumn('users', 'referred_by', 'INTEGER REFERENCES users(id)');
ensureColumn('users', 'team_owner_id', 'INTEGER REFERENCES users(id)');
// Null means this account has never completed the first-login welcome hero + tour — checked
// server-side (not localStorage) so it's tied to the account, not the browser: switching devices
// or clearing storage must not re-trigger onboarding, and a second person logging into a shared
// browser must not silently skip it because a previous user already dismissed it there.
ensureColumn('users', 'onboarded_at', 'TEXT');

// Backfill referral codes for any pre-existing users (fresh databases already get one via
// createUser at signup; this only runs once, for accounts created before this feature existed).
// Each row needs a distinct random code, so this can't be a single UPDATE like other migrations.
for (const row of db.prepare('SELECT id FROM users WHERE referral_code IS NULL').all()) {
  db.prepare('UPDATE users SET referral_code = ? WHERE id = ?').run(generateReferralCode(), row.id);
}

function generateReferralCode() {
  let code;
  do {
    code = crypto.randomBytes(5).toString('base64url').slice(0, 7).toUpperCase();
  } while (db.prepare('SELECT 1 FROM users WHERE referral_code = ?').get(code));
  return code;
}

function createUser(name, email, phone, passwordHash, passwordSalt, signupCredits, emailVerified, referredBy) {
  const referralCode = generateReferralCode();
  db.prepare('INSERT INTO users (name, email, phone, password_hash, password_salt, credit_balance, email_verified, referral_code, referred_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(name, email, phone || null, passwordHash, passwordSalt, signupCredits || 0, emailVerified ? 1 : 0, referralCode, referredBy || null);
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function getUserByReferralCode(code) {
  return db.prepare('SELECT * FROM users WHERE referral_code = ?').get(code);
}

// Social sign-in. A user signing in via a provider we've never seen before, on an account whose
// email already exists, gets that provider linked to their existing account rather than a
// duplicate — email is the anchor identity across password and social login.
function getUserByOAuthAccount(provider, providerUserId) {
  const row = db.prepare('SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_user_id = ?').get(provider, providerUserId);
  return row ? getUserById(row.user_id) : null;
}

function linkOAuthAccount(userId, provider, providerUserId) {
  db.prepare('INSERT OR IGNORE INTO oauth_accounts (user_id, provider, provider_user_id) VALUES (?, ?, ?)').run(userId, provider, providerUserId);
}

// OAuth-only signups still need password_hash/password_salt (NOT NULL columns) satisfied — a
// random, never-revealed value does that without letting anyone log in with a "guessed" empty
// password, and without a schema change to make those columns nullable.
function createOAuthUser(name, email, signupCredits, emailVerified, referredBy) {
  const random = crypto.randomBytes(32).toString('hex');
  return createUser(name, email, null, random, random, signupCredits, emailVerified, referredBy);
}

function createPendingOAuthSignup(provider, providerUserId, name, expiresAt) {
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO pending_oauth_signups (token, provider, provider_user_id, name, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run(token, provider, providerUserId, name, expiresAt);
  return token;
}

// Single-use like verifyEmailToken — consumed whether or not it's expired, so a leaked token
// can't be replayed.
function consumePendingOAuthSignup(token) {
  const row = db.prepare('SELECT * FROM pending_oauth_signups WHERE token = ?').get(token);
  if (!row) return null;
  db.prepare('DELETE FROM pending_oauth_signups WHERE token = ?').run(token);
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return row;
}

function getReferralStats(userId) {
  const row = db.prepare('SELECT COUNT(*) AS count FROM users WHERE referred_by = ?').get(userId);
  return { referredCount: row.count };
}

function setEmailVerified(userId) {
  db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(userId);
  return getUserById(userId);
}

function markOnboarded(userId) {
  db.prepare("UPDATE users SET onboarded_at = datetime('now') WHERE onboarded_at IS NULL AND id = ?").run(userId);
  return getUserById(userId);
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

// --- Teams (multi-seat) ---
//
// A Team member's own plan_tier/credit_balance are irrelevant while team_owner_id is set — they
// ride entirely on the owner's subscription. This is the one function that resolves "whose plan
// actually governs this user's access" so every tier-gate check (feature access, credit
// deduction, etc.) goes through the same logic rather than re-deriving it inline and risking a
// member who's supposed to inherit Teams access instead getting checked against their own
// (possibly Free) plan_tier.
function getEffectiveTierUser(user) {
  if (!user.team_owner_id) return user;
  return getUserById(user.team_owner_id) || user; // owner deleted/missing — fall back to self rather than crash
}

function addTeamMember(ownerId, memberUserId) {
  db.prepare('UPDATE users SET team_owner_id = ? WHERE id = ?').run(ownerId, memberUserId);
}

function removeTeamMember(memberUserId) {
  db.prepare('UPDATE users SET team_owner_id = NULL WHERE id = ?').run(memberUserId);
}

function getTeamMembers(ownerId) {
  return db.prepare('SELECT * FROM users WHERE team_owner_id = ?').all(ownerId);
}

function createTeamInvite(token, ownerId, email, expiresAt) {
  db.prepare('INSERT INTO team_invites (token, owner_id, email, expires_at) VALUES (?, ?, ?, ?)').run(token, ownerId, email, expiresAt);
}

function getTeamInviteByToken(token) {
  return db.prepare('SELECT * FROM team_invites WHERE token = ?').get(token);
}

function deleteTeamInvite(token) {
  db.prepare('DELETE FROM team_invites WHERE token = ?').run(token);
}

function listPendingInvitesForOwner(ownerId) {
  return db.prepare("SELECT * FROM team_invites WHERE owner_id = ? AND expires_at >= datetime('now') ORDER BY created_at DESC").all(ownerId);
}

function deleteExpiredTeamInvites() {
  db.prepare("DELETE FROM team_invites WHERE expires_at < datetime('now')").run();
}

function deductCredits(userId, amount) {
  db.prepare('UPDATE users SET credit_balance = credit_balance - ? WHERE id = ?').run(amount, userId);
  return getUserById(userId);
}

function addCredits(userId, amount) {
  db.prepare('UPDATE users SET credit_balance = credit_balance + ? WHERE id = ?').run(amount, userId);
  return getUserById(userId);
}

function logAiUsage(userId, snapshotId, inputTokens, outputTokens, costUsd, creditsCharged) {
  db.prepare(`
    INSERT INTO ai_usage (user_id, snapshot_id, input_tokens, output_tokens, cost_usd, credits_charged)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, snapshotId, inputTokens, outputTokens, costUsd, creditsCharged);
}

function getCreditPurchaseBySessionId(sessionId) {
  return db.prepare('SELECT * FROM credit_purchases WHERE stripe_session_id = ?').get(sessionId);
}

// stripe_session_id is UNIQUE, so calling this twice for the same checkout session throws —
// callers should check getCreditPurchaseBySessionId first to make verification idempotent
// against a user refreshing the post-checkout success page.
function recordCreditPurchase(userId, sessionId, amountUsd, credits) {
  db.prepare(`
    INSERT INTO credit_purchases (user_id, stripe_session_id, amount_usd, credits_purchased)
    VALUES (?, ?, ?, ?)
  `).run(userId, sessionId, amountUsd, credits);
}

function getChatMessages(snapshotId) {
  return db.prepare('SELECT * FROM chat_messages WHERE snapshot_id = ? ORDER BY id ASC').all(snapshotId);
}

function addChatMessage(snapshotId, userId, role, content) {
  db.prepare(`
    INSERT INTO chat_messages (snapshot_id, user_id, role, content) VALUES (?, ?, ?, ?)
  `).run(snapshotId, userId, role, content);
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

function createVerificationToken(token, userId, expiresAt) {
  db.prepare('INSERT INTO verification_tokens (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
}

function getVerificationToken(token) {
  return db.prepare('SELECT * FROM verification_tokens WHERE token = ?').get(token);
}

function deleteVerificationToken(token) {
  db.prepare('DELETE FROM verification_tokens WHERE token = ?').run(token);
}

function deleteExpiredVerificationTokens() {
  db.prepare("DELETE FROM verification_tokens WHERE expires_at < datetime('now')").run();
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
      (project_id, score, healthy_pct, risk_pct, crit_pct, total_activities, crit_count, risk_count,
       source_filename, logic_quality, float_distribution, constraint_hygiene, activities_json, milestone_health)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    project.id, result.score, result.healthyPct, result.riskPct, result.critPct,
    result.totalActivities, result.critCount, result.riskCount, sourceFilename || null,
    result.logicQuality ?? null, result.floatDistribution ?? null, result.constraintHygiene ?? null,
    JSON.stringify(result.activities || []), result.milestoneHealth ?? null
  );
  const snapshot = db.prepare('SELECT * FROM snapshots WHERE project_id = ? ORDER BY id DESC LIMIT 1').get(project.id);

  const insertIssue = db.prepare(`
    INSERT INTO issues (snapshot_id, name, sub, severity, updated_at) VALUES (?, ?, ?, ?, datetime('now'))
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

// Generated on first share, not at analysis time — a snapshot nobody ever shared has no live
// public URL. Same random-token-with-collision-check pattern as generateReferralCode() above.
function getOrCreateShareToken(snapshotId) {
  const existing = getSnapshotById(snapshotId);
  if (!existing) return null;
  if (existing.share_token) return existing.share_token;
  let token;
  do {
    token = crypto.randomBytes(24).toString('hex');
  } while (db.prepare('SELECT 1 FROM snapshots WHERE share_token = ?').get(token));
  db.prepare('UPDATE snapshots SET share_token = ? WHERE id = ?').run(token, snapshotId);
  return token;
}

// Public (unauthenticated) lookup — joins the project name since the public view has no session
// to resolve it through, unlike every other snapshot query in this file.
function getPublicSnapshotByShareToken(token) {
  return db.prepare(`
    SELECT s.*, p.name AS project_name
    FROM snapshots s
    JOIN projects p ON p.id = s.project_id
    WHERE s.share_token = ?
  `).get(token);
}

function updateIssueStatus(issueId, status) {
  db.prepare("UPDATE issues SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, issueId);
  return db.prepare('SELECT * FROM issues WHERE id = ?').get(issueId);
}

// Powers the dashboard's "Live activity feed" — a merged, timestamp-sorted view of recent
// snapshots (schedule uploads) and issue status changes (acknowledged/resolved) for one project.
// Newly-detected open issues from the latest snapshot are included too, timestamped at that
// snapshot's created_at (issues don't carry their own distinct detection time — they're always
// created in a batch alongside the snapshot that found them).
function getActivityFeed(userId, projectName, limit) {
  const project = db.prepare('SELECT * FROM projects WHERE user_id = ? AND name = ?').get(userId, projectName);
  if (!project) return [];

  const snapshots = db.prepare(`
    SELECT id, created_at, total_activities, source_filename
    FROM snapshots WHERE project_id = ? ORDER BY id DESC LIMIT ?
  `).all(project.id, limit);

  const resolvedIssues = db.prepare(`
    SELECT i.id, i.name, i.status, i.updated_at
    FROM issues i JOIN snapshots s ON s.id = i.snapshot_id
    WHERE s.project_id = ? AND i.status != 'open'
    ORDER BY i.updated_at DESC LIMIT ?
  `).all(project.id, limit);

  const latest = snapshots[0];
  const newIssues = latest ? db.prepare(`
    SELECT id, name, severity FROM issues WHERE snapshot_id = ? AND status = 'open' AND severity = 'crit' LIMIT ?
  `).all(latest.id, limit) : [];

  const events = [
    ...snapshots.map(s => ({ type: 'snapshot', timestamp: s.created_at, totalActivities: s.total_activities, sourceFilename: s.source_filename })),
    ...resolvedIssues.map(i => ({ type: 'issue_' + i.status, timestamp: i.updated_at, name: i.name })),
    ...(latest ? newIssues.map(i => ({ type: 'new_issue', timestamp: latest.created_at, name: i.name })) : [])
  ];
  events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return events.slice(0, limit);
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

function listBlogPosts() {
  return db.prepare('SELECT * FROM blog_posts ORDER BY published_at DESC').all();
}

function getBlogPostBySlug(slug) {
  return db.prepare('SELECT * FROM blog_posts WHERE slug = ?').get(slug);
}

function createBlogPost(slug, title, description, contentHtml) {
  db.prepare('INSERT INTO blog_posts (slug, title, description, content_html) VALUES (?, ?, ?, ?)')
    .run(slug, title, description, contentHtml);
  return getBlogPostBySlug(slug);
}

module.exports = {
  db, getOrCreateProject, listProjects, saveSnapshot,
  getHistory, getLatestSnapshot, getIssuesForSnapshot, updateIssueStatus, getPortfolio, getActivityFeed,
  getIssueOwnerUserId, createFeedback,
  getSnapshotById, getSnapshotOwnerUserId, setSnapshotNarrative,
  getOrCreateShareToken, getPublicSnapshotByShareToken,
  createUser, getUserByEmail, getUserById, setEmailVerified, markOnboarded,
  getUserByOAuthAccount, linkOAuthAccount, createOAuthUser,
  createPendingOAuthSignup, consumePendingOAuthSignup,
  getUserByReferralCode, getReferralStats,
  getUserByStripeCustomerId, getUserByStripeSubscriptionId, setStripeCustomerId, setSubscriptionStatus,
  setUserTier, deductCredits, addCredits, logAiUsage,
  getEffectiveTierUser, addTeamMember, removeTeamMember, getTeamMembers,
  createTeamInvite, getTeamInviteByToken, deleteTeamInvite, listPendingInvitesForOwner, deleteExpiredTeamInvites,
  getCreditPurchaseBySessionId, recordCreditPurchase,
  getChatMessages, addChatMessage,
  createSession, getSession, deleteSession, deleteExpiredSessions,
  createVerificationToken, getVerificationToken, deleteVerificationToken, deleteExpiredVerificationTokens,
  listBlogPosts, getBlogPostBySlug, createBlogPost
};
