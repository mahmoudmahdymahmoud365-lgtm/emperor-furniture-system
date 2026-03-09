const router = require("express").Router();
const pool = require("../db");

const toApi = r => ({
  id: r.id, employeeId: r.employee_id, employeeName: r.employee_name,
  shiftId: r.shift_id, shiftName: r.shift_name, date: r.date,
  checkIn: r.check_in, checkOut: r.check_out, hoursWorked: Number(r.hours_worked),
  status: r.status, overtimeHours: Number(r.overtime_hours), notes: r.notes,
});

router.get("/", async (_, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM attendance ORDER BY created_at DESC");
    res.json(rows.map(toApi));
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const d = req.body;
    const { rows } = await pool.query(
      `INSERT INTO attendance (id, employee_id, employee_name, shift_id, shift_name, date, check_in, check_out, hours_worked, status, overtime_hours, notes)
       VALUES ('ATT' || LPAD(nextval('attendance_seq')::TEXT, 3, '0'), $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [d.employeeId||'', d.employeeName||'', d.shiftId||'', d.shiftName||'', d.date||'',
       d.checkIn||'', d.checkOut||'', d.hoursWorked||0, d.status||'present', d.overtimeHours||0, d.notes||'']
    );
    res.json(toApi(rows[0]));
  } catch (e) { next(e); }
});

router.put("/:id", async (req, res, next) => {
  try {
    const d = req.body;
    const sets = []; const vals = []; let i = 1;
    if (d.employeeId !== undefined) { sets.push(`employee_id=$${i++}`); vals.push(d.employeeId); }
    if (d.employeeName !== undefined) { sets.push(`employee_name=$${i++}`); vals.push(d.employeeName); }
    if (d.shiftId !== undefined) { sets.push(`shift_id=$${i++}`); vals.push(d.shiftId); }
    if (d.shiftName !== undefined) { sets.push(`shift_name=$${i++}`); vals.push(d.shiftName); }
    if (d.date !== undefined) { sets.push(`date=$${i++}`); vals.push(d.date); }
    if (d.checkIn !== undefined) { sets.push(`check_in=$${i++}`); vals.push(d.checkIn); }
    if (d.checkOut !== undefined) { sets.push(`check_out=$${i++}`); vals.push(d.checkOut); }
    if (d.hoursWorked !== undefined) { sets.push(`hours_worked=$${i++}`); vals.push(d.hoursWorked); }
    if (d.status !== undefined) { sets.push(`status=$${i++}`); vals.push(d.status); }
    if (d.overtimeHours !== undefined) { sets.push(`overtime_hours=$${i++}`); vals.push(d.overtimeHours); }
    if (d.notes !== undefined) { sets.push(`notes=$${i++}`); vals.push(d.notes); }
    if (sets.length === 0) return res.json({ ok: true });
    vals.push(req.params.id);
    await pool.query(`UPDATE attendance SET ${sets.join(",")} WHERE id=$${i}`, vals);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await pool.query("DELETE FROM attendance WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
