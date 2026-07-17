// rate-limit.js — simple in-memory, fixed-window rate limiter, keyed by a bucket name + IP.
// No external dependency (Redis, etc.) needed: this app runs as a single Railway instance, so an
// in-process Map is sufficient — same zero-dependency reasoning as the rest of this app (see
// auth.js's header comment). Would need to move to a shared store only if this ever runs as more
// than one instance, since each instance would otherwise track its own separate counts.
const buckets = new Map(); // "name:ip" -> { count, windowStart, windowMs }

// Swept periodically so a long-running process doesn't accumulate entries forever for IPs that
// stopped making requests — this is process-lifetime state, not per-request state, so it needs
// its own cleanup rather than relying on natural turnover the way per-request objects do.
const SWEEP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (now - entry.windowStart > entry.windowMs) buckets.delete(key);
  }
}, SWEEP_INTERVAL_MS).unref(); // unref so this timer alone never keeps the process alive

// Returns { allowed, retryAfterSeconds }. `name` scopes the limit to a specific purpose (e.g.
// 'login', 'signup') so exhausting one bucket doesn't consume budget from an unrelated one.
function checkRateLimit(name, ip, maxRequests, windowMs) {
  const key = `${name}:${ip}`;
  const now = Date.now();
  let entry = buckets.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    entry = { count: 0, windowStart: now, windowMs };
    buckets.set(key, entry);
  }
  entry.count++;
  if (entry.count > maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.windowStart + windowMs - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }
  return { allowed: true };
}

// Railway (like most PaaS) sits behind a proxy — the real client IP is the first entry in
// X-Forwarded-For, not req.socket.remoteAddress (which would be the proxy's own address).
function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

module.exports = { checkRateLimit, clientIp };
