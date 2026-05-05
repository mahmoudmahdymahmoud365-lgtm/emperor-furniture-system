// ==============================
// Database Adapter — PostgreSQL (production) ↔ pg-mem (in-memory dev/test)
// ==============================
// Toggle via env: DB_DRIVER=pgmem to use in-memory PostgreSQL emulator.
// The exported `pool` exposes the SAME `pg.Pool` API in both modes,
// so route code requires no changes.
// ==============================
require("dotenv").config();

const DRIVER = (process.env.DB_DRIVER || "").toLowerCase();
const HAS_DB_URL = !!process.env.DATABASE_URL;
// Default: if DATABASE_URL is missing AND driver not forced, use pgmem (safe local dev).
const usePgMem = DRIVER === "pgmem" || (!HAS_DB_URL && DRIVER !== "pg");

let pool;

if (usePgMem) {
  console.log("[DB] Using in-memory PostgreSQL (pg-mem) — schema is identical to production");
  const { newDb, DataType } = require("pg-mem");
  const crypto = require("crypto");

  const mem = newDb({ autoCreateForeignKeyIndices: true });

  // ---- Polyfills required by our migrations ----
  // lpad(text, int, text)
  mem.public.registerFunction({
    name: "lpad",
    args: [DataType.text, DataType.integer, DataType.text],
    returns: DataType.text,
    implementation: (s, len, pad) => {
      s = String(s ?? ""); pad = String(pad ?? " ");
      if (s.length >= len) return s.slice(0, len);
      while (s.length < len) s = pad + s;
      return s.slice(-len);
    },
  });
  // gen_random_uuid()
  mem.public.registerFunction({
    name: "gen_random_uuid",
    returns: DataType.uuid,
    implementation: () => crypto.randomUUID(),
  });
  // pg_advisory_lock / unlock — no-ops (single-process)
  mem.public.registerFunction({ name: "pg_advisory_lock", args: [DataType.bigint], returns: DataType.bool, implementation: () => true });
  mem.public.registerFunction({ name: "pg_advisory_unlock", args: [DataType.bigint], returns: DataType.bool, implementation: () => true });

  // CREATE EXTENSION is unsupported — silently ignore
  const adapter = mem.adapters.createPg();
  const { Pool: MemPool } = adapter;
  const realPool = new MemPool();

  // Wrap query() to strip CREATE EXTENSION (pg-mem doesn't recognise it)
  const origQuery = realPool.query.bind(realPool);
  realPool.query = (text, params) => {
    if (typeof text === "string" && /CREATE\s+EXTENSION/i.test(text)) {
      text = text.replace(/CREATE\s+EXTENSION[^;]*;/gi, "");
      if (!text.trim()) return Promise.resolve({ rows: [], rowCount: 0 });
    }
    return origQuery(text, params);
  };
  realPool.on = realPool.on || (() => {});
  realPool.end = realPool.end || (async () => {});
  pool = realPool;
} else {
  console.log("[DB] Using PostgreSQL connection pool");
  const { Pool } = require("pg");
  pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/emperor_furniture",
  });
  pool.on("error", (err) => console.error("Unexpected PostgreSQL error:", err));
}

module.exports = pool;
