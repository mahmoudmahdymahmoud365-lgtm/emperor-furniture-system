// ==============================
// SQLite Database Logic (better-sqlite3)
// CommonJS format — runs in Electron main process
// ==============================

const Database = require("better-sqlite3");
const path = require("path");
const { app } = require("electron");

let db;

function getDbPath() {
  const userDataPath = app.getPath("userData");
  return path.join(userDataPath, "emperor-furniture.db");
}

function initialize() {
  db = new Database(getDbPath());
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      fullName TEXT NOT NULL,
      nationalId TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      governorate TEXT DEFAULT '',
      jobTitle TEXT DEFAULT '',
      notes TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT DEFAULT '',
      defaultPrice REAL DEFAULT 0,
      unit TEXT DEFAULT '',
      notes TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      customer TEXT NOT NULL,
      branch TEXT DEFAULT '',
      employee TEXT DEFAULT '',
      date TEXT DEFAULT '',
      deliveryDate TEXT DEFAULT '',
      items TEXT DEFAULT '[]',
      status TEXT DEFAULT 'مسودة',
      paidTotal REAL DEFAULT 0,
      commissionPercent REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      branch TEXT DEFAULT '',
      monthlySalary REAL DEFAULT 0,
      role TEXT DEFAULT '',
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS branches (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT DEFAULT '',
      rent REAL DEFAULT 0,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      invoiceId TEXT DEFAULT '',
      customer TEXT DEFAULT '',
      amount REAL DEFAULT 0,
      date TEXT DEFAULT '',
      method TEXT DEFAULT '',
      notes TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT DEFAULT ''
    );
  `);

  // Seed default settings if empty
  const count = db.prepare("SELECT COUNT(*) as c FROM settings").get();
  if (count.c === 0) {
    const insert = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
    insert.run("name", "الامبراطور للأثاث");
    insert.run("address", "");
    insert.run("phone", "");
    insert.run("email", "");
    insert.run("logoUrl", "/logo.png");
  }
}

// ==============================
// Helper: auto-increment ID
// ==============================
function nextId(prefix, table) {
  const row = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get();
  const num = row.c + 1;
  return prefix.includes("INV")
    ? `INV-${String(num).padStart(3, "0")}`
    : `${prefix}${String(num).padStart(3, "0")}`;
}

// ==============================
// CUSTOMERS
// ==============================
function getCustomers() {
  return db.prepare("SELECT * FROM customers").all();
}

function addCustomer(data) {
  const id = nextId("C", "customers");
  db.prepare(`INSERT INTO customers (id, fullName, nationalId, phone, address, governorate, jobTitle, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.fullName, data.nationalId || "", data.phone || "", data.address || "", data.governorate || "", data.jobTitle || "", data.notes || "");
  return { id, ...data };
}

function updateCustomer(id, data) {
  const fields = Object.keys(data).map((k) => `${k} = ?`).join(", ");
  const values = Object.values(data);
  db.prepare(`UPDATE customers SET ${fields} WHERE id = ?`).run(...values, id);
}

function deleteCustomer(id) {
  db.prepare("DELETE FROM customers WHERE id = ?").run(id);
}

// ==============================
// PRODUCTS
// ==============================
function getProducts() {
  return db.prepare("SELECT * FROM products").all();
}

function addProduct(data) {
  const id = nextId("P", "products");
  db.prepare(`INSERT INTO products (id, name, category, defaultPrice, unit, notes)
    VALUES (?, ?, ?, ?, ?, ?)`).run(id, data.name, data.category || "", data.defaultPrice || 0, data.unit || "", data.notes || "");
  return { id, ...data };
}

function updateProduct(id, data) {
  const fields = Object.keys(data).map((k) => `${k} = ?`).join(", ");
  const values = Object.values(data);
  db.prepare(`UPDATE products SET ${fields} WHERE id = ?`).run(...values, id);
}

function deleteProduct(id) {
  db.prepare("DELETE FROM products WHERE id = ?").run(id);
}

// ==============================
// INVOICES (items stored as JSON string)
// ==============================
function getInvoices() {
  const rows = db.prepare("SELECT * FROM invoices").all();
  return rows.map((r) => ({ ...r, items: JSON.parse(r.items || "[]") }));
}

function addInvoice(data) {
  const id = nextId("INV-", "invoices");
  db.prepare(`INSERT INTO invoices (id, customer, branch, employee, date, deliveryDate, items, status, paidTotal, commissionPercent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, data.customer, data.branch || "", data.employee || "", data.date || "", data.deliveryDate || "", JSON.stringify(data.items || []), data.status || "مسودة", data.paidTotal || 0, data.commissionPercent || 0);
  return { id, ...data };
}

function updateInvoice(id, data) {
  const d = { ...data };
  if (d.items) d.items = JSON.stringify(d.items);
  const fields = Object.keys(d).map((k) => `${k} = ?`).join(", ");
  const values = Object.values(d);
  db.prepare(`UPDATE invoices SET ${fields} WHERE id = ?`).run(...values, id);
}

function deleteInvoice(id) {
  db.prepare("DELETE FROM invoices WHERE id = ?").run(id);
}

// ==============================
// EMPLOYEES
// ==============================
function getEmployees() {
  const rows = db.prepare("SELECT * FROM employees").all();
  return rows.map((r) => ({ ...r, active: Boolean(r.active) }));
}

function addEmployee(data) {
  const id = nextId("E", "employees");
  db.prepare(`INSERT INTO employees (id, name, phone, branch, monthlySalary, role, active)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, data.name, data.phone || "", data.branch || "", data.monthlySalary || 0, data.role || "", data.active ? 1 : 0);
  return { id, ...data };
}

function updateEmployee(id, data) {
  const d = { ...data };
  if ("active" in d) d.active = d.active ? 1 : 0;
  const fields = Object.keys(d).map((k) => `${k} = ?`).join(", ");
  const values = Object.values(d);
  db.prepare(`UPDATE employees SET ${fields} WHERE id = ?`).run(...values, id);
}

function deleteEmployee(id) {
  db.prepare("DELETE FROM employees WHERE id = ?").run(id);
}

// ==============================
// BRANCHES
// ==============================
function getBranches() {
  const rows = db.prepare("SELECT * FROM branches").all();
  return rows.map((r) => ({ ...r, active: Boolean(r.active) }));
}

function addBranch(data) {
  const id = nextId("B", "branches");
  db.prepare(`INSERT INTO branches (id, name, address, rent, active)
    VALUES (?, ?, ?, ?, ?)`).run(id, data.name, data.address || "", data.rent || 0, data.active ? 1 : 0);
  return { id, ...data };
}

function updateBranch(id, data) {
  const d = { ...data };
  if ("active" in d) d.active = d.active ? 1 : 0;
  const fields = Object.keys(d).map((k) => `${k} = ?`).join(", ");
  const values = Object.values(d);
  db.prepare(`UPDATE branches SET ${fields} WHERE id = ?`).run(...values, id);
}

function deleteBranch(id) {
  db.prepare("DELETE FROM branches WHERE id = ?").run(id);
}

// ==============================
// RECEIPTS
// ==============================
function getReceipts() {
  return db.prepare("SELECT * FROM receipts").all();
}

function addReceipt(data) {
  const id = nextId("R", "receipts");
  db.prepare(`INSERT INTO receipts (id, invoiceId, customer, amount, date, method, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, data.invoiceId || "", data.customer || "", data.amount || 0, data.date || "", data.method || "", data.notes || "");
  // Update invoice paidTotal
  if (data.invoiceId) {
    db.prepare("UPDATE invoices SET paidTotal = paidTotal + ? WHERE id = ?").run(data.amount || 0, data.invoiceId);
  }
  return { id, ...data };
}

function updateReceipt(id, data) {
  const old = db.prepare("SELECT * FROM receipts WHERE id = ?").get(id);
  if (!old) return;
  if (data.amount !== undefined && data.amount !== old.amount) {
    const diff = data.amount - old.amount;
    db.prepare("UPDATE invoices SET paidTotal = MAX(0, paidTotal + ?) WHERE id = ?").run(diff, old.invoiceId);
  }
  const fields = Object.keys(data).map((k) => `${k} = ?`).join(", ");
  const values = Object.values(data);
  db.prepare(`UPDATE receipts SET ${fields} WHERE id = ?`).run(...values, id);
}

function deleteReceipt(id) {
  const old = db.prepare("SELECT * FROM receipts WHERE id = ?").get(id);
  if (old) {
    db.prepare("UPDATE invoices SET paidTotal = MAX(0, paidTotal - ?) WHERE id = ?").run(old.amount, old.invoiceId);
  }
  db.prepare("DELETE FROM receipts WHERE id = ?").run(id);
}

// ==============================
// SETTINGS
// ==============================
function getSettings() {
  const rows = db.prepare("SELECT * FROM settings").all();
  const obj = {};
  rows.forEach((r) => (obj[r.key] = r.value));
  return obj;
}

function updateSettings(data) {
  const upsert = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
  const tx = db.transaction((entries) => {
    for (const [key, value] of entries) upsert.run(key, value);
  });
  tx(Object.entries(data));
}

module.exports = {
  initialize,
  getCustomers, addCustomer, updateCustomer, deleteCustomer,
  getProducts, addProduct, updateProduct, deleteProduct,
  getInvoices, addInvoice, updateInvoice, deleteInvoice,
  getEmployees, addEmployee, updateEmployee, deleteEmployee,
  getBranches, addBranch, updateBranch, deleteBranch,
  getReceipts, addReceipt, updateReceipt, deleteReceipt,
  getSettings, updateSettings,
};
