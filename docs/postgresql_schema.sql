-- ============================================================
-- Emperor Furniture ERP - PostgreSQL Schema
-- Compatible with PostgreSQL 14+
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- COMPANY SETTINGS
-- ============================================================
CREATE TABLE company_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL DEFAULT 'الامبراطور للأثاث',
  address TEXT DEFAULT '',
  phone VARCHAR(50) DEFAULT '',
  phones TEXT[] DEFAULT '{}',
  email VARCHAR(255) DEFAULT '',
  emails TEXT[] DEFAULT '{}',
  logo_url TEXT DEFAULT '/logo.png',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USER ACCOUNTS & ROLES
-- ============================================================
CREATE TYPE user_role AS ENUM ('admin', 'sales', 'accountant');

CREATE TABLE user_accounts (
  id VARCHAR(10) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL, -- Use bcrypt in production
  role user_role NOT NULL DEFAULT 'sales',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  custom_permissions JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE customers (
  id VARCHAR(10) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  national_id VARCHAR(20) DEFAULT '',
  phone VARCHAR(20) DEFAULT '',
  address TEXT DEFAULT '',
  governorate VARCHAR(100) DEFAULT '',
  job_title VARCHAR(100) DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_name ON customers(full_name);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_national_id ON customers(national_id);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE products (
  id VARCHAR(10) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) DEFAULT '',
  default_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  unit VARCHAR(50) DEFAULT 'قطعة',
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_category ON products(category);

-- ============================================================
-- BRANCHES
-- ============================================================
CREATE TABLE branches (
  id VARCHAR(10) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT DEFAULT '',
  rent NUMERIC(12, 2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EMPLOYEES
-- ============================================================
CREATE TABLE employees (
  id VARCHAR(10) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  national_id VARCHAR(20) DEFAULT '',
  phone VARCHAR(20) DEFAULT '',
  branch VARCHAR(100) DEFAULT '',
  monthly_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
  role VARCHAR(100) DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_employees_branch ON employees(branch);

-- ============================================================
-- INVOICES
-- ============================================================
CREATE TABLE invoices (
  id VARCHAR(15) PRIMARY KEY,
  customer VARCHAR(255) NOT NULL,
  branch VARCHAR(100) DEFAULT '',
  employee VARCHAR(255) DEFAULT '',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'مسودة',
  paid_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  commission_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  applied_offer_name VARCHAR(255) DEFAULT '',
  applied_discount NUMERIC(12, 2) DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_customer ON invoices(customer);
CREATE INDEX idx_invoices_date ON invoices(date);
CREATE INDEX idx_invoices_status ON invoices(status);

-- ============================================================
-- INVOICE ITEMS (Line items for each invoice)
-- ============================================================
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id VARCHAR(15) NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  line_discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);

-- ============================================================
-- RECEIPTS (Payments / Installments)
-- ============================================================
CREATE TABLE receipts (
  id VARCHAR(10) PRIMARY KEY,
  invoice_id VARCHAR(15) NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  customer VARCHAR(255) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  method VARCHAR(100) DEFAULT 'نقدي',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_receipts_invoice ON receipts(invoice_id);
CREATE INDEX idx_receipts_customer ON receipts(customer);

-- ============================================================
-- OFFERS & DISCOUNTS
-- ============================================================
CREATE TYPE offer_type AS ENUM ('percentage', 'fixed', 'timed');

CREATE TABLE offers (
  id VARCHAR(10) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type offer_type NOT NULL DEFAULT 'percentage',
  value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  product_id VARCHAR(10) DEFAULT '',
  product_name VARCHAR(255) DEFAULT '',
  start_date DATE,
  end_date DATE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STOCK MOVEMENTS
-- ============================================================
CREATE TYPE stock_movement_type AS ENUM ('in', 'out', 'return', 'adjustment');

CREATE TABLE stock_movements (
  id VARCHAR(10) PRIMARY KEY,
  product_id VARCHAR(10) DEFAULT '',
  product_name VARCHAR(255) NOT NULL,
  type stock_movement_type NOT NULL,
  qty INTEGER NOT NULL DEFAULT 0,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT DEFAULT '',
  related_id VARCHAR(15) DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_date ON stock_movements(date);

-- ============================================================
-- RETURNS
-- ============================================================
CREATE TABLE product_returns (
  id VARCHAR(10) PRIMARY KEY,
  invoice_id VARCHAR(15) NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  customer VARCHAR(255) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  reason TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE return_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_id VARCHAR(10) NOT NULL REFERENCES product_returns(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0
);

CREATE INDEX idx_return_items_return ON return_items(return_id);

-- ============================================================
-- SHIFTS
-- ============================================================
CREATE TABLE shifts (
  id VARCHAR(10) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  hours NUMERIC(4, 1) NOT NULL DEFAULT 8,
  branch VARCHAR(100) DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ATTENDANCE
-- ============================================================
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'leave', 'half-day');

CREATE TABLE attendance_records (
  id VARCHAR(10) PRIMARY KEY,
  employee_id VARCHAR(10) NOT NULL,
  employee_name VARCHAR(255) NOT NULL,
  shift_id VARCHAR(10) DEFAULT '',
  shift_name VARCHAR(255) DEFAULT '',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in TIME DEFAULT NULL,
  check_out TIME DEFAULT NULL,
  hours_worked NUMERIC(5, 2) DEFAULT 0,
  status attendance_status NOT NULL DEFAULT 'present',
  overtime_hours NUMERIC(5, 2) DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_attendance_employee ON attendance_records(employee_id);
CREATE INDEX idx_attendance_date ON attendance_records(date);

-- ============================================================
-- EXPENSES
-- ============================================================
CREATE TYPE expense_category AS ENUM (
  'electricity', 'water', 'food', 'drinks', 'rent',
  'salaries', 'maintenance', 'transport', 'supplies', 'other'
);

CREATE TABLE expenses (
  id VARCHAR(10) PRIMARY KEY,
  category expense_category NOT NULL DEFAULT 'other',
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  branch VARCHAR(100) DEFAULT '',
  paid_by VARCHAR(255) DEFAULT '',
  recurring BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TYPE audit_action AS ENUM ('create', 'update', 'delete');

CREATE TABLE audit_log (
  id VARCHAR(10) PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "user" VARCHAR(255) NOT NULL DEFAULT 'النظام',
  action audit_action NOT NULL,
  entity VARCHAR(50) NOT NULL,
  entity_id VARCHAR(50) NOT NULL,
  entity_name VARCHAR(255) NOT NULL,
  details TEXT DEFAULT ''
);

CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_log_entity ON audit_log(entity);

-- ============================================================
-- SECURITY LOG
-- ============================================================
CREATE TYPE security_event_type AS ENUM (
  'login_success', 'login_failed', 'logout', 'password_change', 'session_expired'
);

CREATE TABLE security_log (
  id VARCHAR(10) PRIMARY KEY,
  type security_event_type NOT NULL,
  email VARCHAR(255) NOT NULL,
  user_name VARCHAR(255) DEFAULT '',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip INET DEFAULT NULL,
  user_agent TEXT DEFAULT ''
);

CREATE INDEX idx_security_log_timestamp ON security_log(timestamp DESC);

-- ============================================================
-- SEED DATA
-- ============================================================
INSERT INTO company_settings (name) VALUES ('الامبراطور للأثاث');

INSERT INTO user_accounts (id, name, email, password_hash, role) VALUES
  ('U001', 'المدير', 'admin@emperor.com', 'admin123', 'admin'),
  ('U002', 'موظف مبيعات', 'sales@emperor.com', 'sales123', 'sales'),
  ('U003', 'المحاسب', 'accountant@emperor.com', 'acc123', 'accountant');

INSERT INTO branches (id, name, address, rent, active) VALUES
  ('B001', 'فرع القاهرة', 'شارع التحرير - القاهرة', 15000, TRUE),
  ('B002', 'فرع الجيزة', 'شارع الهرم - الجيزة', 12000, TRUE),
  ('B003', 'فرع الإسكندرية', 'كورنيش الإسكندرية', 10000, FALSE);

INSERT INTO customers (id, full_name, national_id, phone, address, governorate, job_title) VALUES
  ('C001', 'أحمد محمد علي', '29901011234567', '01012345678', 'شارع التحرير', 'القاهرة', 'مهندس'),
  ('C002', 'سارة أحمد حسن', '30001021234567', '01098765432', 'شارع الهرم', 'الجيزة', 'طبيبة'),
  ('C003', 'محمود حسن إبراهيم', '28501031234567', '01112345678', 'شارع النصر', 'الإسكندرية', 'تاجر');

INSERT INTO products (id, name, category, default_price, unit, stock, min_stock) VALUES
  ('P001', 'غرفة نوم كاملة', 'غرف نوم', 25000, 'قطعة', 10, 2),
  ('P002', 'طقم أنتريه مودرن', 'أنتريهات', 18000, 'قطعة', 8, 2),
  ('P003', 'مطبخ ألوميتال', 'مطابخ', 15000, 'متر', 50, 10),
  ('P004', 'غرفة سفرة ٨ كراسي', 'سفرة', 22000, 'قطعة', 5, 1),
  ('P005', 'دولاب ملابس', 'غرف نوم', 8000, 'قطعة', 15, 3);

INSERT INTO employees (id, name, national_id, phone, branch, monthly_salary, role) VALUES
  ('E001', 'محمد سعيد', '29001011234567', '01011111111', 'القاهرة', 5000, 'مبيعات'),
  ('E002', 'علي حسن', '29101021234567', '01022222222', 'الجيزة', 4500, 'مبيعات'),
  ('E003', 'نورا أحمد', '29201031234567', '01033333333', 'القاهرة', 6000, 'محاسب');

INSERT INTO shifts (id, name, start_time, end_time, hours, branch, active) VALUES
  ('SH001', 'صباحي', '08:00', '16:00', 8, 'القاهرة', TRUE),
  ('SH002', 'مسائي', '16:00', '00:00', 8, 'القاهرة', TRUE),
  ('SH003', 'مرن', '10:00', '18:00', 8, 'الجيزة', TRUE);
