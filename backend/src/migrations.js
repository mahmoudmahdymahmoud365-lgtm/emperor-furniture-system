// ==============================
// Database Migration System — Schema Versioning
// ==============================
const pool = require("./db");

/**
 * Each migration has a unique version number and an up() SQL string.
 * Migrations run in order. Already-applied migrations are skipped.
 */
const MIGRATIONS = [
  {
    version: 1,
    description: "Initial schema — baseline",
    up: `
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      CREATE SEQUENCE IF NOT EXISTS customers_seq START 1;
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

      CREATE SEQUENCE IF NOT EXISTS products_seq START 1;
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

      CREATE SEQUENCE IF NOT EXISTS invoices_seq START 1;
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

      CREATE SEQUENCE IF NOT EXISTS employees_seq START 1;
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

      CREATE SEQUENCE IF NOT EXISTS branches_seq START 1;
      CREATE TABLE IF NOT EXISTS branches (
        id TEXT PRIMARY KEY DEFAULT 'B' || LPAD(nextval('branches_seq')::TEXT, 3, '0'),
        name TEXT NOT NULL,
        address TEXT DEFAULT '',
        rent NUMERIC(12,2) DEFAULT 0,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE SEQUENCE IF NOT EXISTS receipts_seq START 1;
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

      CREATE SEQUENCE IF NOT EXISTS offers_seq START 1;
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

      CREATE SEQUENCE IF NOT EXISTS returns_seq START 1;
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

      CREATE SEQUENCE IF NOT EXISTS shifts_seq START 1;
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

      CREATE SEQUENCE IF NOT EXISTS attendance_seq START 1;
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

      CREATE SEQUENCE IF NOT EXISTS expenses_seq START 1;
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

      CREATE SEQUENCE IF NOT EXISTS users_seq START 1;
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

      CREATE TABLE IF NOT EXISTS security_log (
        id TEXT PRIMARY KEY,
        type TEXT DEFAULT '',
        email TEXT DEFAULT '',
        user_name TEXT DEFAULT '',
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        ip TEXT DEFAULT '',
        user_agent TEXT DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT DEFAULT ''
      );

      CREATE SEQUENCE IF NOT EXISTS files_seq START 1;
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

      INSERT INTO settings (key, value) VALUES
        ('name', 'الامبراطور للأثاث'),
        ('address', ''),
        ('phone', ''),
        ('phones', '[]'),
        ('email', ''),
        ('emails', '[]'),
        ('logoUrl', '/logo.png')
      ON CONFLICT (key) DO NOTHING;

      INSERT INTO user_accounts (id, name, email, password, role, active) VALUES
        ('U001', 'المدير', 'admin@emperor.com', 'admin123', 'admin', true),
        ('U002', 'موظف مبيعات', 'sales@emperor.com', 'sales123', 'sales', true),
        ('U003', 'المحاسب', 'accountant@emperor.com', 'acc123', 'accountant', true)
      ON CONFLICT (id) DO NOTHING;
    `,
  },
  {
    version: 2,
    description: "Add email column to employees for auto-attendance",
    up: `ALTER TABLE employees ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';`,
  },
  {
    version: 3,
    description: "Add updated_at column for optimistic locking",
    up: `
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE branches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE receipts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE offers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `,
  },
  {
    version: 4,
    description: "Add unique partial index on employee email, auto-backup trigger function",
    up: `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_email_unique
        ON employees (LOWER(email)) WHERE email IS NOT NULL AND email != '';
    `,
  },
  {
    version: 5,
    description: "Cloud tokens table for OneDrive (encrypted refresh_token) + backup config defaults",
    up: `
      CREATE TABLE IF NOT EXISTS cloud_tokens (
        provider TEXT PRIMARY KEY,
        access_token TEXT NOT NULL,
        refresh_token_enc TEXT NOT NULL,
        expires_at TIMESTAMPTZ,
        account_email TEXT,
        account_name TEXT,
        last_sync_at TIMESTAMPTZ,
        last_sync_status TEXT,
        last_sync_error TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      INSERT INTO settings (key, value) VALUES
        ('backup_local_path', ''),
        ('backup_auto_enabled', 'true'),
        ('backup_interval_hours', '24'),
        ('backup_onedrive_upload', 'false')
      ON CONFLICT (key) DO NOTHING;
    `,
  },
  {
    version: 6,
    description: "Product colors, agency flag, unique constraints, notes on receipts",
    up: `
      -- Product colors as JSON array on product
      ALTER TABLE products ADD COLUMN IF NOT EXISTS colors JSONB DEFAULT '[]';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS is_agency BOOLEAN DEFAULT false;

      -- Receipts: notes already exist; ensure updated_at for editability
      ALTER TABLE receipts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

      -- UNIQUE constraints (partial, ignoring empty strings)
      CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone_unique
        ON customers (phone) WHERE phone IS NOT NULL AND phone != '';
      CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_nid_unique
        ON customers (national_id) WHERE national_id IS NOT NULL AND national_id != '';
      CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_nid_unique
        ON employees (national_id) WHERE national_id IS NOT NULL AND national_id != '';
      CREATE UNIQUE INDEX IF NOT EXISTS idx_products_name_cat_unique
        ON products (LOWER(name), LOWER(COALESCE(category, '')));
    `,
  },
];

/**
 * Run all pending migrations in order.
 * Safe to call on every server start.
 */
async function runMigrations(logger) {
  const log = logger || ((level, msg) => console.log(`[MIGRATION:${level}] ${msg}`));

  // 1. Create migrations tracking table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      description TEXT DEFAULT '',
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // 2. Get already applied versions
  const { rows } = await pool.query("SELECT version FROM _migrations ORDER BY version");
  const applied = new Set(rows.map(r => r.version));

  // 3. Run pending migrations in order
  const pending = MIGRATIONS.filter(m => !applied.has(m.version)).sort((a, b) => a.version - b.version);

  if (pending.length === 0) {
    log("info", `Schema up to date (version ${MIGRATIONS.length})`);
    return;
  }

  for (const migration of pending) {
    log("info", `Running migration v${migration.version}: ${migration.description}`);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(migration.up);
      await client.query(
        "INSERT INTO _migrations (version, description) VALUES ($1, $2)",
        [migration.version, migration.description]
      );
      await client.query("COMMIT");
      log("info", `Migration v${migration.version} applied successfully`);
    } catch (err) {
      await client.query("ROLLBACK");
      log("error", `Migration v${migration.version} FAILED: ${err.message}`);
      throw err; // Stop on failure — do not skip broken migrations
    } finally {
      client.release();
    }
  }

  log("info", `All migrations complete. Schema at version ${MIGRATIONS[MIGRATIONS.length - 1].version}`);
}

module.exports = runMigrations;
