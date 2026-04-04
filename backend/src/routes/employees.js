const router = require("express").Router();
const pool = require("../db");

const toApi = r => ({
  id: r.id, name: r.name, nationalId: r.national_id, phone: r.phone,
  branch: r.branch, monthlySalary: Number(r.monthly_salary), role: r.role, active: r.active,
  email: r.email || "",
});

router.get("/", async (_, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM employees ORDER BY created_at DESC");
    res.json(rows.map(toApi));
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const d = req.body;
    const { rows } = await pool.query(
      `INSERT INTO employees (id, name, national_id, phone, branch, monthly_salary, role, active)
       VALUES ('E' || LPAD(nextval('employees_seq')::TEXT, 3, '0'), $1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [d.name, d.nationalId||'', d.phone||'', d.branch||'', d.monthlySalary||0, d.role||'', d.active!==false]
    );
    res.json(toApi(rows[0]));
  } catch (e) { next(e); }
});

router.put("/:id", async (req, res, next) => {
  try {
    const d = req.body;
    const sets = []; const vals = []; let i = 1;
    if (d.name !== undefined) { sets.push(`name=$${i++}`); vals.push(d.name); }
    if (d.nationalId !== undefined) { sets.push(`national_id=$${i++}`); vals.push(d.nationalId); }
    if (d.phone !== undefined) { sets.push(`phone=$${i++}`); vals.push(d.phone); }
    if (d.branch !== undefined) { sets.push(`branch=$${i++}`); vals.push(d.branch); }
    if (d.monthlySalary !== undefined) { sets.push(`monthly_salary=$${i++}`); vals.push(d.monthlySalary); }
    if (d.role !== undefined) { sets.push(`role=$${i++}`); vals.push(d.role); }
    if (d.active !== undefined) { sets.push(`active=$${i++}`); vals.push(d.active); }
    if (sets.length === 0) return res.json({ ok: true });
    vals.push(req.params.id);
    await pool.query(`UPDATE employees SET ${sets.join(",")} WHERE id=$${i}`, vals);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await pool.query("DELETE FROM employees WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
