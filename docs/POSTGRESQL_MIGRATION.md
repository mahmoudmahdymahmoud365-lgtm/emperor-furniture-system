# دليل الترحيل إلى PostgreSQL

## نظرة عامة

هذا الدليل يشرح كيفية ربط تطبيق **الامبراطور للأثاث** بقاعدة بيانات PostgreSQL بدلاً من SQLite أو التخزين المحلي (localStorage).

---

## 1. إنشاء قاعدة البيانات (PostgreSQL Schema)

قم بتنفيذ السكريبت التالي في قاعدة PostgreSQL:

```sql
-- ==============================
-- Emperor Furniture - PostgreSQL Schema
-- ==============================

-- تفعيل UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================
-- CUSTOMERS (العملاء)
-- ==============================
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  national_id TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  governorate TEXT DEFAULT '',
  job_title TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================
-- PRODUCTS (المنتجات)
-- ==============================
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT '',
  default_price NUMERIC(12,2) DEFAULT 0,
  unit TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================
-- INVOICES (الفواتير)
-- ==============================
CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  customer TEXT NOT NULL,
  branch TEXT DEFAULT '',
  employee TEXT DEFAULT '',
  date TEXT DEFAULT '',
  delivery_date TEXT DEFAULT '',
  items JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'مسودة',
  paid_total NUMERIC(12,2) DEFAULT 0,
  commission_percent NUMERIC(5,2) DEFAULT 0,
  applied_offer_name TEXT DEFAULT '',
  applied_discount NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================
-- EMPLOYEES (الموظفين)
-- ==============================
CREATE TABLE employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  national_id TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  branch TEXT DEFAULT '',
  monthly_salary NUMERIC(12,2) DEFAULT 0,
  role TEXT DEFAULT '',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================
-- BRANCHES (الفروع)
-- ==============================
CREATE TABLE branches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT DEFAULT '',
  rent NUMERIC(12,2) DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================
-- RECEIPTS / INSTALLMENTS (الأقساط)
-- ==============================
CREATE TABLE receipts (
  id TEXT PRIMARY KEY,
  invoice_id TEXT DEFAULT '' REFERENCES invoices(id) ON DELETE SET DEFAULT,
  customer TEXT DEFAULT '',
  amount NUMERIC(12,2) DEFAULT 0,
  date TEXT DEFAULT '',
  method TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================
-- OFFERS (العروض والخصومات)
-- ==============================
CREATE TYPE offer_type AS ENUM ('percentage', 'fixed', 'timed');

CREATE TABLE offers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type offer_type NOT NULL DEFAULT 'percentage',
  value NUMERIC(12,2) DEFAULT 0,
  product_id TEXT DEFAULT '',
  product_name TEXT DEFAULT '',
  start_date TEXT DEFAULT '',
  end_date TEXT DEFAULT '',
  active BOOLEAN DEFAULT true,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================
-- SETTINGS (الإعدادات)
-- ==============================
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT DEFAULT ''
);

-- Default settings
INSERT INTO settings (key, value) VALUES
  ('name', 'الامبراطور للأثاث'),
  ('address', ''),
  ('phone', ''),
  ('email', ''),
  ('logoUrl', '/logo.png');

-- ==============================
-- USER ACCOUNTS (المستخدمين)
-- ==============================
CREATE TYPE user_role AS ENUM ('admin', 'sales', 'accountant');

CREATE TABLE user_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'sales',
  active BOOLEAN DEFAULT true,
  custom_permissions JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default users
INSERT INTO user_accounts (id, name, email, password, role) VALUES
  ('U001', 'المدير', 'admin@emperor.com', 'admin123', 'admin'),
  ('U002', 'موظف مبيعات', 'sales@emperor.com', 'sales123', 'sales'),
  ('U003', 'المحاسب', 'accountant@emperor.com', 'acc123', 'accountant');

-- ==============================
-- AUDIT LOG (سجل العمليات)
-- ==============================
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_name TEXT DEFAULT 'النظام',
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT DEFAULT '',
  entity_name TEXT DEFAULT '',
  details TEXT DEFAULT ''
);

-- ==============================
-- INDEXES
-- ==============================
CREATE INDEX idx_invoices_customer ON invoices(customer);
CREATE INDEX idx_invoices_date ON invoices(date);
CREATE INDEX idx_receipts_invoice ON receipts(invoice_id);
CREATE INDEX idx_receipts_customer ON receipts(customer);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_offers_active ON offers(active) WHERE active = true;
```

---

## 2. ملف الاتصال بـ PostgreSQL (Node.js Backend)

أنشئ ملف `server/database.js`:

```javascript
// ==============================
// PostgreSQL Database Connection
// Using 'pg' package
// ==============================
// npm install pg

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'emperor_furniture',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || '',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// ==============================
// CUSTOMERS
// ==============================
async function getCustomers() {
  const { rows } = await pool.query(
    'SELECT id, full_name AS "fullName", national_id AS "nationalId", phone, address, governorate, job_title AS "jobTitle", notes FROM customers ORDER BY created_at DESC'
  );
  return rows;
}

async function addCustomer(data) {
  const id = await nextId('C', 'customers');
  await pool.query(
    'INSERT INTO customers (id, full_name, national_id, phone, address, governorate, job_title, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [id, data.fullName, data.nationalId || '', data.phone || '', data.address || '', data.governorate || '', data.jobTitle || '', data.notes || '']
  );
  return { id, ...data };
}

async function updateCustomer(id, data) {
  const mapping = { fullName: 'full_name', nationalId: 'national_id', jobTitle: 'job_title' };
  const entries = Object.entries(data);
  const sets = entries.map(([k, _], i) => `${mapping[k] || k} = $${i + 1}`);
  const values = entries.map(([_, v]) => v);
  await pool.query(`UPDATE customers SET ${sets.join(', ')} WHERE id = $${values.length + 1}`, [...values, id]);
}

async function deleteCustomer(id) {
  await pool.query('DELETE FROM customers WHERE id = $1', [id]);
}

// ==============================
// PRODUCTS
// ==============================
async function getProducts() {
  const { rows } = await pool.query(
    'SELECT id, name, category, default_price AS "defaultPrice", unit, notes FROM products ORDER BY created_at DESC'
  );
  return rows;
}

async function addProduct(data) {
  const id = await nextId('P', 'products');
  await pool.query(
    'INSERT INTO products (id, name, category, default_price, unit, notes) VALUES ($1,$2,$3,$4,$5,$6)',
    [id, data.name, data.category || '', data.defaultPrice || 0, data.unit || '', data.notes || '']
  );
  return { id, ...data };
}

async function updateProduct(id, data) {
  const mapping = { defaultPrice: 'default_price' };
  const entries = Object.entries(data);
  const sets = entries.map(([k, _], i) => `${mapping[k] || k} = $${i + 1}`);
  const values = entries.map(([_, v]) => v);
  await pool.query(`UPDATE products SET ${sets.join(', ')} WHERE id = $${values.length + 1}`, [...values, id]);
}

async function deleteProduct(id) {
  await pool.query('DELETE FROM products WHERE id = $1', [id]);
}

// ==============================
// INVOICES
// ==============================
async function getInvoices() {
  const { rows } = await pool.query(
    `SELECT id, customer, branch, employee, date, delivery_date AS "deliveryDate",
     items, status, paid_total AS "paidTotal", commission_percent AS "commissionPercent",
     applied_offer_name AS "appliedOfferName", applied_discount AS "appliedDiscount"
     FROM invoices ORDER BY created_at DESC`
  );
  return rows.map(r => ({ ...r, paidTotal: Number(r.paidTotal), commissionPercent: Number(r.commissionPercent), appliedDiscount: Number(r.appliedDiscount || 0) }));
}

async function addInvoice(data) {
  const id = await nextId('INV-', 'invoices');
  await pool.query(
    `INSERT INTO invoices (id, customer, branch, employee, date, delivery_date, items, status, paid_total, commission_percent, applied_offer_name, applied_discount)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [id, data.customer, data.branch || '', data.employee || '', data.date || '', data.deliveryDate || '',
     JSON.stringify(data.items || []), data.status || 'مسودة', data.paidTotal || 0, data.commissionPercent || 0,
     data.appliedOfferName || '', data.appliedDiscount || 0]
  );
  return { id, ...data };
}

async function updateInvoice(id, data) {
  const mapping = { deliveryDate: 'delivery_date', paidTotal: 'paid_total', commissionPercent: 'commission_percent', appliedOfferName: 'applied_offer_name', appliedDiscount: 'applied_discount' };
  const d = { ...data };
  if (d.items) d.items = JSON.stringify(d.items);
  const entries = Object.entries(d);
  const sets = entries.map(([k, _], i) => `${mapping[k] || k} = $${i + 1}`);
  const values = entries.map(([_, v]) => v);
  await pool.query(`UPDATE invoices SET ${sets.join(', ')} WHERE id = $${values.length + 1}`, [...values, id]);
}

async function deleteInvoice(id) {
  await pool.query('DELETE FROM invoices WHERE id = $1', [id]);
}

// ==============================
// EMPLOYEES
// ==============================
async function getEmployees() {
  const { rows } = await pool.query(
    'SELECT id, name, national_id AS "nationalId", phone, branch, monthly_salary AS "monthlySalary", role, active FROM employees ORDER BY created_at DESC'
  );
  return rows.map(r => ({ ...r, monthlySalary: Number(r.monthlySalary) }));
}

async function addEmployee(data) {
  const id = await nextId('E', 'employees');
  await pool.query(
    'INSERT INTO employees (id, name, national_id, phone, branch, monthly_salary, role, active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [id, data.name, data.nationalId || '', data.phone || '', data.branch || '', data.monthlySalary || 0, data.role || '', data.active !== false]
  );
  return { id, ...data };
}

async function updateEmployee(id, data) {
  const mapping = { nationalId: 'national_id', monthlySalary: 'monthly_salary' };
  const entries = Object.entries(data);
  const sets = entries.map(([k, _], i) => `${mapping[k] || k} = $${i + 1}`);
  const values = entries.map(([_, v]) => v);
  await pool.query(`UPDATE employees SET ${sets.join(', ')} WHERE id = $${values.length + 1}`, [...values, id]);
}

async function deleteEmployee(id) {
  await pool.query('DELETE FROM employees WHERE id = $1', [id]);
}

// ==============================
// BRANCHES
// ==============================
async function getBranches() {
  const { rows } = await pool.query('SELECT id, name, address, rent, active FROM branches ORDER BY created_at DESC');
  return rows.map(r => ({ ...r, rent: Number(r.rent) }));
}

async function addBranch(data) {
  const id = await nextId('B', 'branches');
  await pool.query('INSERT INTO branches (id, name, address, rent, active) VALUES ($1,$2,$3,$4,$5)',
    [id, data.name, data.address || '', data.rent || 0, data.active !== false]);
  return { id, ...data };
}

async function updateBranch(id, data) {
  const entries = Object.entries(data);
  const sets = entries.map(([k, _], i) => `${k} = $${i + 1}`);
  const values = entries.map(([_, v]) => v);
  await pool.query(`UPDATE branches SET ${sets.join(', ')} WHERE id = $${values.length + 1}`, [...values, id]);
}

async function deleteBranch(id) {
  await pool.query('DELETE FROM branches WHERE id = $1', [id]);
}

// ==============================
// RECEIPTS
// ==============================
async function getReceipts() {
  const { rows } = await pool.query(
    'SELECT id, invoice_id AS "invoiceId", customer, amount, date, method, notes FROM receipts ORDER BY created_at DESC'
  );
  return rows.map(r => ({ ...r, amount: Number(r.amount) }));
}

async function addReceipt(data) {
  const id = await nextId('R', 'receipts');
  await pool.query(
    'INSERT INTO receipts (id, invoice_id, customer, amount, date, method, notes) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [id, data.invoiceId || '', data.customer || '', data.amount || 0, data.date || '', data.method || '', data.notes || '']
  );
  if (data.invoiceId) {
    await pool.query('UPDATE invoices SET paid_total = paid_total + $1 WHERE id = $2', [data.amount || 0, data.invoiceId]);
  }
  return { id, ...data };
}

async function updateReceipt(id, data) {
  const { rows } = await pool.query('SELECT * FROM receipts WHERE id = $1', [id]);
  const old = rows[0];
  if (!old) return;
  if (data.amount !== undefined && data.amount !== Number(old.amount)) {
    const diff = data.amount - Number(old.amount);
    await pool.query('UPDATE invoices SET paid_total = GREATEST(0, paid_total + $1) WHERE id = $2', [diff, old.invoice_id]);
  }
  const mapping = { invoiceId: 'invoice_id' };
  const entries = Object.entries(data);
  const sets = entries.map(([k, _], i) => `${mapping[k] || k} = $${i + 1}`);
  const values = entries.map(([_, v]) => v);
  await pool.query(`UPDATE receipts SET ${sets.join(', ')} WHERE id = $${values.length + 1}`, [...values, id]);
}

async function deleteReceipt(id) {
  const { rows } = await pool.query('SELECT * FROM receipts WHERE id = $1', [id]);
  const old = rows[0];
  if (old) {
    await pool.query('UPDATE invoices SET paid_total = GREATEST(0, paid_total - $1) WHERE id = $2', [Number(old.amount), old.invoice_id]);
  }
  await pool.query('DELETE FROM receipts WHERE id = $1', [id]);
}

// ==============================
// OFFERS
// ==============================
async function getOffers() {
  const { rows } = await pool.query(
    `SELECT id, name, type, value, product_id AS "productId", product_name AS "productName",
     start_date AS "startDate", end_date AS "endDate", active, notes FROM offers ORDER BY created_at DESC`
  );
  return rows.map(r => ({ ...r, value: Number(r.value) }));
}

async function addOffer(data) {
  const id = `OF${String(Date.now()).slice(-6)}`;
  await pool.query(
    `INSERT INTO offers (id, name, type, value, product_id, product_name, start_date, end_date, active, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, data.name, data.type, data.value || 0, data.productId || '', data.productName || '',
     data.startDate || '', data.endDate || '', data.active !== false, data.notes || '']
  );
  return { id, ...data };
}

async function updateOffer(id, data) {
  const mapping = { productId: 'product_id', productName: 'product_name', startDate: 'start_date', endDate: 'end_date' };
  const entries = Object.entries(data);
  const sets = entries.map(([k, _], i) => `${mapping[k] || k} = $${i + 1}`);
  const values = entries.map(([_, v]) => v);
  await pool.query(`UPDATE offers SET ${sets.join(', ')} WHERE id = $${values.length + 1}`, [...values, id]);
}

async function deleteOffer(id) {
  await pool.query('DELETE FROM offers WHERE id = $1', [id]);
}

// ==============================
// SETTINGS
// ==============================
async function getSettings() {
  const { rows } = await pool.query('SELECT key, value FROM settings');
  const obj = {};
  rows.forEach(r => obj[r.key] = r.value);
  return obj;
}

async function updateSettings(data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [key, value] of Object.entries(data)) {
      await client.query(
        'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
        [key, value]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ==============================
// USER ACCOUNTS
// ==============================
async function getUsers() {
  const { rows } = await pool.query(
    `SELECT id, name, email, password, role, active, custom_permissions AS "customPermissions" FROM user_accounts ORDER BY created_at`
  );
  return rows;
}

async function addUser(data) {
  const { rows } = await pool.query('SELECT COUNT(*) AS c FROM user_accounts');
  const id = `U${String(Number(rows[0].c) + 1).padStart(3, '0')}`;
  await pool.query(
    'INSERT INTO user_accounts (id, name, email, password, role, active, custom_permissions) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [id, data.name, data.email, data.password, data.role, data.active !== false, data.customPermissions ? JSON.stringify(data.customPermissions) : null]
  );
  return { id, ...data };
}

async function updateUser(id, data) {
  const mapping = { customPermissions: 'custom_permissions' };
  const d = { ...data };
  if (d.customPermissions) d.customPermissions = JSON.stringify(d.customPermissions);
  const entries = Object.entries(d);
  const sets = entries.map(([k, _], i) => `${mapping[k] || k} = $${i + 1}`);
  const values = entries.map(([_, v]) => v);
  await pool.query(`UPDATE user_accounts SET ${sets.join(', ')} WHERE id = $${values.length + 1}`, [...values, id]);
}

async function deleteUser(id) {
  await pool.query('DELETE FROM user_accounts WHERE id = $1', [id]);
}

// ==============================
// AUDIT LOG
// ==============================
async function getAuditLog() {
  const { rows } = await pool.query(
    `SELECT id, timestamp, user_name AS "user", action, entity, entity_id AS "entityId",
     entity_name AS "entityName", details FROM audit_log ORDER BY timestamp DESC LIMIT 1000`
  );
  return rows;
}

async function addAuditLog(action, entity, entityId, entityName, details, userName) {
  const id = `AL${Date.now()}`;
  await pool.query(
    'INSERT INTO audit_log (id, user_name, action, entity, entity_id, entity_name, details) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [id, userName || 'النظام', action, entity, entityId, entityName, details]
  );
}

async function clearAuditLog() {
  await pool.query('DELETE FROM audit_log');
}

// ==============================
// HELPER
// ==============================
async function nextId(prefix, table) {
  const { rows } = await pool.query(`SELECT COUNT(*) AS c FROM ${table}`);
  const num = Number(rows[0].c) + 1;
  return prefix.includes('INV')
    ? `INV-${String(num).padStart(3, '0')}`
    : `${prefix}${String(num).padStart(3, '0')}`;
}

module.exports = {
  pool,
  getCustomers, addCustomer, updateCustomer, deleteCustomer,
  getProducts, addProduct, updateProduct, deleteProduct,
  getInvoices, addInvoice, updateInvoice, deleteInvoice,
  getEmployees, addEmployee, updateEmployee, deleteEmployee,
  getBranches, addBranch, updateBranch, deleteBranch,
  getReceipts, addReceipt, updateReceipt, deleteReceipt,
  getOffers, addOffer, updateOffer, deleteOffer,
  getSettings, updateSettings,
  getUsers, addUser, updateUser, deleteUser,
  getAuditLog, addAuditLog, clearAuditLog,
};
```

---

## 3. خطوات الربط

### 3.1 تثبيت الحزم المطلوبة

```bash
npm install pg dotenv
```

### 3.2 إنشاء ملف `.env`

```env
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=emperor_furniture
PG_USER=postgres
PG_PASSWORD=your_password_here
```

### 3.3 إنشاء قاعدة البيانات

```bash
# إنشاء قاعدة البيانات
createdb emperor_furniture

# تنفيذ السكيما
psql -d emperor_furniture -f docs/postgresql_schema.sql
```

### 3.4 للاستخدام مع Electron

عدّل ملف `electron/main.js` ليستخدم `server/database.js` بدلاً من `electron/database.js`:

```javascript
// في electron/main.js
// استبدل:
// const db = require("./database");
// بـ:
const db = require("../server/database");
```

### 3.5 للاستخدام مع Express API (بدون Electron)

أنشئ ملف `server/api.js`:

```javascript
const express = require('express');
const cors = require('cors');
const db = require('./database');

const app = express();
app.use(cors());
app.use(express.json());

// Customers
app.get('/api/customers', async (_, res) => res.json(await db.getCustomers()));
app.post('/api/customers', async (req, res) => res.json(await db.addCustomer(req.body)));
app.put('/api/customers/:id', async (req, res) => { await db.updateCustomer(req.params.id, req.body); res.json({ ok: true }); });
app.delete('/api/customers/:id', async (req, res) => { await db.deleteCustomer(req.params.id); res.json({ ok: true }); });

// Products
app.get('/api/products', async (_, res) => res.json(await db.getProducts()));
app.post('/api/products', async (req, res) => res.json(await db.addProduct(req.body)));
app.put('/api/products/:id', async (req, res) => { await db.updateProduct(req.params.id, req.body); res.json({ ok: true }); });
app.delete('/api/products/:id', async (req, res) => { await db.deleteProduct(req.params.id); res.json({ ok: true }); });

// Invoices
app.get('/api/invoices', async (_, res) => res.json(await db.getInvoices()));
app.post('/api/invoices', async (req, res) => res.json(await db.addInvoice(req.body)));
app.put('/api/invoices/:id', async (req, res) => { await db.updateInvoice(req.params.id, req.body); res.json({ ok: true }); });
app.delete('/api/invoices/:id', async (req, res) => { await db.deleteInvoice(req.params.id); res.json({ ok: true }); });

// Employees
app.get('/api/employees', async (_, res) => res.json(await db.getEmployees()));
app.post('/api/employees', async (req, res) => res.json(await db.addEmployee(req.body)));
app.put('/api/employees/:id', async (req, res) => { await db.updateEmployee(req.params.id, req.body); res.json({ ok: true }); });
app.delete('/api/employees/:id', async (req, res) => { await db.deleteEmployee(req.params.id); res.json({ ok: true }); });

// Branches
app.get('/api/branches', async (_, res) => res.json(await db.getBranches()));
app.post('/api/branches', async (req, res) => res.json(await db.addBranch(req.body)));
app.put('/api/branches/:id', async (req, res) => { await db.updateBranch(req.params.id, req.body); res.json({ ok: true }); });
app.delete('/api/branches/:id', async (req, res) => { await db.deleteBranch(req.params.id); res.json({ ok: true }); });

// Receipts
app.get('/api/receipts', async (_, res) => res.json(await db.getReceipts()));
app.post('/api/receipts', async (req, res) => res.json(await db.addReceipt(req.body)));
app.put('/api/receipts/:id', async (req, res) => { await db.updateReceipt(req.params.id, req.body); res.json({ ok: true }); });
app.delete('/api/receipts/:id', async (req, res) => { await db.deleteReceipt(req.params.id); res.json({ ok: true }); });

// Offers
app.get('/api/offers', async (_, res) => res.json(await db.getOffers()));
app.post('/api/offers', async (req, res) => res.json(await db.addOffer(req.body)));
app.put('/api/offers/:id', async (req, res) => { await db.updateOffer(req.params.id, req.body); res.json({ ok: true }); });
app.delete('/api/offers/:id', async (req, res) => { await db.deleteOffer(req.params.id); res.json({ ok: true }); });

// Settings
app.get('/api/settings', async (_, res) => res.json(await db.getSettings()));
app.put('/api/settings', async (req, res) => { await db.updateSettings(req.body); res.json({ ok: true }); });

// Users
app.get('/api/users', async (_, res) => res.json(await db.getUsers()));
app.post('/api/users', async (req, res) => res.json(await db.addUser(req.body)));
app.put('/api/users/:id', async (req, res) => { await db.updateUser(req.params.id, req.body); res.json({ ok: true }); });
app.delete('/api/users/:id', async (req, res) => { await db.deleteUser(req.params.id); res.json({ ok: true }); });

// Audit Log
app.get('/api/audit-log', async (_, res) => res.json(await db.getAuditLog()));
app.delete('/api/audit-log', async (_, res) => { await db.clearAuditLog(); res.json({ ok: true }); });

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API server running on port ${PORT}`));
```

---

## 4. الفرق بين SQLite و PostgreSQL

| الميزة | SQLite | PostgreSQL |
|--------|--------|------------|
| النوع | ملف محلي | خادم مستقل |
| الأداء | ممتاز لمستخدم واحد | ممتاز لعدة مستخدمين |
| التزامن | محدود | دعم كامل |
| JSON | محدود | JSONB كامل |
| Boolean | INTEGER (0/1) | BOOLEAN أصلي |
| MAX/MIN | نفس الصيغة | GREATEST/LEAST |
| UPSERT | INSERT OR REPLACE | ON CONFLICT DO UPDATE |

---

## 5. ملاحظات هامة

1. **الأمان**: لا تخزن كلمات المرور كنص عادي في الإنتاج. استخدم `bcrypt` لتشفيرها.
2. **الاتصال**: استخدم Connection Pooling دائماً (مُفعّل في الملف).
3. **النسخ الاحتياطي**: استخدم `pg_dump` للنسخ الاحتياطي:
   ```bash
   pg_dump emperor_furniture > backup.sql
   ```
4. **الترحيل من SQLite**: صدّر البيانات من SQLite كـ JSON ثم أدخلها في PostgreSQL.
