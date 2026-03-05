// ==============================
// In-Memory Data Store
// Replace this file with SQLite calls when wrapping with Electron.
// All functions are synchronous now; make them async when switching to SQLite.
// ==============================

import type {
  Customer, Product, Invoice, Employee, Branch, Receipt, CompanySettings,
  AuditLogEntry, AuditAction, AuditEntity, UserAccount, UserRole, RolePermissions,
} from "./types";
import { DEFAULT_PERMISSIONS } from "./types";

// ---- Company Settings (persisted in localStorage) ----
const DEFAULT_SETTINGS: CompanySettings = {
  name: "الامبراطور للأثاث",
  address: "",
  phone: "",
  email: "",
  logoUrl: "/logo.png",
};

function loadSettings(): CompanySettings {
  try {
    const saved = localStorage.getItem("companySettings");
    if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

let companySettings: CompanySettings = loadSettings();

export function getCompanySettings(): CompanySettings { return companySettings; }
export function updateCompanySettings(data: Partial<CompanySettings>) {
  companySettings = { ...companySettings, ...data };
  localStorage.setItem("companySettings", JSON.stringify(companySettings));
  addAuditLog("update", "settings", "settings", "إعدادات الشركة", "تحديث إعدادات الشركة");
  notify();
}

// ==============================
// USER ACCOUNTS & ROLES
// ==============================
const DEFAULT_USERS: UserAccount[] = [
  { id: "U001", name: "المدير", email: "admin@emperor.com", password: "admin123", role: "admin", active: true },
  { id: "U002", name: "موظف مبيعات", email: "sales@emperor.com", password: "sales123", role: "sales", active: true },
  { id: "U003", name: "المحاسب", email: "accountant@emperor.com", password: "acc123", role: "accountant", active: true },
];

function loadUsers(): UserAccount[] {
  try {
    const saved = localStorage.getItem("userAccounts");
    if (saved) return JSON.parse(saved);
  } catch {}
  return [...DEFAULT_USERS];
}

const users: UserAccount[] = loadUsers();

function saveUsers() {
  localStorage.setItem("userAccounts", JSON.stringify(users));
}

let currentUser: UserAccount | null = null;

export function getUsers(): UserAccount[] { return [...users]; }
export function getCurrentUser(): UserAccount | null { return currentUser; }

export function getUserPermissions(): RolePermissions {
  if (!currentUser) return DEFAULT_PERMISSIONS.sales;
  return DEFAULT_PERMISSIONS[currentUser.role] || DEFAULT_PERMISSIONS.sales;
}

export function addUser(data: Omit<UserAccount, "id">): UserAccount {
  const u = { id: `U${String(users.length + 1).padStart(3, "0")}`, ...data };
  users.push(u);
  saveUsers();
  addAuditLog("create", "settings" as AuditEntity, u.id, u.name, `إضافة مستخدم: ${u.name} (${u.role})`);
  notify();
  return u;
}

export function updateUser(id: string, data: Partial<UserAccount>) {
  const idx = users.findIndex((u) => u.id === id);
  if (idx >= 0) {
    users[idx] = { ...users[idx], ...data };
    saveUsers();
    addAuditLog("update", "settings" as AuditEntity, id, users[idx].name, `تعديل مستخدم: ${users[idx].name}`);
    notify();
  }
}

export function deleteUser(id: string) {
  const idx = users.findIndex((u) => u.id === id);
  if (idx >= 0) {
    const name = users[idx].name;
    users.splice(idx, 1);
    saveUsers();
    addAuditLog("delete", "settings" as AuditEntity, id, name, `حذف مستخدم: ${name}`);
    notify();
  }
}

// ---- Auth ----
const AUTH_KEY = "isLoggedIn";
const CURRENT_USER_KEY = "currentUserId";

export function isAuthenticated(): boolean { return localStorage.getItem(AUTH_KEY) === "true"; }

export function login(email: string, password: string): boolean {
  const user = users.find((u) => u.email === email && u.password === password && u.active);
  if (user) {
    localStorage.setItem(AUTH_KEY, "true");
    localStorage.setItem(CURRENT_USER_KEY, user.id);
    currentUser = user;
    return true;
  }
  // Fallback: accept any non-empty for backward compat
  if (email && password) {
    localStorage.setItem(AUTH_KEY, "true");
    currentUser = DEFAULT_USERS[0]; // default admin
    localStorage.setItem(CURRENT_USER_KEY, currentUser.id);
    return true;
  }
  return false;
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(CURRENT_USER_KEY);
  currentUser = null;
}

// Restore current user on load
(function restoreUser() {
  const userId = localStorage.getItem(CURRENT_USER_KEY);
  if (userId) {
    currentUser = users.find((u) => u.id === userId) || null;
  }
})();

// ==============================
// AUDIT LOG
// ==============================
function loadAuditLog(): AuditLogEntry[] {
  try {
    const saved = localStorage.getItem("auditLog");
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

const auditLog: AuditLogEntry[] = loadAuditLog();
let auditLogSnap: AuditLogEntry[] = [...auditLog];

function saveAuditLog() {
  localStorage.setItem("auditLog", JSON.stringify(auditLog));
}

export function getAuditLog(): AuditLogEntry[] { return auditLogSnap; }

export function addAuditLog(
  action: AuditAction,
  entity: AuditEntity,
  entityId: string,
  entityName: string,
  details: string,
) {
  const entry: AuditLogEntry = {
    id: `AL${String(auditLog.length + 1).padStart(5, "0")}`,
    timestamp: new Date().toISOString(),
    user: currentUser?.name || "النظام",
    action,
    entity,
    entityId,
    entityName,
    details,
  };
  auditLog.unshift(entry);
  // Keep last 1000 entries
  if (auditLog.length > 1000) auditLog.splice(1000);
  saveAuditLog();
  auditLogSnap = [...auditLog];
}

export function clearAuditLog() {
  auditLog.length = 0;
  saveAuditLog();
  auditLogSnap = [];
  notify();
}

// ---- Initial seed data ----

const customers: Customer[] = [
  { id: "C001", fullName: "أحمد محمد علي", nationalId: "29901011234567", phone: "01012345678", address: "شارع التحرير", governorate: "القاهرة", jobTitle: "مهندس", notes: "" },
  { id: "C002", fullName: "سارة أحمد حسن", nationalId: "30001021234567", phone: "01098765432", address: "شارع الهرم", governorate: "الجيزة", jobTitle: "طبيبة", notes: "عميل مميز" },
  { id: "C003", fullName: "محمود حسن إبراهيم", nationalId: "28501031234567", phone: "01112345678", address: "شارع النصر", governorate: "الإسكندرية", jobTitle: "تاجر", notes: "" },
];

const products: Product[] = [
  { id: "P001", name: "غرفة نوم كاملة", category: "غرف نوم", defaultPrice: 25000, unit: "قطعة", notes: "" },
  { id: "P002", name: "طقم أنتريه مودرن", category: "أنتريهات", defaultPrice: 18000, unit: "قطعة", notes: "" },
  { id: "P003", name: "مطبخ ألوميتال", category: "مطابخ", defaultPrice: 15000, unit: "متر", notes: "" },
  { id: "P004", name: "غرفة سفرة ٨ كراسي", category: "سفرة", defaultPrice: 22000, unit: "قطعة", notes: "" },
  { id: "P005", name: "دولاب ملابس", category: "غرف نوم", defaultPrice: 8000, unit: "قطعة", notes: "" },
];

const invoices: Invoice[] = [
  {
    id: "INV-001", customer: "أحمد محمد علي", branch: "القاهرة", employee: "محمد سعيد",
    date: "2025-06-15", deliveryDate: "",
    items: [{ productName: "غرفة نوم كاملة", qty: 1, unitPrice: 25000, lineDiscount: 1000 }],
    status: "مؤكدة", paidTotal: 15000, commissionPercent: 3,
  },
  {
    id: "INV-002", customer: "سارة أحمد حسن", branch: "الجيزة", employee: "علي حسن",
    date: "2025-06-16", deliveryDate: "",
    items: [
      { productName: "طقم أنتريه مودرن", qty: 1, unitPrice: 18000, lineDiscount: 0 },
      { productName: "دولاب ملابس", qty: 2, unitPrice: 8000, lineDiscount: 500 },
    ],
    status: "مسودة", paidTotal: 0, commissionPercent: 2.5,
  },
];

const employees: Employee[] = [
  { id: "E001", name: "محمد سعيد", phone: "01011111111", branch: "القاهرة", monthlySalary: 5000, role: "مبيعات", active: true },
  { id: "E002", name: "علي حسن", phone: "01022222222", branch: "الجيزة", monthlySalary: 4500, role: "مبيعات", active: true },
  { id: "E003", name: "نورا أحمد", phone: "01033333333", branch: "القاهرة", monthlySalary: 6000, role: "محاسب", active: true },
];

const branches: Branch[] = [
  { id: "B001", name: "فرع القاهرة", address: "شارع التحرير - القاهرة", rent: 15000, active: true },
  { id: "B002", name: "فرع الجيزة", address: "شارع الهرم - الجيزة", rent: 12000, active: true },
  { id: "B003", name: "فرع الإسكندرية", address: "كورنيش الإسكندرية", rent: 10000, active: false },
];

const receipts: Receipt[] = [
  { id: "R001", invoiceId: "INV-001", customer: "أحمد محمد علي", amount: 10000, date: "2025-06-15", method: "نقدي", notes: "" },
  { id: "R002", invoiceId: "INV-001", customer: "أحمد محمد علي", amount: 5000, date: "2025-06-20", method: "تحويل بنكي", notes: "دفعة ثانية" },
];

// Track last added customer name
let lastAddedCustomer = "";

// ---- Generic helpers ----

function nextId(prefix: string, list: { id: string }[]): string {
  const num = list.length + 1;
  return prefix.includes("INV")
    ? `INV-${String(num).padStart(3, "0")}`
    : `${prefix}${String(num).padStart(3, "0")}`;
}

// ---- Change listeners (for React re-renders) ----

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---- Snapshot caches ----
let customersSnap: Customer[] = [...customers];
let productsSnap: Product[] = [...products];
let invoicesSnap: Invoice[] = [...invoices];
let employeesSnap: Employee[] = [...employees];
let branchesSnap: Branch[] = [...branches];
let receiptsSnap: Receipt[] = [...receipts];

function rebuildSnapshots() {
  customersSnap = [...customers];
  productsSnap = [...products];
  invoicesSnap = [...invoices];
  employeesSnap = [...employees];
  branchesSnap = [...branches];
  receiptsSnap = [...receipts];
  auditLogSnap = [...auditLog];
}

function notify() {
  rebuildSnapshots();
  listeners.forEach((fn) => fn());
}

// ==============================
// CUSTOMERS
// ==============================
export function getCustomers(): Customer[] { return customersSnap; }
export function getLastAddedCustomer(): string { return lastAddedCustomer; }

export function addCustomer(data: Omit<Customer, "id">): Customer {
  const c = { id: nextId("C", customers), ...data };
  customers.push(c);
  lastAddedCustomer = c.fullName;
  addAuditLog("create", "customer", c.id, c.fullName, `إضافة عميل: ${c.fullName}`);
  notify();
  return c;
}

export function updateCustomer(id: string, data: Partial<Customer>) {
  const idx = customers.findIndex((c) => c.id === id);
  if (idx >= 0) {
    const name = customers[idx].fullName;
    customers[idx] = { ...customers[idx], ...data };
    addAuditLog("update", "customer", id, data.fullName || name, `تعديل عميل: ${data.fullName || name}`);
    notify();
  }
}

export function deleteCustomer(id: string) {
  const idx = customers.findIndex((c) => c.id === id);
  if (idx >= 0) {
    const name = customers[idx].fullName;
    customers.splice(idx, 1);
    addAuditLog("delete", "customer", id, name, `حذف عميل: ${name}`);
    notify();
  }
}

// ==============================
// PRODUCTS
// ==============================
export function getProducts(): Product[] { return productsSnap; }

export function addProduct(data: Omit<Product, "id">): Product {
  const p = { id: nextId("P", products), ...data };
  products.push(p);
  addAuditLog("create", "product", p.id, p.name, `إضافة منتج: ${p.name}`);
  notify();
  return p;
}

export function updateProduct(id: string, data: Partial<Product>) {
  const idx = products.findIndex((p) => p.id === id);
  if (idx >= 0) {
    const name = products[idx].name;
    products[idx] = { ...products[idx], ...data };
    addAuditLog("update", "product", id, data.name || name, `تعديل منتج: ${data.name || name}`);
    notify();
  }
}

export function deleteProduct(id: string) {
  const idx = products.findIndex((p) => p.id === id);
  if (idx >= 0) {
    const name = products[idx].name;
    products.splice(idx, 1);
    addAuditLog("delete", "product", id, name, `حذف منتج: ${name}`);
    notify();
  }
}

// ==============================
// INVOICES
// ==============================
export function getInvoices(): Invoice[] { return invoicesSnap; }

export function addInvoice(data: Omit<Invoice, "id">): Invoice {
  const inv = { id: nextId("INV-", invoices), ...data };
  invoices.push(inv);
  addAuditLog("create", "invoice", inv.id, inv.id, `إنشاء فاتورة: ${inv.id} للعميل ${inv.customer}`);
  notify();
  return inv;
}

export function updateInvoice(id: string, data: Partial<Invoice>) {
  const idx = invoices.findIndex((i) => i.id === id);
  if (idx >= 0) {
    invoices[idx] = { ...invoices[idx], ...data };
    addAuditLog("update", "invoice", id, id, `تعديل فاتورة: ${id}`);
    notify();
  }
}

export function deleteInvoice(id: string) {
  const idx = invoices.findIndex((i) => i.id === id);
  if (idx >= 0) {
    invoices.splice(idx, 1);
    addAuditLog("delete", "invoice", id, id, `حذف فاتورة: ${id}`);
    notify();
  }
}

// ==============================
// EMPLOYEES
// ==============================
export function getEmployees(): Employee[] { return employeesSnap; }

export function addEmployee(data: Omit<Employee, "id">): Employee {
  const e = { id: nextId("E", employees), ...data };
  employees.push(e);
  addAuditLog("create", "employee", e.id, e.name, `إضافة موظف: ${e.name}`);
  notify();
  return e;
}

export function updateEmployee(id: string, data: Partial<Employee>) {
  const idx = employees.findIndex((e) => e.id === id);
  if (idx >= 0) {
    const name = employees[idx].name;
    employees[idx] = { ...employees[idx], ...data };
    addAuditLog("update", "employee", id, data.name || name, `تعديل موظف: ${data.name || name}`);
    notify();
  }
}

export function deleteEmployee(id: string) {
  const idx = employees.findIndex((e) => e.id === id);
  if (idx >= 0) {
    const name = employees[idx].name;
    employees.splice(idx, 1);
    addAuditLog("delete", "employee", id, name, `حذف موظف: ${name}`);
    notify();
  }
}

// ==============================
// BRANCHES
// ==============================
export function getBranches(): Branch[] { return branchesSnap; }

export function addBranch(data: Omit<Branch, "id">): Branch {
  const b = { id: nextId("B", branches), ...data };
  branches.push(b);
  addAuditLog("create", "branch", b.id, b.name, `إضافة فرع: ${b.name}`);
  notify();
  return b;
}

export function updateBranch(id: string, data: Partial<Branch>) {
  const idx = branches.findIndex((b) => b.id === id);
  if (idx >= 0) {
    const name = branches[idx].name;
    branches[idx] = { ...branches[idx], ...data };
    addAuditLog("update", "branch", id, data.name || name, `تعديل فرع: ${data.name || name}`);
    notify();
  }
}

export function deleteBranch(id: string) {
  const idx = branches.findIndex((b) => b.id === id);
  if (idx >= 0) {
    const name = branches[idx].name;
    branches.splice(idx, 1);
    addAuditLog("delete", "branch", id, name, `حذف فرع: ${name}`);
    notify();
  }
}

// ==============================
// RECEIPTS (Installments)
// ==============================
export function getReceipts(): Receipt[] { return receiptsSnap; }

export function addReceipt(data: Omit<Receipt, "id">): Receipt {
  const r = { id: nextId("R", receipts), ...data };
  receipts.push(r);
  if (data.invoiceId) {
    const invIdx = invoices.findIndex((i) => i.id === data.invoiceId);
    if (invIdx >= 0) {
      invoices[invIdx] = { ...invoices[invIdx], paidTotal: invoices[invIdx].paidTotal + data.amount };
    }
  }
  addAuditLog("create", "receipt", r.id, r.id, `إضافة قسط: ${r.amount} ج.م للفاتورة ${r.invoiceId}`);
  notify();
  return r;
}

export function updateReceipt(id: string, data: Partial<Receipt>) {
  const idx = receipts.findIndex((r) => r.id === id);
  if (idx >= 0) {
    const old = receipts[idx];
    const updated = { ...old, ...data };
    if (data.amount !== undefined && data.amount !== old.amount) {
      const invIdx = invoices.findIndex((i) => i.id === old.invoiceId);
      if (invIdx >= 0) {
        invoices[invIdx] = { ...invoices[invIdx], paidTotal: invoices[invIdx].paidTotal - old.amount + updated.amount };
      }
    }
    receipts[idx] = updated;
    addAuditLog("update", "receipt", id, id, `تعديل قسط: ${id}`);
    notify();
  }
}

export function deleteReceipt(id: string) {
  const idx = receipts.findIndex((r) => r.id === id);
  if (idx >= 0) {
    const old = receipts[idx];
    const invIdx = invoices.findIndex((i) => i.id === old.invoiceId);
    if (invIdx >= 0) {
      invoices[invIdx] = { ...invoices[invIdx], paidTotal: Math.max(0, invoices[invIdx].paidTotal - old.amount) };
    }
    receipts.splice(idx, 1);
    addAuditLog("delete", "receipt", id, id, `حذف قسط: ${id}`);
    notify();
  }
}

// ==============================
// BACKUP (Web mode - export/import JSON)
// ==============================
export function exportBackup(): string {
  const data = {
    version: 1,
    timestamp: new Date().toISOString(),
    customers: [...customers],
    products: [...products],
    invoices: [...invoices],
    employees: [...employees],
    branches: [...branches],
    receipts: [...receipts],
    settings: { ...companySettings },
    users: [...users],
    auditLog: [...auditLog],
  };
  return JSON.stringify(data, null, 2);
}

export function importBackup(jsonStr: string): boolean {
  try {
    const data = JSON.parse(jsonStr);
    if (!data.version) return false;

    customers.length = 0;
    products.length = 0;
    invoices.length = 0;
    employees.length = 0;
    branches.length = 0;
    receipts.length = 0;
    auditLog.length = 0;

    (data.customers || []).forEach((c: Customer) => customers.push(c));
    (data.products || []).forEach((p: Product) => products.push(p));
    (data.invoices || []).forEach((i: Invoice) => invoices.push(i));
    (data.employees || []).forEach((e: Employee) => employees.push(e));
    (data.branches || []).forEach((b: Branch) => branches.push(b));
    (data.receipts || []).forEach((r: Receipt) => receipts.push(r));
    (data.auditLog || []).forEach((a: AuditLogEntry) => auditLog.push(a));

    if (data.settings) {
      companySettings = { ...DEFAULT_SETTINGS, ...data.settings };
      localStorage.setItem("companySettings", JSON.stringify(companySettings));
    }
    if (data.users) {
      users.length = 0;
      data.users.forEach((u: UserAccount) => users.push(u));
      saveUsers();
    }
    saveAuditLog();
    addAuditLog("update", "settings", "backup", "نسخ احتياطي", "استعادة نسخة احتياطية");
    notify();
    return true;
  } catch {
    return false;
  }
}
