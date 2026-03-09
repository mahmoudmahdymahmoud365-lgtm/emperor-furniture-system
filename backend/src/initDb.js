// ==============================
// Database Initialization Script
// Run: node src/initDb.js
// ==============================
const pool = require("./db");

const schema = `
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  -- Customers
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY DEFAULT 'C' || LPAD(nextval('customers_seq')::TEXT, 3, '0'),
    full_name TEXT NOT NULL,
    national_id TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    governorate TEXT DEFAULT '',
    job_title TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE SEQUENCE IF NOT EXISTS customers_seq START 1;

  -- Products
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY DEFAULT 'P' || LPAD(nextval('products_seq')::TEXT, 3, '0'),
    name TEXT NOT NULL,
    category TEXT DEFAULT '',
    default_price NUMERIC(12,2) DEFAULT 0,
    unit TEXT DEFAULT '',
    stock INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE SEQUENCE IF NOT EXISTS products_seq START 1;

  -- Invoices
  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY DEFAULT 'INV-' || LPAD(nextval('invoices_seq')::TEXT, 3, '0'),
    customer TEXT NOT NULL,
    branch TEXT DEFAULT '',
    employee TEXT DEFAULT '',
    date TEXT DEFAULT '',
    delivery_date TEXT DEFAULT '',
    items JSONB DEFAULT '[]',
    status TEXT DEFAULT 'مسودة',
    paid_total NUMERIC(12,2) DEFAULT 0,
    commission_percent NUMERIC(5,2) DEFAULT 0,
    applied_offer_name TEXT DEFAULT '',
    applied_discount NUMERIC(12,2) DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE SEQUENCE IF NOT EXISTS invoices_seq START 1;

  -- Employees
  CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY DEFAULT 'E' || LPAD(nextval('employees_seq')::TEXT, 3, '0'),
    name TEXT NOT NULL,
    national_id TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    branch TEXT DEFAULT '',
    monthly_salary NUMERIC(12,2) DEFAULT 0,
    role TEXT DEFAULT '',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE SEQUENCE IF NOT EXISTS employees_seq START 1;

  -- Branches
  CREATE TABLE IF NOT EXISTS branches (
    id TEXT PRIMARY KEY DEFAULT 'B' || LPAD(nextval('branches_seq')::TEXT, 3, '0'),
    name TEXT NOT NULL,
    address TEXT DEFAULT '',
    rent NUMERIC(12,2) DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE SEQUENCE IF NOT EXISTS branches_seq START 1;

  -- Receipts (Installments)
  CREATE TABLE IF NOT EXISTS receipts (
    id TEXT PRIMARY KEY DEFAULT 'R' || LPAD(nextval('receipts_seq')::TEXT, 3, '0'),
    invoice_id TEXT DEFAULT '',
    customer TEXT DEFAULT '',
    amount NUMERIC(12,2) DEFAULT 0,
    date TEXT DEFAULT '',
    method TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE SEQUENCE IF NOT EXISTS receipts_seq START 1;

  -- Offers
  CREATE TABLE IF NOT EXISTS offers (
    id TEXT PRIMARY KEY DEFAULT 'OF' || LPAD(nextval('offers_seq')::TEXT, 3, '0'),
    name TEXT NOT NULL,
    type TEXT DEFAULT 'percentage',
    value NUMERIC(12,2) DEFAULT 0,
    product_id TEXT DEFAULT '',
    product_name TEXT DEFAULT '',
    start_date TEXT DEFAULT '',
    end_date TEXT DEFAULT '',
    active BOOLEAN DEFAULT true,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE SEQUENCE IF NOT EXISTS offers_seq START 1;

  -- Stock Movements
  CREATE TABLE IF NOT EXISTS stock_movements (
    id TEXT PRIMARY KEY,
    product_id TEXT DEFAULT '',
    product_name TEXT DEFAULT '',
    type TEXT DEFAULT 'in',
    qty INTEGER DEFAULT 0,
    date TEXT DEFAULT '',
    reason TEXT DEFAULT '',
    related_id TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Product Returns
  CREATE TABLE IF NOT EXISTS product_returns (
    id TEXT PRIMARY KEY DEFAULT 'RET' || LPAD(nextval('returns_seq')::TEXT, 3, '0'),
    invoice_id TEXT DEFAULT '',
    customer TEXT DEFAULT '',
    date TEXT DEFAULT '',
    items JSONB DEFAULT '[]',
    total_amount NUMERIC(12,2) DEFAULT 0,
    reason TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE SEQUENCE IF NOT EXISTS returns_seq START 1;

  -- Shifts
  CREATE TABLE IF NOT EXISTS shifts (
    id TEXT PRIMARY KEY DEFAULT 'SH' || LPAD(nextval('shifts_seq')::TEXT, 3, '0'),
    name TEXT NOT NULL,
    start_time TEXT DEFAULT '',
    end_time TEXT DEFAULT '',
    hours NUMERIC(5,2) DEFAULT 0,
    branch TEXT DEFAULT '',
    active BOOLEAN DEFAULT true,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE SEQUENCE IF NOT EXISTS shifts_seq START 1;

  -- Attendance
  CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY DEFAULT 'ATT' || LPAD(nextval('attendance_seq')::TEXT, 3, '0'),
    employee_id TEXT DEFAULT '',
    employee_name TEXT DEFAULT '',
    shift_id TEXT DEFAULT '',
    shift_name TEXT DEFAULT '',
    date TEXT DEFAULT '',
    check_in TEXT DEFAULT '',
    check_out TEXT DEFAULT '',
    hours_worked NUMERIC(5,2) DEFAULT 0,
    status TEXT DEFAULT 'present',
    overtime_hours NUMERIC(5,2) DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE SEQUENCE IF NOT EXISTS attendance_seq START 1;

  -- Expenses
  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY DEFAULT 'EXP' || LPAD(nextval('expenses_seq')::TEXT, 3, '0'),
    category TEXT DEFAULT 'other',
    description TEXT DEFAULT '',
    amount NUMERIC(12,2) DEFAULT 0,
    date TEXT DEFAULT '',
    branch TEXT DEFAULT '',
    paid_by TEXT DEFAULT '',
    recurring BOOLEAN DEFAULT false,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE SEQUENCE IF NOT EXISTS expenses_seq START 1;

  -- User Accounts
  CREATE TABLE IF NOT EXISTS user_accounts (
    id TEXT PRIMARY KEY DEFAULT 'U' || LPAD(nextval('users_seq')::TEXT, 3, '0'),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'sales',
    active BOOLEAN DEFAULT true,
    custom_permissions JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE SEQUENCE IF NOT EXISTS users_seq START 1;

  -- Audit Log
  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    "user" TEXT DEFAULT '',
    action TEXT DEFAULT '',
    entity TEXT DEFAULT '',
    entity_id TEXT DEFAULT '',
    entity_name TEXT DEFAULT '',
    details TEXT DEFAULT ''
  );

  -- Security Log
  CREATE TABLE IF NOT EXISTS security_log (
    id TEXT PRIMARY KEY,
    type TEXT DEFAULT '',
    email TEXT DEFAULT '',
    user_name TEXT DEFAULT '',
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    ip TEXT DEFAULT '',
    user_agent TEXT DEFAULT ''
  );

  -- Company Settings (key-value)
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT DEFAULT ''
  );

  -- Files / Images
  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    name TEXT DEFAULT '',
    related_to TEXT DEFAULT '',
    related_id TEXT DEFAULT '',
    file_name TEXT DEFAULT '',
    stored_name TEXT DEFAULT '',
    mime_type TEXT DEFAULT '',
    size BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE SEQUENCE IF NOT EXISTS files_seq START 1;

  -- Seed default settings
  INSERT INTO settings (key, value) VALUES
    ('name', 'الامبراطور للأثاث'),
    ('address', ''),
    ('phone', ''),
    ('phones', '[]'),
    ('email', ''),
    ('emails', '[]'),
    ('logoUrl', '/logo.png')
  ON CONFLICT (key) DO NOTHING;

  -- Seed default admin user
  INSERT INTO user_accounts (id, name, email, password, role, active) VALUES
    ('U001', 'المدير', 'admin@emperor.com', 'admin123', 'admin', true),
    ('U002', 'موظف مبيعات', 'sales@emperor.com', 'sales123', 'sales', true),
    ('U003', 'المحاسب', 'accountant@emperor.com', 'acc123', 'accountant', true)
  ON CONFLICT (id) DO NOTHING;
`;

async function init() {
  try {
    // Create sequences first (they can't use IF NOT EXISTS in all PG versions)
    const sequences = [
      "customers_seq", "products_seq", "invoices_seq", "employees_seq",
      "branches_seq", "receipts_seq", "offers_seq", "returns_seq",
      "shifts_seq", "attendance_seq", "expenses_seq", "users_seq", "files_seq"
    ];
    for (const seq of sequences) {
      await pool.query(`CREATE SEQUENCE IF NOT EXISTS ${seq} START 1`).catch(() => {});
    }
    await pool.query(schema);
    console.log("✅ Database initialized successfully");
  } catch (err) {
    console.error("❌ Database initialization failed:", err.message);
  } finally {
    await pool.end();
  }
}

init();
