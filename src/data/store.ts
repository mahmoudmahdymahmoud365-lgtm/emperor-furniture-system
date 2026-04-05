// ==============================
// In-Memory Data Store — API-First Architecture
// PostgreSQL via API is the ONLY source of truth
// localStorage is used ONLY as a read cache for faster initial render
// All mutations MUST go through the API
// ==============================

import type {
  Customer, Product, Invoice, Employee, Branch, Receipt, CompanySettings,
  AuditLogEntry, AuditAction, AuditEntity, UserAccount,
  Offer, StockMovement, ProductReturn, Shift, AttendanceRecord,
  Expense, ManufacturingStatus, RecurringInterval, ManufacturingOrder,
} from "./types";
import { nextId, notifyListeners } from "./store.core";
import { api } from "./apiClient";

// ---- Re-export core ----
export { subscribe } from "./store.core";

// ---- Re-export auth (API-first overrides below) ----
export {
  getCurrentUser, getUserPermissions,
  isAuthenticated, logout,
  rebuildUsersSnap, rebuildSecurityLogSnap,
  setAuthDeps, _setCurrentUser,
  loadSecurityLogFromApi,
} from "./store.auth";

import {
  getCurrentUser, rebuildUsersSnap, rebuildSecurityLogSnap, setAuthDeps, _setCurrentUser,
  loadSecurityLogFromApi,
} from "./store.auth";

// ---- Re-export backup ----
export {
  exportBackup, exportBackupAsFile,
  getAutoBackupList, createAutoBackup, createManualBackup,
  restoreFromBackupId, deleteBackup,
  getLastAutoBackupTime, getAutoBackupInterval, setAutoBackupInterval,
  checkAndRunAutoBackup,
  getCloudConfig, updateCloudConfig,
} from "./store.backup";
export type { BackupMeta, CloudConfig } from "./store.backup";

import { setBackupDeps } from "./store.backup";

// ==============================
// API CONNECTION STATE
// ==============================
let apiConnected = false;
let apiInitialized = false;
let initPromise: Promise<void> | null = null;

export function isApiConnected(): boolean { return apiConnected; }
export function isApiInitialized(): boolean { return apiInitialized; }

// ==============================
// CACHE LAYER — localStorage used ONLY for faster initial render
// NOT for business logic
// ==============================
function cacheRead<T>(key: string): T[] {
  try {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

function cacheWrite<T>(key: string, data: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

// ---- Company Settings ----
const DEFAULT_SETTINGS: CompanySettings = {
  name: "الامبراطور للأثاث",
  address: "",
  phone: "",
  phones: [],
  email: "",
  emails: [],
  logoUrl: "/logo.png",
};

let companySettings: CompanySettings = DEFAULT_SETTINGS;

export function getCompanySettings(): CompanySettings { return companySettings; }

export async function updateCompanySettings(data: Partial<CompanySettings>) {
  const updated = { ...companySettings, ...data };
  try {
    await api.updateSettings(updated);
    companySettings = updated;
    cacheWrite("companySettings_cache", [updated]);
    addAuditLog("update", "settings", "settings", "إعدادات الشركة", "تحديث إعدادات الشركة");
    notify("settings");
  } catch (e: any) {
    console.error("Failed to update settings:", e);
    throw new Error("فشل في تحديث الإعدادات. تأكد من الاتصال بالخادم.");
  }
}

// ==============================
// AUDIT LOG
// ==============================
let auditLog: AuditLogEntry[] = [];
let auditLogSnap: AuditLogEntry[] = [];

export function getAuditLog(): AuditLogEntry[] { return auditLogSnap; }

export function addAuditLog(
  action: AuditAction | string, entity: AuditEntity | string, entityId: string, entityName: string, details: string,
) {
  const entry: AuditLogEntry = {
    id: `AL${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    timestamp: new Date().toISOString(),
    user: getCurrentUser()?.name || "النظام",
    action: action as AuditAction, entity: entity as AuditEntity, entityId, entityName, details,
  };
  auditLog.unshift(entry);
  if (auditLog.length > 1000) auditLog.splice(1000);
  auditLogSnap = [...auditLog];
  // Fire and forget to API
  api.addAuditLog(entry).catch(() => {});
}

export async function clearAuditLog() {
  try {
    await api.clearAuditLog();
    auditLog.length = 0;
    auditLogSnap = [];
    notify("auditLog");
  } catch (e: any) {
    throw new Error("فشل في مسح سجل العمليات.");
  }
}

// ==============================
// IN-MEMORY ARRAYS (populated from API)
// ==============================
let usersCache: UserAccount[] = [];
let customers: Customer[] = [];
let products: Product[] = [];
let invoices: Invoice[] = [];
let employees: Employee[] = [];
let branches: Branch[] = [];
let receipts: Receipt[] = [];
let offers: Offer[] = [];
let stockMovements: StockMovement[] = [];
let productReturns: ProductReturn[] = [];
let shifts: Shift[] = [];
let attendance: AttendanceRecord[] = [];
let expensesList: Expense[] = [];
let manufacturingOrders: ManufacturingOrder[] = [];

// ---- Snapshots for React rendering ----
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
let mfgOrdersSnap: ManufacturingOrder[] = [];

let dirtyFlags = new Set<string>();
function markDirty(entity: string) { dirtyFlags.add(entity); }

function rebuildSnapshots() {
  if (dirtyFlags.has("all") || dirtyFlags.size === 0) {
    customersSnap = [...customers]; productsSnap = [...products]; invoicesSnap = [...invoices];
    employeesSnap = [...employees]; branchesSnap = [...branches]; receiptsSnap = [...receipts];
    auditLogSnap = [...auditLog]; offersSnap = [...offers];
    stockMovementsSnap = [...stockMovements]; returnsSnap = [...productReturns];
    shiftsSnap = [...shifts]; attendanceSnap = [...attendance]; expensesSnap = [...expensesList];
    mfgOrdersSnap = [...manufacturingOrders];
    rebuildUsersSnap(); rebuildSecurityLogSnap();
  } else {
    if (dirtyFlags.has("customers")) customersSnap = [...customers];
    if (dirtyFlags.has("products")) productsSnap = [...products];
    if (dirtyFlags.has("invoices")) invoicesSnap = [...invoices];
    if (dirtyFlags.has("employees")) employeesSnap = [...employees];
    if (dirtyFlags.has("branches")) branchesSnap = [...branches];
    if (dirtyFlags.has("receipts")) receiptsSnap = [...receipts];
    if (dirtyFlags.has("auditLog")) auditLogSnap = [...auditLog];
    if (dirtyFlags.has("users")) rebuildUsersSnap();
    if (dirtyFlags.has("offers")) offersSnap = [...offers];
    if (dirtyFlags.has("stockMovements")) stockMovementsSnap = [...stockMovements];
    if (dirtyFlags.has("returns")) returnsSnap = [...productReturns];
    if (dirtyFlags.has("shifts")) shiftsSnap = [...shifts];
    if (dirtyFlags.has("attendance")) attendanceSnap = [...attendance];
    if (dirtyFlags.has("securityLog")) rebuildSecurityLogSnap();
    if (dirtyFlags.has("expenses")) expensesSnap = [...expensesList];
    if (dirtyFlags.has("mfgOrders")) mfgOrdersSnap = [...manufacturingOrders];
  }
  dirtyFlags = new Set();
}

function notify(...entities: string[]) {
  for (const e of entities) markDirty(e);
  rebuildSnapshots();
  notifyListeners();
}

// ---- Wire up auth deps ----
setAuthDeps(addAuditLog, notify);

// ---- Wire up backup deps ----
function getBackupData() {
  return {
    version: 7,
    timestamp: new Date().toISOString(),
    customers: [...customers], products: [...products], invoices: [...invoices],
    employees: [...employees], branches: [...branches], receipts: [...receipts],
    offers: [...offers], stockMovements: [...stockMovements], productReturns: [...productReturns],
    shifts: [...shifts], attendance: [...attendance], expenses: [...expensesList],
    settings: { ...companySettings },
    users: [],
    auditLog: [...auditLog],
  };
}

export function importBackup(jsonStr: string): boolean {
  try {
    const data = JSON.parse(jsonStr);
    if (!data.version) return false;
    // For backup restore, push all data to API
    // This is a bulk operation — best effort
    console.warn("Backup restore should be done via API for data integrity");
    return false;
  } catch {
    return false;
  }
}

setBackupDeps(getBackupData, importBackup);

// ==============================
// API-FIRST INITIALIZATION
// Loads all data from PostgreSQL via API
// Falls back to cache ONLY for initial render speed
// ==============================
async function loadFromApi() {
  try {
    const health = await api.health();
    if (health.status !== "ok") throw new Error("API not healthy");
    apiConnected = true;
  } catch {
    apiConnected = false;
    console.warn("API not available — loading from cache for display only. Writes will fail.");
    loadFromCache();
    apiInitialized = true;
    notify("all");
    return;
  }

  // Fetch all data from API in parallel
  try {
    const [
      apiCustomers, apiProducts, apiInvoices, apiEmployees,
      apiBranches, apiReceipts, apiOffers, apiStockMovements,
      apiReturns, apiShifts, apiAttendance, apiExpenses,
      apiAuditLog, apiSettings, apiUsers,
    ] = await Promise.all([
      api.getCustomers().catch(() => null),
      api.getProducts().catch(() => null),
      api.getInvoices().catch(() => null),
      api.getEmployees().catch(() => null),
      api.getBranches().catch(() => null),
      api.getReceipts().catch(() => null),
      api.getOffers().catch(() => null),
      api.getStockMovements().catch(() => null),
      api.getReturns().catch(() => null),
      api.getShifts().catch(() => null),
      api.getAttendance().catch(() => null),
      api.getExpenses().catch(() => null),
      api.getAuditLog().catch(() => null),
      api.getSettings().catch(() => null),
      api.getUsers().catch(() => null),
    ]);

    // Also load security log from API
    loadSecurityLogFromApi().catch(() => {});

    if (apiCustomers) { customers = apiCustomers; cacheWrite("emp_customers", customers); }
    if (apiProducts) { products = apiProducts; cacheWrite("emp_products", products); }
    if (apiInvoices) { invoices = apiInvoices; cacheWrite("emp_invoices", invoices); }
    if (apiEmployees) { employees = apiEmployees; cacheWrite("emp_employees", employees); }
    if (apiBranches) { branches = apiBranches; cacheWrite("emp_branches", branches); }
    if (apiReceipts) { receipts = apiReceipts; cacheWrite("emp_receipts", receipts); }
    if (apiOffers) { offers = apiOffers; cacheWrite("offers", offers); }
    if (apiStockMovements) { stockMovements = apiStockMovements; cacheWrite("stockMovements", stockMovements); }
    if (apiReturns) { productReturns = apiReturns; cacheWrite("productReturns", productReturns); }
    if (apiShifts) { shifts = apiShifts; cacheWrite("shifts", shifts); }
    if (apiAttendance) { attendance = apiAttendance; cacheWrite("attendance", attendance); }
    if (apiExpenses) { expensesList = apiExpenses; cacheWrite("expenses", expensesList); }
    if (apiAuditLog) { auditLog = apiAuditLog; }
    if (apiSettings) {
      companySettings = { ...DEFAULT_SETTINGS, ...apiSettings };
    }
    // Update users cache (declared later but hoisted)
    if (apiUsers && Array.isArray(apiUsers)) {
      usersCache = apiUsers;
    }
  } catch (e) {
    console.error("Failed to load data from API:", e);
  }

  apiInitialized = true;
  notify("all");
}

function loadFromCache() {
  customers = cacheRead("emp_customers");
  products = cacheRead("emp_products");
  invoices = cacheRead("emp_invoices");
  employees = cacheRead("emp_employees");
  branches = cacheRead("emp_branches");
  receipts = cacheRead("emp_receipts");
  offers = cacheRead("offers");
  stockMovements = cacheRead("stockMovements");
  productReturns = cacheRead("productReturns");
  shifts = cacheRead("shifts");
  attendance = cacheRead("attendance");
  expensesList = cacheRead("expenses");
  auditLog = cacheRead("auditLog");
  try {
    const cached = localStorage.getItem("companySettings_cache");
    if (cached) {
      const arr = JSON.parse(cached);
      if (Array.isArray(arr) && arr[0]) companySettings = { ...DEFAULT_SETTINGS, ...arr[0] };
    }
  } catch {}
}

// Initialize data from API
export function initializeStore(): Promise<void> {
  if (!initPromise) {
    // Load cache first for instant render
    loadFromCache();
    notify("all");
    // Then load from API (source of truth)
    initPromise = loadFromApi();
  }
  return initPromise;
}

// Periodic sync from API (polling every 15s)
let syncTimer: ReturnType<typeof setInterval> | null = null;

export function startPeriodicSync(intervalMs = 15000) {
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = setInterval(async () => {
    if (!apiConnected) {
      // Try to reconnect
      try {
        const health = await api.health();
        if (health.status === "ok") {
          apiConnected = true;
          await loadFromApi();
        }
      } catch {}
      return;
    }
    await loadFromApi();
  }, intervalMs);
}

export function stopPeriodicSync() {
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
}

// ==============================
// HELPER: Ensure API is available before mutations
// ==============================
function requireApi() {
  if (!apiConnected) {
    throw new Error("غير متصل بالخادم. لا يمكن إجراء العملية.");
  }
}

// Handle 409 conflict responses
function handleConflict(e: any) {
  if (e.message?.includes("CONFLICT") || e.message?.includes("تم تعديل")) {
    // Force reload data from API
    loadFromApi();
    throw new Error("تم تعديل هذا السجل من جهاز آخر. تم تحديث البيانات تلقائياً. حاول مرة أخرى.");
  }
  throw e;
}

// ==============================
// STOCK MOVEMENTS
// ==============================
function recordStockMovement(productName: string, type: StockMovement["type"], qty: number, reason: string, relatedId?: string) {
  const product = products.find(p => p.name === productName);
  const sm: StockMovement = {
    id: `SM${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    productId: product?.id || "",
    productName, type, qty,
    date: new Date().toISOString(),
    reason, relatedId,
  };
  stockMovements.unshift(sm);
  if (stockMovements.length > 2000) stockMovements.splice(2000);
  stockMovementsSnap = [...stockMovements];
  // Fire and forget to API
  api.addStockMovement(sm).catch(() => {});
}

export function getStockMovements(): StockMovement[] { return stockMovementsSnap; }

// ==============================
// RETURNS
// ==============================
export function getReturns(): ProductReturn[] { return returnsSnap; }

export async function addReturn(data: Omit<ProductReturn, "id">): Promise<ProductReturn> {
  requireApi();
  const result = await api.addReturn(data);
  // Refresh from API to get consistent state
  await loadFromApi();
  return result;
}

// ==============================
// SHIFTS
// ==============================
export function getShifts(): Shift[] { return shiftsSnap; }

export async function addShift(data: Omit<Shift, "id">): Promise<Shift> {
  requireApi();
  const result = await api.addShift(data);
  shifts.push(result);
  cacheWrite("shifts", shifts);
  addAuditLog("create", "shift", result.id, result.name, `إضافة شفت: ${result.name}`);
  notify("shifts");
  return result;
}

export async function updateShift(id: string, data: Partial<Shift>) {
  requireApi();
  await api.updateShift(id, data);
  const idx = shifts.findIndex(s => s.id === id);
  if (idx >= 0) {
    shifts[idx] = { ...shifts[idx], ...data };
    cacheWrite("shifts", shifts);
    addAuditLog("update", "shift", id, shifts[idx].name, `تعديل شفت: ${shifts[idx].name}`);
    notify("shifts");
  }
}

export async function deleteShift(id: string) {
  requireApi();
  const idx = shifts.findIndex(s => s.id === id);
  if (idx >= 0) {
    const name = shifts[idx].name;
    await api.deleteShift(id);
    shifts.splice(idx, 1);
    cacheWrite("shifts", shifts);
    addAuditLog("delete", "shift", id, name, `حذف شفت: ${name}`);
    notify("shifts");
  }
}

// ==============================
// ATTENDANCE
// ==============================
export function getAttendance(): AttendanceRecord[] { return attendanceSnap; }

export async function addAttendance(data: Omit<AttendanceRecord, "id">): Promise<AttendanceRecord> {
  requireApi();
  const result = await api.addAttendance(data);
  attendance.push(result);
  cacheWrite("attendance", attendance);
  addAuditLog("create", "attendance", result.id, result.employeeName, `تسجيل حضور: ${result.employeeName}`);
  notify("attendance");
  return result;
}

export async function updateAttendance(id: string, data: Partial<AttendanceRecord>) {
  requireApi();
  await api.updateAttendance(id, data);
  const idx = attendance.findIndex(a => a.id === id);
  if (idx >= 0) {
    attendance[idx] = { ...attendance[idx], ...data };
    cacheWrite("attendance", attendance);
    notify("attendance");
  }
}

export async function deleteAttendance(id: string) {
  requireApi();
  await api.deleteAttendance(id);
  const idx = attendance.findIndex(a => a.id === id);
  if (idx >= 0) {
    attendance.splice(idx, 1);
    cacheWrite("attendance", attendance);
    notify("attendance");
  }
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
    if (offer.type === "percentage") totalDiscount += offer.value;
    else if (offer.type === "fixed") totalDiscount += offer.value;
    else if (offer.type === "timed") totalDiscount += offer.value;
  }
  return totalDiscount;
}

export async function addOffer(data: Omit<Offer, "id">): Promise<Offer> {
  requireApi();
  const result = await api.addOffer(data);
  offers.push(result);
  cacheWrite("offers", offers);
  addAuditLog("create", "offer", result.id, result.name, `إضافة عرض: ${result.name}`);
  notify("offers");
  return result;
}

export async function updateOffer(id: string, data: Partial<Offer>) {
  requireApi();
  await api.updateOffer(id, data);
  const idx = offers.findIndex(o => o.id === id);
  if (idx >= 0) {
    offers[idx] = { ...offers[idx], ...data };
    cacheWrite("offers", offers);
    addAuditLog("update", "offer", id, data.name || offers[idx].name, `تعديل عرض: ${data.name || offers[idx].name}`);
    notify("offers");
  }
}

export async function deleteOffer(id: string) {
  requireApi();
  const idx = offers.findIndex(o => o.id === id);
  if (idx >= 0) {
    const name = offers[idx].name;
    await api.deleteOffer(id);
    offers.splice(idx, 1);
    cacheWrite("offers", offers);
    addAuditLog("delete", "offer", id, name, `حذف عرض: ${name}`);
    notify("offers");
  }
}

// ==============================
// CUSTOMERS
// ==============================
let lastAddedCustomer = "";
export function getCustomers(): Customer[] { return customersSnap; }
export function getLastAddedCustomer(): string { return lastAddedCustomer; }

export async function addCustomer(data: Omit<Customer, "id">): Promise<Customer> {
  requireApi();
  const result = await api.addCustomer(data);
  customers.push(result);
  lastAddedCustomer = result.fullName;
  cacheWrite("emp_customers", customers);
  notify("customers");
  return result;
}

export async function updateCustomer(id: string, data: Partial<Customer>) {
  requireApi();
  const existing = customers.find(c => c.id === id);
  try {
    await api.updateCustomer(id, { ...data, _updatedAt: (existing as any)?.updatedAt });
    const idx = customers.findIndex(c => c.id === id);
    if (idx >= 0) {
      customers[idx] = { ...customers[idx], ...data };
      cacheWrite("emp_customers", customers);
      notify("customers");
    }
  } catch (e: any) { handleConflict(e); }
}

export async function deleteCustomer(id: string) {
  requireApi();
  await api.deleteCustomer(id);
  const idx = customers.findIndex(c => c.id === id);
  if (idx >= 0) {
    customers.splice(idx, 1);
    cacheWrite("emp_customers", customers);
    notify("customers");
  }
}

// ==============================
// PRODUCTS
// ==============================
export function getProducts(): Product[] { return productsSnap; }

export async function addProduct(data: Omit<Product, "id">): Promise<Product> {
  requireApi();
  const result = await api.addProduct(data);
  products.push(result);
  cacheWrite("emp_products", products);
  notify("products");
  return result;
}

export async function updateProduct(id: string, data: Partial<Product>) {
  requireApi();
  const existing = products.find(p => p.id === id);
  try {
    await api.updateProduct(id, { ...data, _updatedAt: (existing as any)?.updatedAt });
    const idx = products.findIndex(p => p.id === id);
    if (idx >= 0) {
      products[idx] = { ...products[idx], ...data };
      cacheWrite("emp_products", products);
      notify("products");
    }
  } catch (e: any) { handleConflict(e); }
}

export async function deleteProduct(id: string) {
  requireApi();
  await api.deleteProduct(id);
  const idx = products.findIndex(p => p.id === id);
  if (idx >= 0) {
    products.splice(idx, 1);
    cacheWrite("emp_products", products);
    notify("products");
  }
}

// ==============================
// INVOICES
// ==============================
export function getInvoices(): Invoice[] { return invoicesSnap; }

export async function addInvoice(data: Omit<Invoice, "id">): Promise<Invoice> {
  requireApi();
  const result = await api.addInvoice(data);
  invoices.push(result);
  // Stock deduction handled by backend
  cacheWrite("emp_invoices", invoices);
  // Refresh products to get updated stock
  api.getProducts().then(p => { if (p) { products.length = 0; products.push(...p); cacheWrite("emp_products", products); notify("products"); } }).catch(() => {});
  notify("invoices", "stockMovements");
  return result;
}

export async function updateInvoice(id: string, data: Partial<Invoice>) {
  requireApi();
  const existing = invoices.find(i => i.id === id);
  try {
    await api.updateInvoice(id, { ...data, _updatedAt: (existing as any)?.updatedAt });
    const idx = invoices.findIndex(i => i.id === id);
    if (idx >= 0) {
      invoices[idx] = { ...invoices[idx], ...data };
      cacheWrite("emp_invoices", invoices);
      notify("invoices");
    }
  } catch (e: any) { handleConflict(e); }
}

export async function deleteInvoice(id: string) {
  requireApi();
  await api.deleteInvoice(id);
  const idx = invoices.findIndex(i => i.id === id);
  if (idx >= 0) {
    invoices.splice(idx, 1);
    cacheWrite("emp_invoices", invoices);
  }
  for (let i = receipts.length - 1; i >= 0; i--) {
    if (receipts[i].invoiceId === id) receipts.splice(i, 1);
  }
  cacheWrite("emp_receipts", receipts);
  api.getProducts().then(p => { if (p) { products.length = 0; products.push(...p); cacheWrite("emp_products", products); notify("products"); } }).catch(() => {});
  notify("invoices", "receipts", "products", "stockMovements");
}

// ==============================
// MANUFACTURING STATUS
// ==============================
export async function updateManufacturingStatus(invoiceId: string, status: ManufacturingStatus, mfgNotes?: string) {
  requireApi();
  const updateData: Partial<Invoice> = {
    manufacturingStatus: status,
    manufacturingNotes: mfgNotes,
    manufacturingUpdatedAt: new Date().toISOString(),
  };
  if (status === "delivered") {
    updateData.status = "تم التسليم";
  }
  await api.updateInvoice(invoiceId, updateData);
  const idx = invoices.findIndex(i => i.id === invoiceId);
  if (idx >= 0) {
    invoices[idx] = { ...invoices[idx], ...updateData };
    cacheWrite("emp_invoices", invoices);
    addAuditLog("update", "invoice", invoiceId, invoiceId, `تحديث حالة التصنيع: ${status}`);
    notify("invoices");
  }
}

// ==============================
// MANUFACTURING ORDERS (stored via API settings or dedicated endpoint)
// ==============================
export function getManufacturingOrders(): ManufacturingOrder[] { return mfgOrdersSnap; }

export function addManufacturingOrder(data: Omit<ManufacturingOrder, "id" | "createdAt" | "updatedAt">): ManufacturingOrder {
  const now = new Date().toISOString();
  const order: ManufacturingOrder = {
    id: nextId("MFG", manufacturingOrders),
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  manufacturingOrders.push(order);
  cacheWrite("manufacturingOrders", manufacturingOrders);
  addAuditLog("create", "invoice", order.id, order.invoiceId, `إنشاء طلب تصنيع للفاتورة ${data.invoiceId}`);
  notify("mfgOrders");
  return order;
}

export function updateManufacturingOrder(id: string, data: Partial<ManufacturingOrder>) {
  const idx = manufacturingOrders.findIndex(o => o.id === id);
  if (idx >= 0) {
    manufacturingOrders[idx] = { ...manufacturingOrders[idx], ...data, updatedAt: new Date().toISOString() };
    cacheWrite("manufacturingOrders", manufacturingOrders);
    notify("mfgOrders");
  }
}

export function deleteManufacturingOrder(id: string) {
  const idx = manufacturingOrders.findIndex(o => o.id === id);
  if (idx >= 0) {
    manufacturingOrders.splice(idx, 1);
    cacheWrite("manufacturingOrders", manufacturingOrders);
    notify("mfgOrders");
  }
}

// ==============================
// RECURRING INVOICES
// ==============================
export async function createRecurringTemplate(data: Omit<Invoice, "id">, interval: RecurringInterval): Promise<Invoice> {
  const nextDate = calculateNextDate(new Date().toISOString().split("T")[0], interval);
  return addInvoice({
    ...data,
    isRecurring: true,
    recurringInterval: interval,
    recurringNextDate: nextDate,
  });
}

export async function processRecurringInvoices(): Promise<Invoice[]> {
  requireApi();
  const today = new Date().toISOString().split("T")[0];
  const created: Invoice[] = [];

  const recurringInvoices = invoices.filter(i => i.isRecurring && i.recurringNextDate && i.recurringNextDate <= today);

  for (const template of recurringInvoices) {
    const newInv = await addInvoice({
      customer: template.customer,
      branch: template.branch,
      employee: template.employee,
      date: today,
      deliveryDate: "",
      items: [...template.items],
      status: "مسودة",
      paidTotal: 0,
      commissionPercent: template.commissionPercent,
      notes: `فاتورة متكررة من ${template.id}`,
      recurringTemplateId: template.id,
    });
    created.push(newInv);

    if (template.recurringInterval) {
      await updateInvoice(template.id, {
        recurringNextDate: calculateNextDate(today, template.recurringInterval),
      });
    }
  }

  return created;
}

function calculateNextDate(fromDate: string, interval: RecurringInterval): string {
  const date = new Date(fromDate);
  switch (interval) {
    case "weekly": date.setDate(date.getDate() + 7); break;
    case "monthly": date.setMonth(date.getMonth() + 1); break;
    case "quarterly": date.setMonth(date.getMonth() + 3); break;
    case "yearly": date.setFullYear(date.getFullYear() + 1); break;
  }
  return date.toISOString().split("T")[0];
}

// ==============================
// INSTALLMENT SCHEDULING
// ==============================
export async function setInstallmentSchedule(invoiceId: string, nextDueDate: string, count?: number) {
  await updateInvoice(invoiceId, { nextDueDate, installmentCount: count });
}

export function getOverdueInstallments(): { invoice: Invoice; daysOverdue: number; remaining: number }[] {
  const today = new Date();
  const result: { invoice: Invoice; daysOverdue: number; remaining: number }[] = [];

  for (const inv of invoices) {
    const total = inv.items.reduce((s, i) => s + i.qty * i.unitPrice - i.lineDiscount, 0) - (inv.appliedDiscount || 0);
    const remaining = total - inv.paidTotal;
    if (remaining <= 0) continue;

    if (inv.nextDueDate) {
      const dueDate = new Date(inv.nextDueDate);
      const diffDays = Math.floor((today.getTime() - dueDate.getTime()) / 86400000);
      if (diffDays >= 0) {
        result.push({ invoice: inv, daysOverdue: diffDays, remaining });
      }
    }
  }

  return result.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

export function getUpcomingInstallments(daysAhead: number = 7): { invoice: Invoice; daysUntilDue: number; remaining: number }[] {
  const today = new Date();
  const result: { invoice: Invoice; daysUntilDue: number; remaining: number }[] = [];

  for (const inv of invoices) {
    const total = inv.items.reduce((s, i) => s + i.qty * i.unitPrice - i.lineDiscount, 0) - (inv.appliedDiscount || 0);
    const remaining = total - inv.paidTotal;
    if (remaining <= 0) continue;

    if (inv.nextDueDate) {
      const dueDate = new Date(inv.nextDueDate);
      const diffDays = Math.floor((dueDate.getTime() - today.getTime()) / 86400000);
      if (diffDays > 0 && diffDays <= daysAhead) {
        result.push({ invoice: inv, daysUntilDue: diffDays, remaining });
      }
    }
  }

  return result.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

// ==============================
// EMPLOYEES
// ==============================
export function getEmployees(): Employee[] { return employeesSnap; }

export async function addEmployee(data: Omit<Employee, "id">): Promise<Employee> {
  requireApi();
  const result = await api.addEmployee(data);
  employees.push(result);
  cacheWrite("emp_employees", employees);
  notify("employees");
  return result;
}

export async function updateEmployee(id: string, data: Partial<Employee>) {
  requireApi();
  const existing = employees.find(e => e.id === id);
  try {
    await api.updateEmployee(id, { ...data, _updatedAt: (existing as any)?.updatedAt });
    const idx = employees.findIndex(e => e.id === id);
    if (idx >= 0) {
      employees[idx] = { ...employees[idx], ...data };
      cacheWrite("emp_employees", employees);
      notify("employees");
    }
  } catch (e: any) { handleConflict(e); }
}

export async function deleteEmployee(id: string) {
  requireApi();
  await api.deleteEmployee(id);
  const idx = employees.findIndex(e => e.id === id);
  if (idx >= 0) {
    employees.splice(idx, 1);
    cacheWrite("emp_employees", employees);
    notify("employees");
  }
}

// ==============================
// BRANCHES
// ==============================
export function getBranches(): Branch[] { return branchesSnap; }

export async function addBranch(data: Omit<Branch, "id">): Promise<Branch> {
  requireApi();
  const result = await api.addBranch(data);
  branches.push(result);
  cacheWrite("emp_branches", branches);
  notify("branches");
  return result;
}

export async function updateBranch(id: string, data: Partial<Branch>) {
  requireApi();
  await api.updateBranch(id, data);
  const idx = branches.findIndex(b => b.id === id);
  if (idx >= 0) {
    branches[idx] = { ...branches[idx], ...data };
    cacheWrite("emp_branches", branches);
    notify("branches");
  }
}

export async function deleteBranch(id: string) {
  requireApi();
  await api.deleteBranch(id);
  const idx = branches.findIndex(b => b.id === id);
  if (idx >= 0) {
    branches.splice(idx, 1);
    cacheWrite("emp_branches", branches);
    notify("branches");
  }
}

// ==============================
// RECEIPTS (Installments)
// ==============================
export function getReceipts(): Receipt[] { return receiptsSnap; }

export async function addReceipt(data: Omit<Receipt, "id">): Promise<Receipt> {
  requireApi();
  const result = await api.addReceipt(data);
  receipts.push(result);
  // Update invoice paid total locally
  if (data.invoiceId) {
    const invIdx = invoices.findIndex(i => i.id === data.invoiceId);
    if (invIdx >= 0) {
      invoices[invIdx] = { ...invoices[invIdx], paidTotal: invoices[invIdx].paidTotal + data.amount };
      cacheWrite("emp_invoices", invoices);
    }
  }
  cacheWrite("emp_receipts", receipts);
  notify("receipts", "invoices");
  return result;
}

export async function updateReceipt(id: string, data: Partial<Receipt>) {
  requireApi();
  await api.updateReceipt(id, data);
  const idx = receipts.findIndex(r => r.id === id);
  if (idx >= 0) {
    const old = receipts[idx];
    const updated = { ...old, ...data };
    if (data.amount !== undefined && data.amount !== old.amount) {
      const invIdx = invoices.findIndex(i => i.id === old.invoiceId);
      if (invIdx >= 0) {
        invoices[invIdx] = { ...invoices[invIdx], paidTotal: invoices[invIdx].paidTotal - old.amount + updated.amount };
        cacheWrite("emp_invoices", invoices);
      }
    }
    receipts[idx] = updated;
    cacheWrite("emp_receipts", receipts);
    notify("receipts", "invoices");
  }
}

export async function deleteReceipt(id: string) {
  requireApi();
  const idx = receipts.findIndex(r => r.id === id);
  if (idx >= 0) {
    const old = receipts[idx];
    await api.deleteReceipt(id);
    const invIdx = invoices.findIndex(i => i.id === old.invoiceId);
    if (invIdx >= 0) {
      invoices[invIdx] = { ...invoices[invIdx], paidTotal: Math.max(0, invoices[invIdx].paidTotal - old.amount) };
      cacheWrite("emp_invoices", invoices);
    }
    receipts.splice(idx, 1);
    cacheWrite("emp_receipts", receipts);
    notify("receipts", "invoices");
  }
}

// ==============================
// STOCK MOVEMENT MANUAL ADD
// ==============================
export async function addManualStockMovement(productId: string, productName: string, type: StockMovement["type"], qty: number, reason: string) {
  requireApi();
  const sm = {
    productId, productName, type, qty,
    date: new Date().toISOString(),
    reason,
  };
  await api.addStockMovement(sm);
  recordStockMovement(productName, type, qty, reason);
  const pIdx = products.findIndex(p => p.id === productId);
  if (pIdx >= 0) {
    if (type === "in" || type === "return") {
      products[pIdx] = { ...products[pIdx], stock: products[pIdx].stock + qty };
    } else {
      products[pIdx] = { ...products[pIdx], stock: Math.max(0, products[pIdx].stock - qty) };
    }
    await api.updateProduct(productId, { stock: products[pIdx].stock });
    cacheWrite("emp_products", products);
  }
  notify("products", "stockMovements");
}

// ==============================
// EXPENSES
// ==============================
export function getExpenses(): Expense[] { return expensesSnap; }

export async function addExpense(data: Omit<Expense, "id">): Promise<Expense> {
  requireApi();
  const result = await api.addExpense(data);
  expensesList.push(result);
  cacheWrite("expenses", expensesList);
  notify("expenses");
  return result;
}

export async function updateExpense(id: string, data: Partial<Expense>) {
  requireApi();
  await api.updateExpense(id, data);
  const idx = expensesList.findIndex(e => e.id === id);
  if (idx >= 0) {
    expensesList[idx] = { ...expensesList[idx], ...data };
    cacheWrite("expenses", expensesList);
    notify("expenses");
  }
}

export async function deleteExpense(id: string) {
  requireApi();
  await api.deleteExpense(id);
  const idx = expensesList.findIndex(e => e.id === id);
  if (idx >= 0) {
    expensesList.splice(idx, 1);
    cacheWrite("expenses", expensesList);
    notify("expenses");
  }
}

// ==============================
// AUTH — API-FIRST (overrides store.auth.ts exports)
// ==============================
import {
  addSecurityEvent as _addSecurityEvent,
  getSecurityLog as _getSecurityLog,
  clearSecurityLog as _clearSecurityLog,
} from "./store.auth";
import { checkRateLimit, recordLoginAttempt, sanitizeEmail } from "@/utils/security";

export const getSecurityLog = _getSecurityLog;
export const addSecurityEvent = _addSecurityEvent;
export const clearSecurityLog = _clearSecurityLog;

// ---- Auto-attendance on login ----
async function recordAutoAttendance(email: string, userName: string) {
  if (!apiConnected) return;
  const emp = employees.find(e => e.email && e.email.toLowerCase() === email.toLowerCase());
  if (!emp) return;
  const todayStr = new Date().toISOString().split("T")[0];
  const alreadyRecorded = attendance.find(a => a.employeeId === emp.id && a.date === todayStr);
  if (alreadyRecorded) return;

  // Find current active shift matching employee branch
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const matchingShift = shifts.find(s => s.active && (!s.branch || s.branch === emp.branch));

  const record: Omit<AttendanceRecord, "id"> = {
    employeeId: emp.id,
    employeeName: emp.name,
    shiftId: matchingShift?.id || "",
    shiftName: matchingShift?.name || "تلقائي",
    date: todayStr,
    checkIn: currentTime,
    checkOut: "",
    hoursWorked: 0,
    status: "present",
    overtimeHours: 0,
    notes: "تسجيل تلقائي عند الدخول",
  };

  try {
    await addAttendance(record);
  } catch {}
}

export async function login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  const cleanEmail = sanitizeEmail(email);

  const rateCheck = checkRateLimit(cleanEmail);
  if (!rateCheck.allowed) {
    const minutes = Math.ceil((rateCheck.lockedUntilMs || 0) / 60000);
    _addSecurityEvent("login_failed", cleanEmail, "محاولات كثيرة");
    return { success: false, error: `تم تجاوز الحد المسموح. حاول بعد ${minutes} دقيقة` };
  }

  try {
    const user = await api.loginUser(cleanEmail, password);
    if (!user || user.error) {
      recordLoginAttempt(cleanEmail, false);
      _addSecurityEvent("login_failed", cleanEmail, "");
      const remaining = rateCheck.remainingAttempts - 1;
      return {
        success: false,
        error: remaining > 0
          ? `البريد الإلكتروني أو كلمة المرور غير صحيحة. متبقي ${remaining} محاولات`
          : "تم تجاوز الحد المسموح. حاول لاحقاً"
      };
    }

    recordLoginAttempt(cleanEmail, true);
    // Store session
    const sessionToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("currentUserId", user.id);
    localStorage.setItem("sessionToken", sessionToken);
    localStorage.setItem("sessionExpiry", String(Date.now() + 8 * 60 * 60 * 1000));
    // Store user data for session restore
    localStorage.setItem("currentUserData", JSON.stringify(user));

    // Import and set current user in auth module
    const { _setCurrentUser } = await import("./store.auth");
    _setCurrentUser(user);

    _addSecurityEvent("login_success", cleanEmail, user.name);

    // Auto-record attendance for the logged-in employee
    recordAutoAttendance(cleanEmail, user.name).catch(() => {});

    return { success: true };
  } catch (e: any) {
    return { success: false, error: "فشل الاتصال بالخادم. تأكد من تشغيل الخادم." };
  }
}

// Sync getter for React hooks — returns cached users list
// usersCache declared at top with other arrays

export function getUsersSync(): UserAccount[] { return usersCache; }

export async function getUsers(): Promise<UserAccount[]> {
  try {
    const users = await api.getUsers();
    usersCache = users || [];
    notify("users");
    return usersCache;
  } catch {
    return usersCache;
  }
}

export async function addUser(data: Omit<UserAccount, "id">): Promise<UserAccount> {
  requireApi();
  const result = await api.addUser(data);
  addAuditLog("create", "settings", result.id, result.name, `إضافة مستخدم: ${result.name} (${result.role})`);
  notify("users");
  return result;
}

export async function updateUser(id: string, data: Partial<UserAccount>) {
  requireApi();
  await api.updateUser(id, data);
  addAuditLog("update", "settings", id, data.name || id, `تعديل مستخدم`);
  notify("users");
}

export async function deleteUser(id: string) {
  requireApi();
  await api.deleteUser(id);
  addAuditLog("delete", "settings", id, id, `حذف مستخدم`);
  notify("users");
}

// ==============================
// INITIALIZATION ON LOAD
// ==============================
if (typeof window !== "undefined") {
  // Listen for Electron backend status
  const emperorAPI = (window as any).emperorAPI;
  if (emperorAPI?.onBackendStatus) {
    emperorAPI.onBackendStatus((status: { connected: boolean }) => {
      apiConnected = status.connected;
      if (status.connected && !apiInitialized) {
        initializeStore();
      }
    });
  }

  // Auto-initialize
  initializeStore();
  startPeriodicSync();
}
