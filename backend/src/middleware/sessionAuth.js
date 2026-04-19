// ==============================
// Server-side Session Validation Middleware
// Validates session tokens on every API request
// ==============================

const crypto = require("crypto");
const pool = require("../db");

// In-memory session store (production: use Redis)
const sessions = new Map();

const SESSION_MAX_AGE = 8 * 60 * 60 * 1000; // 8 hours absolute
const SESSION_IDLE_TIMEOUT = 30 * 60 * 1000; // 30 min inactivity

/**
 * Create a new session for a user after successful login
 */
function createSession(userId, userEmail, role) {
  const token = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  sessions.set(token, {
    userId,
    email: userEmail,
    role,
    createdAt: now,
    lastActivity: now,
    expiresAt: now + SESSION_MAX_AGE,
  });
  // Cleanup old sessions periodically
  cleanupSessions();
  return token;
}

/**
 * Validate session token — checks expiry and idle timeout
 */
function validateSession(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;

  const now = Date.now();
  // Absolute expiry
  if (now > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  // Idle timeout
  if (now - session.lastActivity > SESSION_IDLE_TIMEOUT) {
    sessions.delete(token);
    return null;
  }
  // Touch last activity
  session.lastActivity = now;
  return session;
}

/**
 * Destroy a session (logout)
 */
function destroySession(token) {
  sessions.delete(token);
}

/**
 * Cleanup expired sessions
 */
function cleanupSessions() {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (now > session.expiresAt || now - session.lastActivity > SESSION_IDLE_TIMEOUT) {
      sessions.delete(token);
    }
  }
}

// Auto-cleanup every 5 minutes
const cleanupTimer = setInterval(cleanupSessions, 5 * 60 * 1000);
if (cleanupTimer.unref) cleanupTimer.unref();

/**
 * Middleware: require valid session for protected routes
 * Reads token from Authorization header: "Bearer <token>"
 */
function requireSession(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "جلسة غير صالحة. يرجى تسجيل الدخول مرة أخرى.", code: "SESSION_INVALID" });
  }
  const token = authHeader.slice(7);
  const session = validateSession(token);
  if (!session) {
    return res.status(401).json({ error: "انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى.", code: "SESSION_EXPIRED" });
  }
  req.session = session;
  req.sessionToken = token;
  next();
}

/**
 * Optional session middleware — attaches session if present but doesn't block
 */
function optionalSession(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const session = validateSession(token);
    if (session) {
      req.session = session;
      req.sessionToken = token;
    }
  }
  next();
}

module.exports = { createSession, validateSession, destroySession, requireSession, optionalSession };
