// ==============================
// In-memory Rate Limiter — no external dependencies
// ==============================

/**
 * Creates a rate limiter middleware.
 * @param {Object} opts
 * @param {number} opts.windowMs  - Time window in ms (default 5 min)
 * @param {number} opts.max       - Max attempts per window (default 5)
 * @param {string} opts.message   - Error message
 * @param {function} opts.keyFn   - Extract key from req (default: IP + body.email)
 */
function createRateLimiter(opts = {}) {
  const windowMs = opts.windowMs || 5 * 60 * 1000; // 5 minutes
  const max = opts.max || 5;
  const message = opts.message || "تم تجاوز عدد المحاولات المسموح. حاول مرة أخرى لاحقاً.";
  const keyFn = opts.keyFn || ((req) => {
    const ip = req.ip || req.connection?.remoteAddress || "unknown";
    const email = (req.body?.email || "").toLowerCase().trim();
    return `${ip}:${email}`;
  });

  // Store: key -> { count, resetAt }
  const store = new Map();

  // Cleanup expired entries every minute
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key);
    }
  }, 60_000);

  // Prevent timer from keeping process alive
  if (cleanupInterval.unref) cleanupInterval.unref();

  function middleware(req, res, next) {
    const key = keyFn(req);
    const now = Date.now();

    let entry = store.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    // Add rate limit headers
    const remaining = Math.max(0, max - entry.count);
    res.set("X-RateLimit-Limit", String(max));
    res.set("X-RateLimit-Remaining", String(remaining));
    res.set("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({
        error: message,
        retryAfter,
      });
    }

    next();
  }

  middleware.reset = (key) => store.delete(key);
  middleware.resetAll = () => store.clear();

  return middleware;
}

module.exports = { createRateLimiter };
