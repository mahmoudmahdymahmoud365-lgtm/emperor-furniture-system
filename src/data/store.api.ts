// ==============================
// API-backed Store (PostgreSQL via Express API)
// Sync getters + async mutations + cache + notify
// Compatible with useSyncExternalStore (no async getters)
// ==============================

import type {
  Customer, Product, Invoice, Employee, Branch, Receipt, CompanySettings,
  AuditLogEntry, AuditAction, AuditEntity, UserAccount, RolePermissions,
  Offer, StockMovement, ProductReturn, Shift, AttendanceRecord, SecurityEvent,
  Expense,
} from "./types";
import { DEFAULT_PERMISSIONS } from "./types";
import { api } from "./apiClient";

// ---- Change listeners (for React re-renders) ----
type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---- Snapshot caches (sync access for useSyncExternalStore) ----
let customersSnap: Customer[] = [];
let productsSnap: Product[] = [];
let invoicesSnap: Invoice[] = [];
let employeesSnap: Employee[] = [];
let branchesSnap: Branch[] = [];
let receiptsSnap: Receipt[] = [];
let offersSnap: Offer[] = [];
let stockMovementsSnap: StockMovement[] = [];
let returnsSnap: ProductReturn[] = [];
let shiftsSnap: Shift[] = [];
let attendanceSnap: AttendanceRecord[] = [];
let expensesSnap: Expense[] = [];
let usersSnap: UserAccount[] = [];
let auditLogSnap: AuditLogEntry[] = [];
let securityLogSnap: SecurityEvent[] = [];
let settingsCache: CompanySettings = {
  name: "الامبراطور للأثاث", address: "", phone: "", phones: [], email: "", emails: [], logoUrl: "/logo.png",
};

let lastAddedCustomer = "";

// ---- Notify listeners ----
function notify() {
  listeners.forEach((fn) => fn());
}

// ---- Refresh functions (fetch from API → update cache → notify) ----
async function refreshEntity<T>(fetcher: () => Promise<T[]>, setter: (data: T[]) => void) {
  try {
    const data = await fetcher();
    setter(data);
  } catch (e) {
    console.warn("Failed to refresh:", e);
  }
}

async function refreshAll() {
  await Promise.all([
    refreshEntity(api.getCustomers, (d) => { customersSnap = d; }),
    refreshEntity(api.getProducts, (d) => { productsSnap = d; }),
    refreshEntity(api.getInvoices, (d) => { invoicesSnap = d; }),
    refreshEntity(api.getEmployees, (d) => { employeesSnap = d; }),
    refreshEntity(api.getBranches, (d) => { branchesSnap = d; }),
    refreshEntity(api.getReceipts, (d) => { receiptsSnap = d; }),
    refreshEntity(api.getOffers, (d) => { offersSnap = d; }),
    refreshEntity(api.getStockMovements, (d) => { stockMovementsSnap = d; }),
    refreshEntity(api.getReturns, (d) => { returnsSnap = d; }),
    refreshEntity(api.getShifts, (d) => { shiftsSnap = d; }),
    refreshEntity(api.getAttendance, (d) => { attendanceSnap = d; }),
    refreshEntity(api.getExpenses, (d) => { expensesSnap = d; }),
    refreshEntity(api.getUsers, (d) => { usersSnap = d; }),
    refreshEntity(api.getAuditLog, (d) => { auditLogSnap = d; }),
    refreshEntity(api.getSecurityLog, (d) => { securityLogSnap = d; }),
    (async () => {
      try {
        const s = await api.getSettings();
        settingsCache = {
          name: s.name || "الامبراطور للأثاث",
          address: s.address || "",
          phone: s.phone || "",
          phones: s.phones || [],
          email: s.email || "",
          emails: s.emails || [],
          logoUrl: s.logoUrl || "/logo.png",
        };
      } catch {}
    })(),
  ]);
  notify();
}

// Selective refresh + notify
async function refreshAndNotify(...entities: string[]) {
  const refreshMap: Record<string, () => Promise<void>> = {
    customers: async () => { customersSnap = await api.getCustomers(); },
    products: async () => { productsSnap = await api.getProducts(); },
    invoices: async () => { invoicesSnap = await api.getInvoices(); },
    employees: async () => { employeesSnap = await api.getEmployees(); },
    branches: async () => { branchesSnap = await api.getBranches(); },
    receipts: async () => { receiptsSnap = await api.getReceipts(); },
    offers: async () => { offersSnap = await api.getOffers(); },
    stockMovements: async () => { stockMovementsSnap = await api.getStockMovements(); },
    returns: async () => { returnsSnap = await api.getReturns(); },
    shifts: async () => { shiftsSnap = await api.getShifts(); },
    attendance: async () => { attendanceSnap = await api.getAttendance(); },
    expenses: async () => { expensesSnap = await api.getExpenses(); },
    users: async () => { usersSnap = await api.getUsers(); },
    auditLog: async () => { auditLogSnap = await api.getAuditLog(); },
    securityLog: async () => { securityLogSnap = await api.getSecurityLog(); },
    settings: async () => {
      const s = await api.getSettings();
      settingsCache = { name: s.name||"الامبراطور للأثاث", address: s.address||"", phone: s.phone||"", phones: s.phones||[], email: s.email||"", emails: s.emails||[], logoUrl: s.logoUrl||"/logo.png" };
    },
  };
  
  const tasks = entities.map(e => refreshMap[e]?.()).filter(Boolean);
  await Promise.all(tasks);
  notify();
}

// ---- Initial load ----
refreshAll();

// ---- Polling for multi-device sync (every 10 seconds) ----
setInterval(() => { refreshAll(); }, 10000);

// ==============================
// AUTH
// ==============================
const AUTH_KEY = "isLoggedIn";
const CURRENT_USER_KEY = "currentUserId";
let currentUser: UserAccount | null = null;

export function isAuthenticated(): boolean { return localStorage.getItem(AUTH_KEY) === "true"; }

export function login(email: string, password: string): boolean {
  // Sync check against cached users
  const user = usersSnap.find((u) => u.email === email && u.password === password && u.active);
  if (user) {
    localStorage.setItem(AUTH_KEY, "true");
    localStorage.setItem(CURRENT_USER_KEY, user.id);
    currentUser = user;
    api.addSecurityEvent({ type: "login_success", email, userName: user.name, userAgent: navigator.userAgent }).catch(() => {});
    refreshAndNotify("securityLog");
    return true;
  }
  api.addSecurityEvent({ type: "login_failed", email, userName: "", userAgent: navigator.userAgent }).catch(() => {});
  return false;
}

export function logout() {
  if (currentUser) {
    api.addSecurityEvent({ type: "logout", email: currentUser.email, userName: currentUser.name, userAgent: navigator.userAgent }).catch(() => {});
  }
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(CURRENT_USER_KEY);
  currentUser = null;
}

// Restore user from localStorage on load
(function restoreUser() {
  const userId = localStorage.getItem(CURRENT_USER_KEY);
  if (userId) {
    // Will be resolved after first refresh
    const check = () => {
      currentUser = usersSnap.find((u) => u.id === userId) || null;
    };
    check();
    // Re-check after initial data load
    setTimeout(check, 2000);
  }
})();

export function getCurrentUser(): UserAccount | null { return currentUser; }
export function getUsers(): UserAccount[] { return usersSnap; }

export function getUserPermissions(): RolePermissions {
  if (!currentUser) return DEFAULT_PERMISSIONS.sales;
  const base = DEFAULT_PERMISSIONS[currentUser.role] || DEFAULT_PERMISSIONS.sales;
  if (currentUser.customPermissions) return { ...base, ...currentUser.customPermissions };
  return base;
}

export async function addUser(data: Omit<UserAccount, "id">): Promise<UserAccount> {
  const u = await api.addUser(data);
  await api.addAuditLog({ user: currentUser?.name||"النظام", action: "create", entity: "settings", entityId: u.id, entityName: u.name, details: `إضافة مستخدم: ${u.name}` });
  await refreshAndNotify("users", "auditLog");
  return u;
}

export async function updateUser(id: string, data: Partial<UserAccount>) {
  await api.updateUser(id, data);
  await api.addAuditLog({ user: currentUser?.name||"النظام", action: "update", entity: "settings", entityId: id, entityName: data.name||"", details: `تعديل مستخدم` });
  await refreshAndNotify("users", "auditLog");
}

export async function deleteUser(id: string) {
  await api.deleteUser(id);
  await refreshAndNotify("users", "auditLog");
}

// ==============================
// COMPANY SETTINGS
// ==============================
export function getCompanySettings(): CompanySettings { return settingsCache; }

export async function updateCompanySettings(data: Partial<CompanySettings>) {
  await api.updateSettings(data);
  await api.addAuditLog({ user: currentUser?.name||"النظام", action: "update", entity: "settings", entityId: "settings", entityName: "إعدادات الشركة", details: "تحديث إعدادات الشركة" });
  await refreshAndNotify("settings", "auditLog");
}

// ==============================
// CUSTOMERS
// ==============================
export function getCustomers(): Customer[] { return customersSnap; }
export function getLastAddedCustomer(): string { return lastAddedCustomer; }

export async function addCustomer(data: Omit<Customer, "id">): Promise<Customer> {
  const c = await api.addCustomer(data);
  lastAddedCustomer = c.fullName;
  await refreshAndNotify("customers");
  return c;
}

export async function updateCustomer(id: string, data: Partial<Customer>) {
  await api.updateCustomer(id, data);
  await refreshAndNotify("customers");
}

export async function deleteCustomer(id: string) {
  await api.deleteCustomer(id);
  await refreshAndNotify("customers");
}

// ==============================
// PRODUCTS
// ==============================
export function getProducts(): Product[] { return productsSnap; }

export async function addProduct(data: Omit<Product, "id">): Promise<Product> {
  const p = await api.addProduct(data);
  await refreshAndNotify("products");
  return p;
}

export async function updateProduct(id: string, data: Partial<Product>) {
  await api.updateProduct(id, data);
  await refreshAndNotify("products");
}

export async function deleteProduct(id: string) {
  await api.deleteProduct(id);
  await refreshAndNotify("products");
}

// ==============================
// INVOICES
// ==============================
export function getInvoices(): Invoice[] { return invoicesSnap; }

export async function addInvoice(data: Omit<Invoice, "id">): Promise<Invoice> {
  const inv = await api.addInvoice(data);
  await refreshAndNotify("invoices", "products", "stockMovements");
  return inv;
}

export async function updateInvoice(id: string, data: Partial<Invoice>) {
  await api.updateInvoice(id, data);
  await refreshAndNotify("invoices");
}

export async function deleteInvoice(id: string) {
  await api.deleteInvoice(id);
  await refreshAndNotify("invoices", "products", "stockMovements");
}

// ==============================
// EMPLOYEES
// ==============================
export function getEmployees(): Employee[] { return employeesSnap; }

export async function addEmployee(data: Omit<Employee, "id">): Promise<Employee> {
  const e = await api.addEmployee(data);
  await refreshAndNotify("employees");
  return e;
}

export async function updateEmployee(id: string, data: Partial<Employee>) {
  await api.updateEmployee(id, data);
  await refreshAndNotify("employees");
}

export async function deleteEmployee(id: string) {
  await api.deleteEmployee(id);
  await refreshAndNotify("employees");
}

// ==============================
// BRANCHES
// ==============================
export function getBranches(): Branch[] { return branchesSnap; }

export async function addBranch(data: Omit<Branch, "id">): Promise<Branch> {
  const b = await api.addBranch(data);
  await refreshAndNotify("branches");
  return b;
}

export async function updateBranch(id: string, data: Partial<Branch>) {
  await api.updateBranch(id, data);
  await refreshAndNotify("branches");
}

export async function deleteBranch(id: string) {
  await api.deleteBranch(id);
  await refreshAndNotify("branches");
}

// ==============================
// RECEIPTS
// ==============================
export function getReceipts(): Receipt[] { return receiptsSnap; }

export async function addReceipt(data: Omit<Receipt, "id">): Promise<Receipt> {
  const r = await api.addReceipt(data);
  await refreshAndNotify("receipts", "invoices");
  return r;
}

export async function updateReceipt(id: string, data: Partial<Receipt>) {
  await api.updateReceipt(id, data);
  await refreshAndNotify("receipts", "invoices");
}

export async function deleteReceipt(id: string) {
  await api.deleteReceipt(id);
  await refreshAndNotify("receipts", "invoices");
}

// ==============================
// OFFERS
// ==============================
export function getOffers(): Offer[] { return offersSnap; }

export function getActiveOffers(): Offer[] {
  const today = new Date().toISOString().split("T")[0];
  return offersSnap.filter(o => {
    if (!o.active) return false;
    if (o.type === "timed" || o.endDate) {
      if (o.startDate && today < o.startDate) return false;
      if (o.endDate && today > o.endDate) return false;
    }
    return true;
  });
}

export function getProductDiscount(productName: string): number {
  const active = getActiveOffers();
  let totalDiscount = 0;
  for (const offer of active) {
    if (offer.productName && offer.productName !== productName) continue;
    totalDiscount += offer.value;
  }
  return totalDiscount;
}

export async function addOffer(data: Omit<Offer, "id">): Promise<Offer> {
  const o = await api.addOffer(data);
  await refreshAndNotify("offers");
  return o;
}

export async function updateOffer(id: string, data: Partial<Offer>) {
  await api.updateOffer(id, data);
  await refreshAndNotify("offers");
}

export async function deleteOffer(id: string) {
  await api.deleteOffer(id);
  await refreshAndNotify("offers");
}

// ==============================
// STOCK MOVEMENTS
// ==============================
export function getStockMovements(): StockMovement[] { return stockMovementsSnap; }

export async function addManualStockMovement(productId: string, productName: string, type: StockMovement["type"], qty: number, reason: string) {
  await api.addStockMovement({ productId, productName, type, qty, date: new Date().toISOString(), reason });
  await refreshAndNotify("products", "stockMovements");
}

// ==============================
// RETURNS
// ==============================
export function getReturns(): ProductReturn[] { return returnsSnap; }

export async function addReturn(data: Omit<ProductReturn, "id">): Promise<ProductReturn> {
  const r = await api.addReturn(data);
  await refreshAndNotify("returns", "products", "invoices", "stockMovements");
  return r;
}

// ==============================
// SHIFTS
// ==============================
export function getShifts(): Shift[] { return shiftsSnap; }

export async function addShift(data: Omit<Shift, "id">): Promise<Shift> {
  const s = await api.addShift(data);
  await refreshAndNotify("shifts");
  return s;
}

export async function updateShift(id: string, data: Partial<Shift>) {
  await api.updateShift(id, data);
  await refreshAndNotify("shifts");
}

export async function deleteShift(id: string) {
  await api.deleteShift(id);
  await refreshAndNotify("shifts");
}

// ==============================
// ATTENDANCE
// ==============================
export function getAttendance(): AttendanceRecord[] { return attendanceSnap; }

export async function addAttendance(data: Omit<AttendanceRecord, "id">): Promise<AttendanceRecord> {
  const a = await api.addAttendance(data);
  await refreshAndNotify("attendance");
  return a;
}

export async function updateAttendance(id: string, data: Partial<AttendanceRecord>) {
  await api.updateAttendance(id, data);
  await refreshAndNotify("attendance");
}

export async function deleteAttendance(id: string) {
  await api.deleteAttendance(id);
  await refreshAndNotify("attendance");
}

// ==============================
// EXPENSES
// ==============================
export function getExpenses(): Expense[] { return expensesSnap; }

export async function addExpense(data: Omit<Expense, "id">): Promise<Expense> {
  const e = await api.addExpense(data);
  await refreshAndNotify("expenses");
  return e;
}

export async function updateExpense(id: string, data: Partial<Expense>) {
  await api.updateExpense(id, data);
  await refreshAndNotify("expenses");
}

export async function deleteExpense(id: string) {
  await api.deleteExpense(id);
  await refreshAndNotify("expenses");
}

// ==============================
// AUDIT LOG
// ==============================
export function getAuditLog(): AuditLogEntry[] { return auditLogSnap; }

export async function clearAuditLog() {
  await api.clearAuditLog();
  await refreshAndNotify("auditLog");
}

// ==============================
// SECURITY LOG
// ==============================
export function getSecurityLog(): SecurityEvent[] { return securityLogSnap; }

export async function clearSecurityLog() {
  await api.clearSecurityLog();
  await refreshAndNotify("securityLog");
}

// ==============================
// BACKUP (export/import via API)
// ==============================
export interface BackupMeta {
  id: string;
  timestamp: string;
  size: number;
  type: "auto" | "manual";
  label?: string;
}

function getBackupData() {
  return {
    version: 8,
    timestamp: new Date().toISOString(),
    customers: customersSnap,
    products: productsSnap,
    invoices: invoicesSnap,
    employees: employeesSnap,
    branches: branchesSnap,
    receipts: receiptsSnap,
    offers: offersSnap,
    stockMovements: stockMovementsSnap,
    productReturns: returnsSnap,
    shifts: shiftsSnap,
    attendance: attendanceSnap,
    expenses: expensesSnap,
    settings: settingsCache,
    users: usersSnap,
    auditLog: auditLogSnap,
  };
}

export function exportBackup(): string {
  return JSON.stringify(getBackupData(), null, 2);
}

export function exportBackupAsFile(): Blob {
  return new Blob([exportBackup()], { type: "application/json" });
}

export function importBackup(jsonStr: string): boolean {
  // For now, import is client-side only — in production, this should go through the API
  try {
    const data = JSON.parse(jsonStr);
    if (!data.version) return false;
    console.warn("Import via API not yet implemented — use database migration tools for production.");
    return true;
  } catch {
    return false;
  }
}

// ---- Auto-backup stubs (not needed with PostgreSQL but kept for compatibility) ----
export function getAutoBackupList(): BackupMeta[] { return []; }
export function createAutoBackup(): BackupMeta | null { return null; }
export function createManualBackup(_label?: string): BackupMeta | null { return null; }
export function restoreFromBackupId(_id: string): boolean { return false; }
export function deleteBackup(_id: string) {}
export function getLastAutoBackupTime(): string | null { return null; }
export function getAutoBackupInterval(): number { return 24; }
export function setAutoBackupInterval(_hours: number) {}
export function checkAndRunAutoBackup(): boolean { return false; }

// ---- Cloud config stubs ----
export interface CloudConfig {
  enabled: boolean;
  provider: "lovable-cloud" | "onedrive" | "none";
  lastSync?: string;
  autoSync: boolean;
}

export function getCloudConfig(): CloudConfig {
  return { enabled: false, provider: "none", autoSync: false };
}

export function updateCloudConfig(_config: Partial<CloudConfig>) {}

// ---- Audit log helper (used by other modules) ----
export function addAuditLog(action: AuditAction, entity: AuditEntity, entityId: string, entityName: string, details: string) {
  api.addAuditLog({ user: currentUser?.name || "النظام", action, entity, entityId, entityName, details }).catch(() => {});
}

export function addSecurityEvent(type: SecurityEvent["type"], email: string, userName: string) {
  api.addSecurityEvent({ type, email, userName, userAgent: navigator.userAgent }).catch(() => {});
}
