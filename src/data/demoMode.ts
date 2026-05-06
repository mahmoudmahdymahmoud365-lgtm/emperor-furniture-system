// ==============================
// Demo Mode — Browser-only fallback when backend is unreachable
// Persists to localStorage. NOT used when real backend is online.
// All data shapes match the PostgreSQL schema 1:1 so switching is seamless.
// ==============================

const KEY = "emp_demo_mode_enabled";
const DATA_KEY = "emp_demo_db";

export function isDemoMode(): boolean {
  return localStorage.getItem(KEY) === "1";
}
export function enableDemoMode() { localStorage.setItem(KEY, "1"); }
export function disableDemoMode() { localStorage.removeItem(KEY); }

type DemoDB = {
  users: any[];
  customers: any[];
  products: any[];
  invoices: any[];
  receipts: any[];
  employees: any[];
  branches: any[];
  offers: any[];
  expenses: any[];
  attendance: any[];
  shifts: any[];
  stockMovements: any[];
  returns: any[];
  auditLog: any[];
  securityLog: any[];
  settings: any;
  sessionToken?: string;
  sessionUserId?: string;
};

const DEMO_USERS = [
  { id: "U001", name: "المدير", email: "admin@emperor.com", password: "admin123", role: "admin", active: true },
  { id: "U002", name: "موظف مبيعات", email: "sales@emperor.com", password: "sales123", role: "sales", active: true },
  { id: "U003", name: "محاسب", email: "accountant@emperor.com", password: "acc123", role: "accountant", active: true },
];

function defaultDB(): DemoDB {
  return {
    users: DEMO_USERS,
    customers: [],
    products: [],
    invoices: [],
    receipts: [],
    employees: [],
    branches: [{ id: "B001", name: "الفرع الرئيسي", address: "", phone: "", active: true }],
    offers: [],
    expenses: [],
    attendance: [],
    shifts: [],
    stockMovements: [],
    returns: [],
    auditLog: [],
    securityLog: [],
    settings: { name: "الامبراطور للأثاث (وضع تجريبي)", address: "", phone: "", phones: [], email: "" },
  };
}

function load(): DemoDB {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (raw) {
      const db = JSON.parse(raw);
      // Ensure default users always exist
      if (!db.users || db.users.length === 0) db.users = DEMO_USERS;
      return { ...defaultDB(), ...db };
    }
  } catch {}
  const db = defaultDB();
  save(db);
  return db;
}
function save(db: DemoDB) { localStorage.setItem(DATA_KEY, JSON.stringify(db)); }

function nextId(prefix: string, list: any[]): string {
  const max = list
    .map((x) => parseInt(String(x.id || "").replace(/\D/g, ""), 10))
    .filter((n) => !isNaN(n))
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

function genToken() {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

function ok(data: any) { return { ok: true, status: 200, json: async () => data }; }
function err(status: number, msg: string) {
  return { ok: false, status, statusText: msg, json: async () => ({ error: msg }) };
}

function nowIso() { return new Date().toISOString(); }

function listGet(name: keyof DemoDB) { return load()[name] || []; }

function crudPost(name: keyof DemoDB, prefix: string, body: any) {
  const db = load();
  const list = (db[name] as any[]) || [];
  const id = body.id || nextId(prefix, list);
  const row = { ...body, id, createdAt: body.createdAt || nowIso(), updatedAt: nowIso(), _updatedAt: nowIso() };
  (db[name] as any[]) = [row, ...list];
  save(db);
  return row;
}
function crudPut(name: keyof DemoDB, id: string, body: any) {
  const db = load();
  const list = (db[name] as any[]) || [];
  const idx = list.findIndex((x: any) => x.id === id);
  if (idx === -1) return null;
  const updated = { ...list[idx], ...body, id, updatedAt: nowIso(), _updatedAt: nowIso() };
  list[idx] = updated;
  (db[name] as any[]) = list;
  save(db);
  return updated;
}
function crudDelete(name: keyof DemoDB, id: string) {
  const db = load();
  const list = (db[name] as any[]) || [];
  (db[name] as any[]) = list.filter((x: any) => x.id !== id);
  save(db);
  return { ok: true };
}

// ==============================
// Router — match the same paths as the real backend
// ==============================
export async function demoFetch(method: string, path: string, body?: any): Promise<any> {
  // Strip /api prefix if present
  const p = path.replace(/^\/api/, "");
  const m = method.toUpperCase();

  // --- Health ---
  if (p === "/health" && m === "GET") return ok({ status: "ok", mode: "demo" });

  // --- Auth ---
  if (p === "/users/login" && m === "POST") {
    const db = load();
    const u = db.users.find((x: any) =>
      x.email.toLowerCase() === String(body.email || "").toLowerCase().trim() &&
      x.password === body.password && x.active !== false
    );
    if (!u) return err(401, "البريد الإلكتروني أو كلمة المرور غير صحيحة");
    const token = genToken();
    db.sessionToken = token;
    db.sessionUserId = u.id;
    save(db);
    return ok({ ...u, password: undefined, sessionToken: token, sessionExpiresIn: 8 * 60 * 60 * 1000 });
  }
  if (p === "/users/logout" && m === "POST") {
    const db = load(); db.sessionToken = undefined; db.sessionUserId = undefined; save(db);
    return ok({ ok: true });
  }
  if (p === "/users/session" && m === "GET") {
    const db = load();
    if (!db.sessionToken) return err(401, "SESSION_INVALID");
    const u = db.users.find((x: any) => x.id === db.sessionUserId);
    return ok({ valid: true, userId: u?.id, email: u?.email, role: u?.role });
  }
  if (p === "/users" && m === "GET") return ok(db_users_safe());
  if (p === "/users" && m === "POST") {
    const created = crudPost("users", "U", body);
    return ok({ ...created, password: undefined });
  }

  // --- Generic CRUD endpoints ---
  const map: Record<string, [keyof DemoDB, string]> = {
    customers: ["customers", "C"],
    products: ["products", "P"],
    invoices: ["invoices", "INV"],
    receipts: ["receipts", "R"],
    employees: ["employees", "E"],
    branches: ["branches", "B"],
    offers: ["offers", "OF"],
    expenses: ["expenses", "EX"],
    attendance: ["attendance", "AT"],
    shifts: ["shifts", "SH"],
    "stock-movements": ["stockMovements", "SM"],
    returns: ["returns", "RT"],
    "audit-log": ["auditLog", "AL"],
    "security-log": ["securityLog", "SE"],
  };
  for (const key of Object.keys(map)) {
    const [tbl, prefix] = map[key];
    if (p === `/${key}` && m === "GET") return ok(listGet(tbl));
    if (p === `/${key}` && m === "POST") return ok(crudPost(tbl, prefix, body || {}));
    if (p === `/${key}` && m === "DELETE") {
      const db = load(); (db[tbl] as any[]) = []; save(db); return ok({ ok: true });
    }
    const idMatch = new RegExp(`^/${key}/([^/]+)$`).exec(p);
    if (idMatch) {
      const id = idMatch[1];
      if (m === "PUT") {
        const u = crudPut(tbl, id, body || {});
        return u ? ok(u) : err(404, "Not found");
      }
      if (m === "DELETE") return ok(crudDelete(tbl, id));
      if (m === "GET") {
        const row = (load()[tbl] as any[]).find((x: any) => x.id === id);
        return row ? ok(row) : err(404, "Not found");
      }
    }
  }

  // --- Settings ---
  if (p === "/settings" && m === "GET") return ok(load().settings);
  if (p === "/settings" && m === "PUT") {
    const db = load(); db.settings = { ...db.settings, ...body }; save(db); return ok(db.settings);
  }

  // --- Backups (no-op in demo) ---
  if (p.startsWith("/backup")) return ok([]);
  if (p.startsWith("/cloud/onedrive")) return ok({ connected: false, mode: "demo" });
  if (p.startsWith("/files")) return ok([]);

  return err(404, `Demo endpoint not implemented: ${m} ${p}`);
}

function db_users_safe() {
  return load().users.map((u: any) => ({ ...u, password: undefined }));
}

export function resetDemoData() {
  localStorage.removeItem(DATA_KEY);
}
