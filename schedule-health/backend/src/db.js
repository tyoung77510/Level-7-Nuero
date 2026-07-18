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

  -- Single-use, short-expiry like verification_tokens — see createPasswordResetToken.
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
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

  -- Server-side errors (unhandled route exceptions, uncaught exceptions, unhandled rejections) —
  -- so "something threw in production" is visible in the admin console without needing to watch
  -- Railway logs live. Unlike feedback, this is debugging history, not a permanent record — see
  -- pruneOldErrors, called on boot alongside the other startup cleanup.
  CREATE TABLE IF NOT EXISTS error_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT NOT NULL,
    stack TEXT,
    method TEXT,
    path TEXT,
    user_email TEXT,
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

  -- Admin Command Center: real on/off kill switches for specific features, checked server-side
  -- on every gated route (never just hidden client-side) so a flipped flag actually disables the
  -- feature app-wide, not just cosmetically in the UI. Seeded with 5 rows below, once.
  CREATE TABLE IF NOT EXISTS feature_flags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1
  );

  -- One row per real click on the dashboard's "Book Strategy Session" CTA — a count derived from
  -- actual rows (COUNT(*)) rather than a manually-incremented counter, so it can't drift out of
  -- sync and doubles as real historical data if a trend view is ever built on top of it later.
  CREATE TABLE IF NOT EXISTS advisory_clicks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Small generic key/value store for admin-maintained config that isn't auto-tracked anywhere
  -- (e.g. real monthly hosting cost) — a deliberately-entered honest number, not a fabricated one.
  CREATE TABLE IF NOT EXISTS admin_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  -- Real Claude spend for the admin-only Business Advisor tool, tracked separately from the
  -- customer-facing ai_usage table (which has a NOT NULL snapshot_id FK this doesn't have, and
  -- which feeds the "AI Spend" KPI that's meant to represent customer-driven COGS — mixing an
  -- internal tool's own usage into that number would misrepresent what it costs to serve customers).
  CREATE TABLE IF NOT EXISTS admin_ai_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    cost_usd REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Cookie-consent audit trail. consent_id is a random UUID handed out via a first-party cookie
  -- (not itself a tracking cookie -- its only purpose is remembering the visitor's own choice,
  -- which is why it doesn't need consent of its own). user_id is nullable: most consent decisions
  -- happen before or without ever logging in (blog readers, marketing-site visitors).
  CREATE TABLE IF NOT EXISTS consent_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    consent_id TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id),
    categories TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_snapshots_project ON snapshots(project_id);
  CREATE INDEX IF NOT EXISTS idx_issues_snapshot ON issues(snapshot_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
  CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);
  CREATE INDEX IF NOT EXISTS idx_error_log_created ON error_log(created_at);
  CREATE INDEX IF NOT EXISTS idx_chat_messages_snapshot ON chat_messages(snapshot_id);
  CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ai_usage(user_id);
  CREATE INDEX IF NOT EXISTS idx_credit_purchases_user ON credit_purchases(user_id);
  CREATE INDEX IF NOT EXISTS idx_verification_tokens_user ON verification_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_team_invites_owner ON team_invites(owner_id);
  CREATE INDEX IF NOT EXISTS idx_advisory_clicks_user ON advisory_clicks(user_id);
  CREATE INDEX IF NOT EXISTS idx_consent_log_consent_id ON consent_log(consent_id);
`);

// Seed the 5 kill-switchable features, once — INSERT OR IGNORE so re-running this on every boot
// never resets an admin's already-flipped toggle back to its default.
const FEATURE_FLAG_SEEDS = [
  { id: 'sandbox-simulator', name: 'Sandbox Simulator', description: 'Interactive "What-If" schedule duration overrides.' },
  { id: 'milestone-hygiene', name: 'Milestone Hygiene', description: 'Milestone logical-anchoring check view.' },
  { id: 'critical-path-engine', name: 'Critical Path Engine', description: 'Lists activities currently on the critical path.' },
  { id: 'dcma-14-check', name: 'DCMA 14-Point Check', description: 'Federal schedule-quality issue detection — the core scoring engine for every new analysis.' },
  { id: 'ask-ordo-ai', name: 'Ask Ordo AI', description: 'Claude-powered schedule Q&A in the sidebar.' },
  { id: 'earned-value-metrics', name: 'Earned Value Metrics', description: 'Earned Schedule progress tracking + optional manual-budget cost variance (CPI/CV).' }
];
for (const f of FEATURE_FLAG_SEEDS) {
  db.prepare('INSERT OR IGNORE INTO feature_flags (id, name, description, enabled) VALUES (?, ?, ?, 1)').run(f.id, f.name, f.description);
}
// Real Railway bill, entered manually since hosting cost isn't tracked anywhere in this app's
// data model — an honest, admin-maintained figure rather than a fabricated one.
db.prepare('INSERT OR IGNORE INTO admin_settings (key, value) VALUES (?, ?)').run('server_cost_monthly_usd', '3200');

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
// Admin feedback-triage status — 0 (open) until an admin marks it reviewed. Existing pre-migration
// feedback rows default to open (0) rather than silently marked reviewed, so nothing already
// submitted gets skipped just because this column didn't used to exist.
ensureColumn('feedback', 'reviewed', 'INTEGER NOT NULL DEFAULT 0');
// Budget lives on the project (one figure for its whole lifetime, rarely changes); actual cost
// lives per snapshot since spend-to-date only makes sense as of a specific status update — it's
// meant to be re-entered alongside each new upload, not a single static value like budget.
ensureColumn('projects', 'budget_at_completion', 'REAL');
ensureColumn('snapshots', 'actual_cost_to_date', 'REAL');
// Null = active. A timestamp rather than a boolean so "when was this archived" is answerable
// without a separate column, the same convention already used for onboarded_at/updated_at above.
ensureColumn('projects', 'archived_at', 'TEXT');
// Category drives the colored tag pill in post lists and the (inert, unfiltered) index chips —
// a fixed default rather than nullable since every post needs some category to render a pill at
// all, and 'Fundamentals' is a reasonable default for the one pre-migration post either way.
ensureColumn('blog_posts', 'category', "TEXT NOT NULL DEFAULT 'Fundamentals'");
// Null for a post with no numbered-section structure (most posts) — the sticky table-of-contents
// only renders when this is present, rather than showing an empty "ON THIS PAGE" nav.
ensureColumn('blog_posts', 'toc_json', 'TEXT');
// Separate from `title` on purpose: `title` drives the <title>/OG tag (kept short for SERP
// display — see the title-length SEO fix this replaced), `headline` is the richer on-page H1/
// display text design calls for. Null falls back to `title` at render time, so most posts (where
// the two don't need to differ) never have to set this at all.
ensureColumn('blog_posts', 'headline', 'TEXT');
// Null = no webhook configured (the default). One URL per account rather than per-project --
// matches "smart defaults over configuration": most accounts have one team/one Slack channel to
// notify, and per-project granularity can be added later if someone actually asks for it.
ensureColumn('users', 'webhook_url', 'TEXT');

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

function createPasswordResetToken(token, userId, expiresAt) {
  db.prepare('INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
}

function getPasswordResetToken(token) {
  return db.prepare('SELECT * FROM password_reset_tokens WHERE token = ?').get(token);
}

function deletePasswordResetToken(token) {
  db.prepare('DELETE FROM password_reset_tokens WHERE token = ?').run(token);
}

function deleteExpiredPasswordResetTokens() {
  db.prepare("DELETE FROM password_reset_tokens WHERE expires_at < datetime('now')").run();
}

// Called on a successful password reset — a leaked/compromised password means any existing
// session (including an attacker's) should be invalidated, not just the one making this request.
function deleteSessionsForUser(userId) {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

function setUserPassword(userId, passwordHash, passwordSalt) {
  db.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').run(passwordHash, passwordSalt, userId);
  return getUserById(userId);
}

// null clears the webhook (same "explicit null to disable" convention as setProjectBudget).
function setWebhookUrl(userId, url) {
  db.prepare('UPDATE users SET webhook_url = ? WHERE id = ?').run(url, userId);
  return getUserById(userId);
}

function getOrCreateProject(userId, name) {
  let row = db.prepare('SELECT * FROM projects WHERE user_id = ? AND name = ?').get(userId, name);
  if (!row) {
    db.prepare('INSERT INTO projects (user_id, name) VALUES (?, ?)').run(userId, name);
    row = db.prepare('SELECT * FROM projects WHERE user_id = ? AND name = ?').get(userId, name);
  }
  return row;
}

// Read-only counterpart to getOrCreateProject — for routes that need the project row (e.g. its
// budget_at_completion) but shouldn't silently create one if the name doesn't exist yet.
function getProjectByName(userId, name) {
  return db.prepare('SELECT * FROM projects WHERE user_id = ? AND name = ?').get(userId, name) || null;
}

// Null clears the budget (an owner can decide they don't want cost tracking after all, without a
// separate delete affordance) rather than only ever accepting a positive number.
function setProjectBudget(projectId, budgetAtCompletion) {
  db.prepare('UPDATE projects SET budget_at_completion = ? WHERE id = ?').run(budgetAtCompletion, projectId);
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
}

function setSnapshotActualCost(snapshotId, actualCostToDate) {
  db.prepare('UPDATE snapshots SET actual_cost_to_date = ? WHERE id = ?').run(actualCostToDate, snapshotId);
  return getSnapshotById(snapshotId);
}

// Archived projects are excluded by default everywhere this feeds into (Active Projects,
// Portfolio Overview, and the Leaderboard all call this) so archiving a project actually
// declutters those views rather than just adding a label nobody sees.
function listProjects(userId) {
  return db.prepare('SELECT * FROM projects WHERE user_id = ? AND archived_at IS NULL ORDER BY name').all(userId);
}

function listArchivedProjects(userId) {
  return db.prepare('SELECT * FROM projects WHERE user_id = ? AND archived_at IS NOT NULL ORDER BY archived_at DESC').all(userId);
}

function archiveProject(userId, name) {
  db.prepare("UPDATE projects SET archived_at = datetime('now') WHERE user_id = ? AND name = ?").run(userId, name);
  return getProjectByName(userId, name);
}

function unarchiveProject(userId, name) {
  db.prepare('UPDATE projects SET archived_at = NULL WHERE user_id = ? AND name = ?').run(userId, name);
  return getProjectByName(userId, name);
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
  // Each insertIssue.run() is its own auto-committed transaction unless wrapped — on a large
  // schedule (thousands of issues) that's thousands of individual disk-synced commits, which
  // dominated the total request time far more than any in-memory analysis cost. Wrapping the
  // whole loop in one transaction was the actual fix for the 8,000-activity benchmark.
  db.exec('BEGIN');
  try {
    for (const issue of result.issues) {
      insertIssue.run(snapshot.id, issue.name, issue.sub, issue.sev);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
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

function logError({ message, stack, method, path, userEmail }) {
  db.prepare('INSERT INTO error_log (message, stack, method, path, user_email) VALUES (?, ?, ?, ?, ?)')
    .run(String(message || 'Unknown error').slice(0, 2000), stack ? String(stack).slice(0, 8000) : null, method || null, path || null, userEmail || null);
}

function listErrorsForAdmin(limit) {
  return db.prepare('SELECT * FROM error_log ORDER BY created_at DESC LIMIT ?').all(limit || 100);
}

// Debugging history, not a permanent audit record like feedback — called once on boot alongside
// the other startup cleanup (deleteExpiredSessions) rather than kept indefinitely.
function pruneOldErrors() {
  db.prepare("DELETE FROM error_log WHERE created_at < datetime('now', '-30 days')").run();
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

function createBlogPost(slug, title, description, contentHtml, category, toc, headline) {
  db.prepare('INSERT INTO blog_posts (slug, title, description, content_html, category, toc_json, headline) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(slug, title, description, contentHtml, category || 'Fundamentals', toc ? JSON.stringify(toc) : null, headline || null);
  return getBlogPostBySlug(slug);
}

function updateBlogPost(slug, title, description, contentHtml, category, toc, headline) {
  db.prepare('UPDATE blog_posts SET title = ?, description = ?, content_html = ?, category = ?, toc_json = ?, headline = ? WHERE slug = ?')
    .run(title, description, contentHtml, category || 'Fundamentals', toc ? JSON.stringify(toc) : null, headline || null, slug);
  return getBlogPostBySlug(slug);
}

// --- Admin Command Center ---

// Search is optional — an empty/undefined query returns every account, newest first, capped so
// a large user base can't return an unbounded response to the console in one call.
function searchUsersForAdmin(query, limit) {
  const cap = limit || 200;
  if (query && query.trim()) {
    const like = '%' + query.trim().toLowerCase() + '%';
    return db.prepare('SELECT * FROM users WHERE lower(email) LIKE ? OR lower(plan_tier) LIKE ? ORDER BY id DESC LIMIT ?').all(like, like, cap);
  }
  return db.prepare('SELECT * FROM users ORDER BY id DESC LIMIT ?').all(cap);
}

function listFeatureFlags() {
  return db.prepare('SELECT * FROM feature_flags ORDER BY name').all();
}

function isFeatureEnabled(id) {
  const row = db.prepare('SELECT enabled FROM feature_flags WHERE id = ?').get(id);
  // Fail open (treat an unknown/never-seeded id as enabled) rather than silently breaking a
  // feature just because its flag row doesn't exist for some reason — kill switches should be an
  // explicit, deliberate OFF, never an accidental one from a missing row.
  return !row || !!row.enabled;
}

function setFeatureFlag(id, enabled) {
  const result = db.prepare('UPDATE feature_flags SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
  if (result.changes === 0) return null;
  return db.prepare('SELECT * FROM feature_flags WHERE id = ?').get(id);
}

function logAdvisoryClick(userId) {
  db.prepare('INSERT INTO advisory_clicks (user_id) VALUES (?)').run(userId);
}

// categories is the plain object the client sent (e.g. {analytics:true,marketing:false}) --
// stored as JSON so the exact shape of what was consented to is preserved verbatim for audit
// purposes, not normalized into columns that would need a migration every time a category is
// added or removed.
function recordConsent(consentId, userId, categories) {
  db.prepare('INSERT INTO consent_log (consent_id, user_id, categories) VALUES (?, ?, ?)')
    .run(consentId, userId || null, JSON.stringify(categories));
}

function getAdvisoryClickCount() {
  return db.prepare('SELECT COUNT(*) AS n FROM advisory_clicks').get().n;
}

function getAdminSetting(key) {
  const row = db.prepare('SELECT value FROM admin_settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setAdminSetting(key, value) {
  db.prepare('INSERT INTO admin_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value));
}

function listFeedbackForAdmin() {
  return db.prepare(`
    SELECT f.id, f.message, f.reviewed, f.created_at, u.email AS user_email
    FROM feedback f JOIN users u ON u.id = f.user_id
    ORDER BY f.created_at DESC
  `).all();
}

function setFeedbackReviewed(id, reviewed) {
  const result = db.prepare('UPDATE feedback SET reviewed = ? WHERE id = ?').run(reviewed ? 1 : 0, id);
  return result.changes > 0;
}

// Counts of paying accounts by tier — the caller (server.js, where pricing.js already lives)
// turns this into real dollar MRR using the actual price points; db.js stays pure data access.
function getUserCountsByTier() {
  const rows = db.prepare('SELECT plan_tier, COUNT(*) AS n FROM users WHERE team_owner_id IS NULL GROUP BY plan_tier').all();
  const counts = { free: 0, starter: 0, pro: 0, teams: 0 };
  rows.forEach(r => { if (r.plan_tier in counts) counts[r.plan_tier] = r.n; });
  return counts;
}

// File-format breakdown of analyses run in the last 30 days — source_filename's extension is the
// only signal available (no separate "format" column), same inference the frontend already uses.
function getFileIngestionStats() {
  const rows = db.prepare("SELECT source_filename FROM snapshots WHERE created_at >= datetime('now', '-30 days')").all();
  const stats = { total: rows.length, xer: 0, xml: 0, csv: 0, other: 0 };
  rows.forEach(r => {
    const name = (r.source_filename || '').toLowerCase();
    if (name.endsWith('.xer')) stats.xer++;
    else if (name.endsWith('.xml')) stats.xml++;
    else if (name.endsWith('.csv')) stats.csv++;
    else stats.other++;
  });
  return stats;
}

// Real Anthropic spend + token usage, all-time — straight from the same rows logAiUsage() already
// writes for every narrative/chat call, so this is exactly what's actually been billed, not an
// estimate.
function getAiSpendTotal() {
  const row = db.prepare('SELECT COALESCE(SUM(cost_usd), 0) AS costUsd, COALESCE(SUM(input_tokens + output_tokens), 0) AS tokens FROM ai_usage').get();
  return { costUsd: row.costUsd, tokens: row.tokens };
}

function logAdminAiUsage(userId, inputTokens, outputTokens, costUsd) {
  db.prepare('INSERT INTO admin_ai_usage (user_id, input_tokens, output_tokens, cost_usd) VALUES (?, ?, ?, ?)').run(userId, inputTokens, outputTokens, costUsd);
}

function getAdminAiUsageTotal() {
  const row = db.prepare('SELECT COALESCE(SUM(cost_usd), 0) AS costUsd, COALESCE(SUM(input_tokens + output_tokens), 0) AS tokens FROM admin_ai_usage').get();
  return { costUsd: row.costUsd, tokens: row.tokens };
}

module.exports = {
  db, getOrCreateProject, listProjects, listArchivedProjects, archiveProject, unarchiveProject, saveSnapshot,
  getHistory, getLatestSnapshot, getIssuesForSnapshot, updateIssueStatus, getPortfolio, getActivityFeed,
  getIssueOwnerUserId, createFeedback,
  logError, listErrorsForAdmin, pruneOldErrors,
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
  createPasswordResetToken, getPasswordResetToken, deletePasswordResetToken, deleteExpiredPasswordResetTokens,
  deleteSessionsForUser, setUserPassword, setWebhookUrl,
  listBlogPosts, getBlogPostBySlug, createBlogPost, updateBlogPost,
  searchUsersForAdmin, listFeatureFlags, isFeatureEnabled, setFeatureFlag,
  logAdvisoryClick, getAdvisoryClickCount, getAdminSetting, setAdminSetting, recordConsent,
  listFeedbackForAdmin, setFeedbackReviewed, getUserCountsByTier, getFileIngestionStats, getAiSpendTotal,
  logAdminAiUsage, getAdminAiUsageTotal,
  getProjectByName, setProjectBudget, setSnapshotActualCost
};
