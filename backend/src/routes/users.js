// ==============================
// Users Route — API-first auth with password hashing support
// ==============================
const router = require("express").Router();
const pool = require("../db");
const crypto = require("crypto");

const toApi = r => ({
  id: r.id, name: r.name, email: r.email, role: r.role,
  active: r.active, customPermissions: r.custom_permissions || undefined,
  // NEVER return password to client
});

// ==============================
// Password hashing (mirrors client-side SHA-256 + salt)
// ==============================
async function hashPassword(password, salt) {
  const usedSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.createHash("sha256").update(usedSalt + password).digest("hex");
  return `${usedSalt}:${hash}`;
}

async function verifyPassword(plainPassword, storedHash) {
  // Legacy plain-text support (migration)
  if (!storedHash.includes(":") || storedHash.length < 40) {
    return plainPassword === storedHash;
  }
  const [salt] = storedHash.split(":");
  const computed = await hashPassword(plainPassword, salt);
  return computed === storedHash;
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
// POST /users/login — Authenticate against PostgreSQL
// ==============================
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    // Fetch user by email only (password verified in JS, not SQL)
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

    // Auto-migrate plain-text passwords to hashed
    if (!user.password.includes(":") || user.password.length < 40) {
      const hashed = await hashPassword(password);
      await pool.query("UPDATE user_accounts SET password=$1 WHERE id=$2", [hashed, user.id]);
    }

    res.json(toApi(user));
  } catch (e) { next(e); }
});

// ==============================
// POST /users — Create user (hash password)
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
// PUT /users/:id — Update user (hash password if changed)
// ==============================
router.put("/:id", async (req, res, next) => {
  try {
    const d = req.body;
    const sets = []; const vals = []; let i = 1;
    if (d.name !== undefined) { sets.push(`name=$${i++}`); vals.push(d.name); }
    if (d.email !== undefined) { sets.push(`email=$${i++}`); vals.push(d.email); }
    if (d.password !== undefined) {
      // Hash new password if it's not already hashed
      let pw = d.password;
      if (!pw.includes(":") || pw.length < 40) {
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
