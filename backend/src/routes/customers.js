const router = require("express").Router();
const pool = require("../db");

const toApi = r => ({
  id: r.id, fullName: r.full_name, nationalId: r.national_id, phone: r.phone,
  address: r.address, governorate: r.governorate, jobTitle: r.job_title, notes: r.notes,
  updatedAt: r.updated_at?.toISOString?.() || r.updated_at || null,
});

function mapError(e) {
  const detail = (e?.detail || e?.message || "");
  if (e?.code === "23505") {
    if (/idx_customers_phone_unique|customers.*phone/i.test(detail)) return { status: 400, error: "رقم الهاتف مسجل لعميل آخر بالفعل" };
    if (/idx_customers_nid_unique|national_id/i.test(detail)) return { status: 400, error: "الرقم القومي مسجل لعميل آخر بالفعل" };
  }
  return null;
}

router.get("/", async (_, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM customers ORDER BY created_at DESC");
    res.json(rows.map(toApi));
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const d = req.body;
    const { rows } = await pool.query(
      `INSERT INTO customers (id, full_name, national_id, phone, address, governorate, job_title, notes)
       VALUES ('C' || LPAD(nextval('customers_seq')::TEXT, 3, '0'), $1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [d.fullName, d.nationalId||'', d.phone||'', d.address||'', d.governorate||'', d.jobTitle||'', d.notes||'']
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
    if (d.fullName !== undefined) { sets.push(`full_name=$${i++}`); vals.push(d.fullName); }
    if (d.nationalId !== undefined) { sets.push(`national_id=$${i++}`); vals.push(d.nationalId); }
    if (d.phone !== undefined) { sets.push(`phone=$${i++}`); vals.push(d.phone); }
    if (d.address !== undefined) { sets.push(`address=$${i++}`); vals.push(d.address); }
    if (d.governorate !== undefined) { sets.push(`governorate=$${i++}`); vals.push(d.governorate); }
    if (d.jobTitle !== undefined) { sets.push(`job_title=$${i++}`); vals.push(d.jobTitle); }
    if (d.notes !== undefined) { sets.push(`notes=$${i++}`); vals.push(d.notes); }
    if (sets.length === 0) return res.json({ ok: true });

    sets.push(`updated_at=NOW()`);
    vals.push(req.params.id);

    let query = `UPDATE customers SET ${sets.join(",")} WHERE id=$${i}`;
    if (d._updatedAt) {
      vals.push(d._updatedAt);
      query += ` AND updated_at=$${i + 1}`;
    }
    query += " RETURNING *";

    const { rowCount, rows } = await pool.query(query, vals);
    if (rowCount === 0) {
      const cur = await pool.query("SELECT * FROM customers WHERE id=$1", [req.params.id]);
      if (cur.rowCount === 0) return res.status(404).json({ error: "العميل غير موجود" });
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
    await pool.query("DELETE FROM customers WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
