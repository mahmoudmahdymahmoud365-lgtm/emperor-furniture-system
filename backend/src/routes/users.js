const router = require("express").Router();
const pool = require("../db");

const toApi = r => ({
  id: r.id, name: r.name, email: r.email, password: r.password, role: r.role,
  active: r.active, customPermissions: r.custom_permissions || undefined,
});

router.get("/", async (_, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM user_accounts ORDER BY created_at DESC");
    res.json(rows.map(toApi));
  } catch (e) { next(e); }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { rows } = await pool.query(
      "SELECT * FROM user_accounts WHERE email=$1 AND password=$2 AND active=true", [email, password]
    );
    if (rows.length === 0) return res.status(401).json({ error: "Invalid credentials" });
    res.json(toApi(rows[0]));
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const d = req.body;
    const { rows } = await pool.query(
      `INSERT INTO user_accounts (id, name, email, password, role, active, custom_permissions)
       VALUES ('U' || LPAD(nextval('users_seq')::TEXT, 3, '0'), $1,$2,$3,$4,$5,$6) RETURNING *`,
      [d.name, d.email, d.password, d.role||'sales', d.active!==false, d.customPermissions ? JSON.stringify(d.customPermissions) : null]
    );
    res.json(toApi(rows[0]));
  } catch (e) { next(e); }
});

router.put("/:id", async (req, res, next) => {
  try {
    const d = req.body;
    const sets = []; const vals = []; let i = 1;
    if (d.name !== undefined) { sets.push(`name=$${i++}`); vals.push(d.name); }
    if (d.email !== undefined) { sets.push(`email=$${i++}`); vals.push(d.email); }
    if (d.password !== undefined) { sets.push(`password=$${i++}`); vals.push(d.password); }
    if (d.role !== undefined) { sets.push(`role=$${i++}`); vals.push(d.role); }
    if (d.active !== undefined) { sets.push(`active=$${i++}`); vals.push(d.active); }
    if (d.customPermissions !== undefined) { sets.push(`custom_permissions=$${i++}`); vals.push(JSON.stringify(d.customPermissions)); }
    if (sets.length === 0) return res.json({ ok: true });
    vals.push(req.params.id);
    await pool.query(`UPDATE user_accounts SET ${sets.join(",")} WHERE id=$${i}`, vals);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await pool.query("DELETE FROM user_accounts WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
