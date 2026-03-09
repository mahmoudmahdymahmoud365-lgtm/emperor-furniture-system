const router = require("express").Router();
const pool = require("../db");

const toApi = r => ({
  id: r.id, productId: r.product_id, productName: r.product_name, type: r.type,
  qty: r.qty, date: r.date, reason: r.reason, relatedId: r.related_id,
});

router.get("/", async (_, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM stock_movements ORDER BY created_at DESC");
    res.json(rows.map(toApi));
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const d = req.body;
    const id = `SM${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    await pool.query(
      `INSERT INTO stock_movements (id, product_id, product_name, type, qty, date, reason, related_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, d.productId||'', d.productName||'', d.type||'in', d.qty||0, d.date||new Date().toISOString(), d.reason||'', d.relatedId||'']
    );
    // Update product stock
    if (d.productId) {
      if (d.type === 'in' || d.type === 'return') {
        await pool.query("UPDATE products SET stock = stock + $1 WHERE id = $2", [d.qty, d.productId]);
      } else {
        await pool.query("UPDATE products SET stock = GREATEST(0, stock - $1) WHERE id = $2", [d.qty, d.productId]);
      }
    }
    res.json({ id, ...d });
  } catch (e) { next(e); }
});

module.exports = router;
