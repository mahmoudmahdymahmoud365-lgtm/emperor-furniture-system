const router = require("express").Router();
const pool = require("../db");

const toApi = r => ({
  id: r.id, name: r.name, nationalId: r.national_id, phone: r.phone,
  branch: r.branch, monthlySalary: Number(r.monthly_salary), role: r.role, active: r.active,
  email: r.email || "",
  updatedAt: r.updated_at?.toISOString?.() || r.updated_at || null,
});

function mapError(e) {
  const detail = (e?.detail || e?.message || "");
  if (e?.code === "23505") {
    if (/idx_employees_email_unique/i.test(detail)) return { status: 400, error: "هذا البريد الإلكتروني مسجل لموظف آخر بالفعل" };
    if (/idx_employees_nid_unique|national_id/i.test(detail)) return { status: 400, error: "الرقم القومي مسجل لموظف آخر بالفعل" };
  }
  return null;
}

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
      `INSERT INTO employees (id, name, national_id, phone, branch, monthly_salary, role, active, email)
       VALUES ('E' || LPAD(nextval('employees_seq')::TEXT, 3, '0'), $1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [d.name, d.nationalId||'', d.phone||'', d.branch||'', d.monthlySalary||0, d.role||'', d.active!==false, d.email||'']
    );
    res.json(toApi(rows[0]));
  } catch (e) {
    const m = mapError(e); if (m) return res.status(m.status).json({ error: m.error });
    next(e);
  }
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
    if (d.email !== undefined) { sets.push(`email=$${i++}`); vals.push(d.email); }
    if (sets.length === 0) return res.json({ ok: true });

    sets.push(`updated_at=NOW()`);
    vals.push(req.params.id);

    let query = `UPDATE employees SET ${sets.join(",")} WHERE id=$${i}`;
    if (d._updatedAt) {
      vals.push(d._updatedAt);
      query += ` AND updated_at=$${i + 1}`;
    }
    query += " RETURNING *";

    const { rowCount, rows } = await pool.query(query, vals);
    if (rowCount === 0) {
      const cur = await pool.query("SELECT * FROM employees WHERE id=$1", [req.params.id]);
      if (cur.rowCount === 0) return res.status(404).json({ error: "الموظف غير موجود" });
      return res.status(409).json({ error: "CONFLICT", message: "تم تعديل هذا السجل من جهاز آخر.", current: toApi(cur.rows[0]) });
    }
    res.json(toApi(rows[0]));
  } catch (e) {
    const m = mapError(e); if (m) return res.status(m.status).json({ error: m.error });
    next(e);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await pool.query("DELETE FROM employees WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
