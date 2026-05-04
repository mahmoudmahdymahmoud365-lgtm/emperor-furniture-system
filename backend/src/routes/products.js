const router = require("express").Router();
const pool = require("../db");

const toApi = r => ({
  id: r.id, name: r.name, category: r.category, defaultPrice: Number(r.default_price),
  unit: r.unit, stock: r.stock, minStock: r.min_stock, notes: r.notes,
  colors: Array.isArray(r.colors) ? r.colors : [],
  isAgency: !!r.is_agency,
  updatedAt: r.updated_at?.toISOString?.() || r.updated_at || null,
});

function mapError(e) {
  if (e?.code === "23505" && /idx_products_name_cat_unique/.test(e.detail || e.message || "")) {
    return { status: 400, error: "يوجد منتج آخر بنفس الاسم والفئة" };
  }
  return null;
}

router.get("/", async (_, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM products ORDER BY created_at DESC");
    res.json(rows.map(toApi));
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const d = req.body;
    const { rows } = await pool.query(
      `INSERT INTO products (id, name, category, default_price, unit, stock, min_stock, notes, colors, is_agency)
       VALUES ('P' || LPAD(nextval('products_seq')::TEXT, 3, '0'), $1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [d.name, d.category||'', d.defaultPrice||0, d.unit||'', d.stock||0, d.minStock||0, d.notes||'',
       JSON.stringify(d.colors||[]), !!d.isAgency]
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
    if (d.category !== undefined) { sets.push(`category=$${i++}`); vals.push(d.category); }
    if (d.defaultPrice !== undefined) { sets.push(`default_price=$${i++}`); vals.push(d.defaultPrice); }
    if (d.unit !== undefined) { sets.push(`unit=$${i++}`); vals.push(d.unit); }
    if (d.stock !== undefined) { sets.push(`stock=$${i++}`); vals.push(d.stock); }
    if (d.minStock !== undefined) { sets.push(`min_stock=$${i++}`); vals.push(d.minStock); }
    if (d.notes !== undefined) { sets.push(`notes=$${i++}`); vals.push(d.notes); }
    if (d.colors !== undefined) { sets.push(`colors=$${i++}`); vals.push(JSON.stringify(d.colors||[])); }
    if (d.isAgency !== undefined) { sets.push(`is_agency=$${i++}`); vals.push(!!d.isAgency); }
    if (sets.length === 0) return res.json({ ok: true });

    sets.push(`updated_at=NOW()`);
    vals.push(req.params.id);

    let query = `UPDATE products SET ${sets.join(",")} WHERE id=$${i}`;
    if (d._updatedAt) {
      vals.push(d._updatedAt);
      query += ` AND updated_at=$${i + 1}`;
    }
    query += " RETURNING *";

    const { rowCount, rows } = await pool.query(query, vals);
    if (rowCount === 0) {
      // Could be conflict OR record gone. Re-fetch to confirm
      const cur = await pool.query("SELECT * FROM products WHERE id=$1", [req.params.id]);
      if (cur.rowCount === 0) return res.status(404).json({ error: "المنتج غير موجود" });
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
    await pool.query("DELETE FROM products WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
