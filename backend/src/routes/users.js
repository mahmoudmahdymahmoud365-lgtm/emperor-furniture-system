// ==============================
// Users Route — API-first auth with bcrypt + rate limiting
// ==============================
const router = require("express").Router();
const pool = require("../db");
const bcrypt = require("bcryptjs");
const { createRateLimiter } = require("../middleware/rateLimiter");

const BCRYPT_ROUNDS = 12;

// Rate limit login: 5 attempts per 5 minutes per IP+email
const loginLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: "تم تجاوز عدد المحاولات المسموح. حاول مرة أخرى بعد 5 دقائق.",
});

const toApi = r => ({
  id: r.id, name: r.name, email: r.email, role: r.role,
  active: r.active, customPermissions: r.custom_permissions || undefined,
  // NEVER return password to client
});

// ==============================
// Password hashing — bcrypt (industry standard)
// ==============================
async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function verifyPassword(plainPassword, storedHash) {
  // Legacy: plain-text or old SHA-256 format (salt:hash)
  if (!storedHash.startsWith("$2")) {
    // Legacy plain-text check
    if (!storedHash.includes(":") || storedHash.length < 40) {
      return plainPassword === storedHash;
    }
    // Legacy SHA-256 check (salt:hash format)
    const crypto = require("crypto");
    const [salt] = storedHash.split(":");
    const computed = crypto.createHash("sha256").update(salt + plainPassword).digest("hex");
    return `${salt}:${computed}` === storedHash;
  }
  // bcrypt verification
  return bcrypt.compare(plainPassword, storedHash);
}

// ==============================
// GET /users — List all users (no passwords)
// ==============================
router.get("/", async (_, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM user_accounts ORDER BY created_at DESC");
    res.json(rows.map(toApi));
  } catch (e) { next(e); }
});

// ==============================
// POST /users/login — Authenticate against PostgreSQL (rate limited)
// ==============================
router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const { rows } = await pool.query(
      "SELECT * FROM user_accounts WHERE LOWER(email)=LOWER($1) AND active=true",
      [email.trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
    }

    const user = rows[0];
    const passwordValid = await verifyPassword(password, user.password);

    if (!passwordValid) {
      return res.status(401).json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
    }

    // Auto-migrate legacy passwords (plain-text or SHA-256) to bcrypt
    if (!user.password.startsWith("$2")) {
      const hashed = await hashPassword(password);
      await pool.query("UPDATE user_accounts SET password=$1 WHERE id=$2", [hashed, user.id]);
    }

    res.json(toApi(user));
  } catch (e) { next(e); }
});

// ==============================
// POST /users — Create user (bcrypt hash password)
// ==============================
router.post("/", async (req, res, next) => {
  try {
    const d = req.body;
    const hashedPassword = await hashPassword(d.password);
    const { rows } = await pool.query(
      `INSERT INTO user_accounts (id, name, email, password, role, active, custom_permissions)
       VALUES ('U' || LPAD(nextval('users_seq')::TEXT, 3, '0'), $1,$2,$3,$4,$5,$6) RETURNING *`,
      [d.name, d.email, hashedPassword, d.role || 'sales', d.active !== false, d.customPermissions ? JSON.stringify(d.customPermissions) : null]
    );
    res.json(toApi(rows[0]));
  } catch (e) { next(e); }
});

// ==============================
// PUT /users/:id — Update user (bcrypt hash password if changed)
// ==============================
router.put("/:id", async (req, res, next) => {
  try {
    const d = req.body;
    const sets = []; const vals = []; let i = 1;
    if (d.name !== undefined) { sets.push(`name=$${i++}`); vals.push(d.name); }
    if (d.email !== undefined) { sets.push(`email=$${i++}`); vals.push(d.email); }
    if (d.password !== undefined) {
      // Hash new password if it's not already bcrypt-hashed
      let pw = d.password;
      if (!pw.startsWith("$2")) {
        pw = await hashPassword(pw);
      }
      sets.push(`password=$${i++}`); vals.push(pw);
    }
    if (d.role !== undefined) { sets.push(`role=$${i++}`); vals.push(d.role); }
    if (d.active !== undefined) { sets.push(`active=$${i++}`); vals.push(d.active); }
    if (d.customPermissions !== undefined) { sets.push(`custom_permissions=$${i++}`); vals.push(JSON.stringify(d.customPermissions)); }
    if (sets.length === 0) return res.json({ ok: true });
    vals.push(req.params.id);
    await pool.query(`UPDATE user_accounts SET ${sets.join(",")} WHERE id=$${i}`, vals);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ==============================
// DELETE /users/:id
// ==============================
router.delete("/:id", async (req, res, next) => {
  try {
    await pool.query("DELETE FROM user_accounts WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
