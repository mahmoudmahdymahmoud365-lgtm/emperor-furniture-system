// ==============================
// In-Memory Data Store — Main Orchestrator
// Re-exports from modular files + entity CRUD
// ==============================

import type {
  Customer, Product, Invoice, Employee, Branch, Receipt, CompanySettings,
  AuditLogEntry, AuditAction, AuditEntity, UserAccount, RolePermissions,
  Offer, StockMovement, ProductReturn, Shift, AttendanceRecord, SecurityEvent,
  Expense, ManufacturingStatus, RecurringInterval,
} from "./types";
import { DEFAULT_PERMISSIONS } from "./types";
import { loadFromStorage, saveToStorage, nextId, subscribe as coreSub, notifyListeners } from "./store.core";

// ---- Re-export core ----
export { subscribe } from "./store.core";

// ---- Re-export auth ----
export {
  getUsers, getCurrentUser, getUserPermissions,
  addUser, updateUser, deleteUser,
  isAuthenticated, login, logout,
  getSecurityLog, addSecurityEvent, clearSecurityLog,
  rebuildUsersSnap, rebuildSecurityLogSnap,
  setAuthDeps,
} from "./store.auth";

import {
  getCurrentUser, rebuildUsersSnap, rebuildSecurityLogSnap, setAuthDeps,
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
  notify("settings");
}

// ==============================
// AUDIT LOG
// ==============================
const auditLog: AuditLogEntry[] = loadFromStorage("auditLog", []);
let auditLogSnap: AuditLogEntry[] = [...auditLog];

function saveAuditLog() { saveToStorage("auditLog", auditLog); }

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
  saveAuditLog();
  auditLogSnap = [...auditLog];
}

export function clearAuditLog() {
  auditLog.length = 0;
  saveAuditLog();
  auditLogSnap = [];
  notify("auditLog");
}

// ---- Seed data ----
const SEED_CUSTOMERS: Customer[] = [
  { id: "C001", fullName: "أحمد محمد علي", nationalId: "29901011234567", phone: "01012345678", address: "شارع التحرير", governorate: "القاهرة", jobTitle: "مهندس", notes: "" },
  { id: "C002", fullName: "سارة أحمد حسن", nationalId: "30001021234567", phone: "01098765432", address: "شارع الهرم", governorate: "الجيزة", jobTitle: "طبيبة", notes: "عميل مميز" },
  { id: "C003", fullName: "محمود حسن إبراهيم", nationalId: "28501031234567", phone: "01112345678", address: "شارع النصر", governorate: "الإسكندرية", jobTitle: "تاجر", notes: "" },
];

const SEED_PRODUCTS: Product[] = [
  { id: "P001", name: "غرفة نوم كاملة", category: "غرف نوم", defaultPrice: 25000, unit: "قطعة", stock: 10, minStock: 2, notes: "" },
  { id: "P002", name: "طقم أنتريه مودرن", category: "أنتريهات", defaultPrice: 18000, unit: "قطعة", stock: 8, minStock: 2, notes: "" },
  { id: "P003", name: "مطبخ ألوميتال", category: "مطابخ", defaultPrice: 15000, unit: "متر", stock: 50, minStock: 10, notes: "" },
  { id: "P004", name: "غرفة سفرة ٨ كراسي", category: "سفرة", defaultPrice: 22000, unit: "قطعة", stock: 5, minStock: 1, notes: "" },
  { id: "P005", name: "دولاب ملابس", category: "غرف نوم", defaultPrice: 8000, unit: "قطعة", stock: 15, minStock: 3, notes: "" },
];

const SEED_INVOICES: Invoice[] = [
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

const SEED_EMPLOYEES: Employee[] = [
  { id: "E001", name: "محمد سعيد", nationalId: "29001011234567", phone: "01011111111", branch: "القاهرة", monthlySalary: 5000, role: "مبيعات", active: true },
  { id: "E002", name: "علي حسن", nationalId: "29101021234567", phone: "01022222222", branch: "الجيزة", monthlySalary: 4500, role: "مبيعات", active: true },
  { id: "E003", name: "نورا أحمد", nationalId: "29201031234567", phone: "01033333333", branch: "القاهرة", monthlySalary: 6000, role: "محاسب", active: true },
];

const SEED_BRANCHES: Branch[] = [
  { id: "B001", name: "فرع القاهرة", address: "شارع التحرير - القاهرة", rent: 15000, active: true },
  { id: "B002", name: "فرع الجيزة", address: "شارع الهرم - الجيزة", rent: 12000, active: true },
  { id: "B003", name: "فرع الإسكندرية", address: "كورنيش الإسكندرية", rent: 10000, active: false },
];

const SEED_RECEIPTS: Receipt[] = [
  { id: "R001", invoiceId: "INV-001", customer: "أحمد محمد علي", amount: 10000, date: "2025-06-15", method: "نقدي", notes: "" },
  { id: "R002", invoiceId: "INV-001", customer: "أحمد محمد علي", amount: 5000, date: "2025-06-20", method: "تحويل بنكي", notes: "دفعة ثانية" },
];

const SEED_SHIFTS: Shift[] = [
  { id: "SH001", name: "صباحي", startTime: "08:00", endTime: "16:00", hours: 8, branch: "القاهرة", active: true, notes: "" },
  { id: "SH002", name: "مسائي", startTime: "16:00", endTime: "00:00", hours: 8, branch: "القاهرة", active: true, notes: "" },
  { id: "SH003", name: "مرن", startTime: "10:00", endTime: "18:00", hours: 8, branch: "الجيزة", active: true, notes: "" },
];

// ---- Load all data ----
const customers: Customer[] = loadFromStorage("emp_customers", SEED_CUSTOMERS);
const products: Product[] = loadFromStorage("emp_products", SEED_PRODUCTS);
const invoices: Invoice[] = loadFromStorage("emp_invoices", SEED_INVOICES);
const employees: Employee[] = loadFromStorage("emp_employees", SEED_EMPLOYEES);
const branches: Branch[] = loadFromStorage("emp_branches", SEED_BRANCHES);
const receipts: Receipt[] = loadFromStorage("emp_receipts", SEED_RECEIPTS);
const offers: Offer[] = loadFromStorage("offers", []);
const stockMovements: StockMovement[] = loadFromStorage("stockMovements", []);
const productReturns: ProductReturn[] = loadFromStorage("productReturns", []);
const shifts: Shift[] = loadFromStorage("shifts", SEED_SHIFTS);
const attendance: AttendanceRecord[] = loadFromStorage("attendance", []);
const expensesList: Expense[] = loadFromStorage("expenses", []);

// ---- Save functions ----
function saveCustomers() { saveToStorage("emp_customers", customers); }
function saveProducts() { saveToStorage("emp_products", products); }
function saveInvoices() { saveToStorage("emp_invoices", invoices); }
function saveEmployees() { saveToStorage("emp_employees", employees); }
function saveBranches() { saveToStorage("emp_branches", branches); }
function saveReceipts() { saveToStorage("emp_receipts", receipts); }
function saveOffers() { saveToStorage("offers", offers); }
function saveStockMovements() { saveToStorage("stockMovements", stockMovements); }
function saveReturns() { saveToStorage("productReturns", productReturns); }
function saveShifts() { saveToStorage("shifts", shifts); }
function saveAttendance() { saveToStorage("attendance", attendance); }
function saveExpenses() { saveToStorage("expenses", expensesList); }

// ---- Snapshots ----
let customersSnap: Customer[] = [...customers];
let productsSnap: Product[] = [...products];
let invoicesSnap: Invoice[] = [...invoices];
let employeesSnap: Employee[] = [...employees];
let branchesSnap: Branch[] = [...branches];
let receiptsSnap: Receipt[] = [...receipts];
let offersSnap: Offer[] = [...offers];
let stockMovementsSnap: StockMovement[] = [...stockMovements];
let returnsSnap: ProductReturn[] = [...productReturns];
let shiftsSnap: Shift[] = [...shifts];
let attendanceSnap: AttendanceRecord[] = [...attendance];
let expensesSnap: Expense[] = [...expensesList];

let dirtyFlags = new Set<string>();
function markDirty(entity: string) { dirtyFlags.add(entity); }

function rebuildSnapshots() {
  if (dirtyFlags.has("all") || dirtyFlags.size === 0) {
    customersSnap = [...customers]; productsSnap = [...products]; invoicesSnap = [...invoices];
    employeesSnap = [...employees]; branchesSnap = [...branches]; receiptsSnap = [...receipts];
    auditLogSnap = [...auditLog]; offersSnap = [...offers];
    stockMovementsSnap = [...stockMovements]; returnsSnap = [...productReturns];
    shiftsSnap = [...shifts]; attendanceSnap = [...attendance]; expensesSnap = [...expensesList];
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
  }
  dirtyFlags = new Set();
}

function notify(...entities: string[]) {
  for (const e of entities) markDirty(e);
  markDirty("auditLog");
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
    users: [], // users handled by auth module
    auditLog: [...auditLog],
  };
}

export function importBackup(jsonStr: string): boolean {
  try {
    const data = JSON.parse(jsonStr);
    if (!data.version) return false;

    customers.length = 0; products.length = 0; invoices.length = 0;
    employees.length = 0; branches.length = 0; receipts.length = 0;
    auditLog.length = 0; offers.length = 0;
    stockMovements.length = 0; productReturns.length = 0;
    shifts.length = 0; attendance.length = 0; expensesList.length = 0;

    (data.customers || []).forEach((c: Customer) => customers.push(c));
    (data.products || []).forEach((p: Product) => products.push(p));
    (data.invoices || []).forEach((i: Invoice) => invoices.push(i));
    (data.employees || []).forEach((e: Employee) => employees.push(e));
    (data.branches || []).forEach((b: Branch) => branches.push(b));
    (data.receipts || []).forEach((r: Receipt) => receipts.push(r));
    (data.auditLog || []).forEach((a: AuditLogEntry) => auditLog.push(a));
    (data.offers || []).forEach((o: Offer) => offers.push(o));
    (data.stockMovements || []).forEach((sm: StockMovement) => stockMovements.push(sm));
    (data.productReturns || []).forEach((r: ProductReturn) => productReturns.push(r));
    (data.shifts || []).forEach((s: Shift) => shifts.push(s));
    (data.attendance || []).forEach((a: AttendanceRecord) => attendance.push(a));
    (data.expenses || []).forEach((e: Expense) => expensesList.push(e));

    if (data.settings) {
      companySettings = { ...DEFAULT_SETTINGS, ...data.settings };
      localStorage.setItem("companySettings", JSON.stringify(companySettings));
    }

    saveCustomers(); saveProducts(); saveInvoices();
    saveEmployees(); saveBranches(); saveReceipts();
    saveAuditLog(); saveOffers(); saveStockMovements();
    saveReturns(); saveShifts(); saveAttendance(); saveExpenses();

    addAuditLog("update", "settings", "backup", "نسخ احتياطي", "استعادة نسخة احتياطية");
    notify("all");
    return true;
  } catch {
    return false;
  }
}

setBackupDeps(getBackupData, importBackup);

// ==============================
// STOCK MOVEMENTS
// ==============================
function recordStockMovement(productName: string, type: StockMovement["type"], qty: number, reason: string, relatedId?: string) {
  const product = products.find(p => p.name === productName);
  stockMovements.unshift({
    id: `SM${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    productId: product?.id || "",
    productName, type, qty,
    date: new Date().toISOString(),
    reason, relatedId,
  });
  if (stockMovements.length > 2000) stockMovements.splice(2000);
  saveStockMovements();
  stockMovementsSnap = [...stockMovements];
}

export function getStockMovements(): StockMovement[] { return stockMovementsSnap; }

// ==============================
// RETURNS
// ==============================
export function getReturns(): ProductReturn[] { return returnsSnap; }

export function addReturn(data: Omit<ProductReturn, "id">): ProductReturn {
  const r: ProductReturn = { id: nextId("RET", productReturns), ...data };
  productReturns.push(r);
  for (const item of r.items) {
    const pIdx = products.findIndex(p => p.name === item.productName);
    if (pIdx >= 0) {
      products[pIdx] = { ...products[pIdx], stock: products[pIdx].stock + item.qty };
      recordStockMovement(item.productName, "return", item.qty, `مرتجع ${r.id}`, r.id);
    }
  }
  const invIdx = invoices.findIndex(i => i.id === r.invoiceId);
  if (invIdx >= 0) {
    invoices[invIdx] = { ...invoices[invIdx], paidTotal: Math.max(0, invoices[invIdx].paidTotal - r.totalAmount) };
    saveInvoices();
  }
  saveReturns(); saveProducts();
  addAuditLog("create", "return", r.id, r.id, `مرتجع: ${r.id} من فاتورة ${r.invoiceId}`);
  notify("returns", "products", "invoices", "stockMovements");
  return r;
}

// ==============================
// SHIFTS
// ==============================
export function getShifts(): Shift[] { return shiftsSnap; }

export function addShift(data: Omit<Shift, "id">): Shift {
  const s: Shift = { id: nextId("SH", shifts), ...data };
  shifts.push(s); saveShifts();
  addAuditLog("create", "shift", s.id, s.name, `إضافة شفت: ${s.name}`);
  notify("shifts"); return s;
}

export function updateShift(id: string, data: Partial<Shift>) {
  const idx = shifts.findIndex(s => s.id === id);
  if (idx >= 0) {
    shifts[idx] = { ...shifts[idx], ...data }; saveShifts();
    addAuditLog("update", "shift", id, shifts[idx].name, `تعديل شفت: ${shifts[idx].name}`);
    notify("shifts");
  }
}

export function deleteShift(id: string) {
  const idx = shifts.findIndex(s => s.id === id);
  if (idx >= 0) {
    const name = shifts[idx].name; shifts.splice(idx, 1); saveShifts();
    addAuditLog("delete", "shift", id, name, `حذف شفت: ${name}`);
    notify("shifts");
  }
}

// ==============================
// ATTENDANCE
// ==============================
export function getAttendance(): AttendanceRecord[] { return attendanceSnap; }

export function addAttendance(data: Omit<AttendanceRecord, "id">): AttendanceRecord {
  const a: AttendanceRecord = { id: nextId("ATT", attendance), ...data };
  attendance.push(a); saveAttendance();
  addAuditLog("create", "attendance", a.id, a.employeeName, `تسجيل حضور: ${a.employeeName} (${a.status})`);
  notify("attendance"); return a;
}

export function updateAttendance(id: string, data: Partial<AttendanceRecord>) {
  const idx = attendance.findIndex(a => a.id === id);
  if (idx >= 0) {
    attendance[idx] = { ...attendance[idx], ...data }; saveAttendance();
    addAuditLog("update", "attendance", id, attendance[idx].employeeName, `تعديل حضور: ${attendance[idx].employeeName}`);
    notify("attendance");
  }
}

export function deleteAttendance(id: string) {
  const idx = attendance.findIndex(a => a.id === id);
  if (idx >= 0) {
    const name = attendance[idx].employeeName; attendance.splice(idx, 1); saveAttendance();
    addAuditLog("delete", "attendance", id, name, `حذف سجل حضور: ${name}`);
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

export function addOffer(data: Omit<Offer, "id">): Offer {
  const o = { id: nextId("OF", offers), ...data };
  offers.push(o); saveOffers();
  addAuditLog("create", "offer", o.id, o.name, `إضافة عرض: ${o.name}`);
  notify("offers"); return o;
}

export function updateOffer(id: string, data: Partial<Offer>) {
  const idx = offers.findIndex((o) => o.id === id);
  if (idx >= 0) {
    const name = offers[idx].name;
    offers[idx] = { ...offers[idx], ...data }; saveOffers();
    addAuditLog("update", "offer", id, data.name || name, `تعديل عرض: ${data.name || name}`);
    notify("offers");
  }
}

export function deleteOffer(id: string) {
  const idx = offers.findIndex((o) => o.id === id);
  if (idx >= 0) {
    const name = offers[idx].name; offers.splice(idx, 1); saveOffers();
    addAuditLog("delete", "offer", id, name, `حذف عرض: ${name}`);
    notify("offers");
  }
}

// Track last added customer
let lastAddedCustomer = "";

// ==============================
// CUSTOMERS
// ==============================
export function getCustomers(): Customer[] { return customersSnap; }
export function getLastAddedCustomer(): string { return lastAddedCustomer; }

export function addCustomer(data: Omit<Customer, "id">): Customer {
  const c = { id: nextId("C", customers), ...data };
  customers.push(c); lastAddedCustomer = c.fullName; saveCustomers();
  notify("customers"); return c;
}

export function updateCustomer(id: string, data: Partial<Customer>) {
  const idx = customers.findIndex((c) => c.id === id);
  if (idx >= 0) {
    customers[idx] = { ...customers[idx], ...data }; saveCustomers();
    notify("customers");
  }
}

export function deleteCustomer(id: string) {
  const idx = customers.findIndex((c) => c.id === id);
  if (idx >= 0) {
    customers.splice(idx, 1); saveCustomers();
    notify("customers");
  }
}

// ==============================
// PRODUCTS
// ==============================
export function getProducts(): Product[] { return productsSnap; }

export function addProduct(data: Omit<Product, "id">): Product {
  const p = { id: nextId("P", products), ...data };
  products.push(p); saveProducts();
  notify("products"); return p;
}

export function updateProduct(id: string, data: Partial<Product>) {
  const idx = products.findIndex((p) => p.id === id);
  if (idx >= 0) {
    products[idx] = { ...products[idx], ...data }; saveProducts();
    notify("products");
  }
}

export function deleteProduct(id: string) {
  const idx = products.findIndex((p) => p.id === id);
  if (idx >= 0) {
    products.splice(idx, 1); saveProducts();
    notify("products");
  }
}

// ==============================
// INVOICES
// ==============================
export function getInvoices(): Invoice[] { return invoicesSnap; }

export function addInvoice(data: Omit<Invoice, "id">): Invoice {
  const inv = { id: nextId("INV-", invoices), ...data };
  invoices.push(inv);
  for (const item of inv.items) {
    const pIdx = products.findIndex(p => p.name === item.productName);
    if (pIdx >= 0) {
      products[pIdx] = { ...products[pIdx], stock: Math.max(0, products[pIdx].stock - item.qty) };
      recordStockMovement(item.productName, "out", item.qty, `فاتورة ${inv.id}`, inv.id);
    }
  }
  saveInvoices(); saveProducts();
  notify("invoices", "products", "stockMovements"); return inv;
}

export function updateInvoice(id: string, data: Partial<Invoice>) {
  const idx = invoices.findIndex((i) => i.id === id);
  if (idx >= 0) {
    invoices[idx] = { ...invoices[idx], ...data }; saveInvoices();
    notify("invoices");
  }
}

export function deleteInvoice(id: string) {
  const idx = invoices.findIndex((i) => i.id === id);
  if (idx >= 0) {
    const inv = invoices[idx];
    for (const item of inv.items) {
      const pIdx = products.findIndex(p => p.name === item.productName);
      if (pIdx >= 0) {
        products[pIdx] = { ...products[pIdx], stock: products[pIdx].stock + item.qty };
        recordStockMovement(item.productName, "in", item.qty, `حذف فاتورة ${id} (استرجاع)`, id);
      }
    }
    invoices.splice(idx, 1); saveInvoices(); saveProducts();
    notify("invoices", "products", "stockMovements");
  }
}

// ==============================
// MANUFACTURING STATUS
// ==============================
export function updateManufacturingStatus(invoiceId: string, status: ManufacturingStatus, mfgNotes?: string) {
  const idx = invoices.findIndex(i => i.id === invoiceId);
  if (idx >= 0) {
    invoices[idx] = {
      ...invoices[idx],
      manufacturingStatus: status,
      manufacturingNotes: mfgNotes ?? invoices[idx].manufacturingNotes,
      manufacturingUpdatedAt: new Date().toISOString(),
    };
    if (status === "delivered" && invoices[idx].status !== "تم التسليم") {
      invoices[idx].status = "تم التسليم";
    }
    saveInvoices();
    addAuditLog("update", "invoice", invoiceId, invoiceId, `تحديث حالة التصنيع: ${status}`);
    notify("invoices");
  }
}

// ==============================
// RECURRING INVOICES
// ==============================
export function createRecurringTemplate(data: Omit<Invoice, "id">, interval: RecurringInterval): Invoice {
  const nextDate = calculateNextDate(new Date().toISOString().split("T")[0], interval);
  const inv = addInvoice({
    ...data,
    isRecurring: true,
    recurringInterval: interval,
    recurringNextDate: nextDate,
  });
  addAuditLog("create", "invoice", inv.id, inv.id, `إنشاء فاتورة متكررة (${interval})`);
  return inv;
}

export function processRecurringInvoices(): Invoice[] {
  const today = new Date().toISOString().split("T")[0];
  const created: Invoice[] = [];
  
  const recurringInvoices = invoices.filter(i => i.isRecurring && i.recurringNextDate && i.recurringNextDate <= today);
  
  for (const template of recurringInvoices) {
    // Create new invoice from template
    const newInv = addInvoice({
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
    
    // Update next date on template
    const idx = invoices.findIndex(i => i.id === template.id);
    if (idx >= 0 && template.recurringInterval) {
      invoices[idx] = {
        ...invoices[idx],
        recurringNextDate: calculateNextDate(today, template.recurringInterval),
      };
      saveInvoices();
    }
  }
  
  if (created.length > 0) {
    notify("invoices");
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
export function setInstallmentSchedule(invoiceId: string, nextDueDate: string, count?: number) {
  const idx = invoices.findIndex(i => i.id === invoiceId);
  if (idx >= 0) {
    invoices[idx] = {
      ...invoices[idx],
      nextDueDate,
      installmentCount: count ?? invoices[idx].installmentCount,
    };
    saveInvoices();
    notify("invoices");
  }
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

//
// ==============================
export function getEmployees(): Employee[] { return employeesSnap; }

export function addEmployee(data: Omit<Employee, "id">): Employee {
  const e = { id: nextId("E", employees), ...data };
  employees.push(e); saveEmployees();
  notify("employees"); return e;
}

export function updateEmployee(id: string, data: Partial<Employee>) {
  const idx = employees.findIndex((e) => e.id === id);
  if (idx >= 0) {
    employees[idx] = { ...employees[idx], ...data }; saveEmployees();
    notify("employees");
  }
}

export function deleteEmployee(id: string) {
  const idx = employees.findIndex((e) => e.id === id);
  if (idx >= 0) {
    employees.splice(idx, 1); saveEmployees();
    notify("employees");
  }
}

// ==============================
// BRANCHES
// ==============================
export function getBranches(): Branch[] { return branchesSnap; }

export function addBranch(data: Omit<Branch, "id">): Branch {
  const b = { id: nextId("B", branches), ...data };
  branches.push(b); saveBranches();
  notify("branches"); return b;
}

export function updateBranch(id: string, data: Partial<Branch>) {
  const idx = branches.findIndex((b) => b.id === id);
  if (idx >= 0) {
    branches[idx] = { ...branches[idx], ...data }; saveBranches();
    notify("branches");
  }
}

export function deleteBranch(id: string) {
  const idx = branches.findIndex((b) => b.id === id);
  if (idx >= 0) {
    branches.splice(idx, 1); saveBranches();
    notify("branches");
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
      saveInvoices();
    }
  }
  saveReceipts();
  notify("receipts", "invoices"); return r;
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
        saveInvoices();
      }
    }
    receipts[idx] = updated; saveReceipts();
    notify("receipts", "invoices");
  }
}

export function deleteReceipt(id: string) {
  const idx = receipts.findIndex((r) => r.id === id);
  if (idx >= 0) {
    const old = receipts[idx];
    const invIdx = invoices.findIndex((i) => i.id === old.invoiceId);
    if (invIdx >= 0) {
      invoices[invIdx] = { ...invoices[invIdx], paidTotal: Math.max(0, invoices[invIdx].paidTotal - old.amount) };
      saveInvoices();
    }
    receipts.splice(idx, 1); saveReceipts();
    notify("receipts", "invoices");
  }
}

// ==============================
// STOCK MOVEMENT MANUAL ADD
// ==============================
export function addManualStockMovement(productId: string, productName: string, type: StockMovement["type"], qty: number, reason: string) {
  recordStockMovement(productName, type, qty, reason);
  const pIdx = products.findIndex(p => p.id === productId);
  if (pIdx >= 0) {
    if (type === "in" || type === "return") {
      products[pIdx] = { ...products[pIdx], stock: products[pIdx].stock + qty };
    } else {
      products[pIdx] = { ...products[pIdx], stock: Math.max(0, products[pIdx].stock - qty) };
    }
    saveProducts();
  }
  notify("products", "stockMovements");
}

// ==============================
// EXPENSES
// ==============================
export function getExpenses(): Expense[] { return expensesSnap; }

export function addExpense(data: Omit<Expense, "id">): Expense {
  const e: Expense = { id: nextId("EXP", expensesList), ...data };
  expensesList.push(e); saveExpenses();
  notify("expenses"); return e;
}

export function updateExpense(id: string, data: Partial<Expense>) {
  const idx = expensesList.findIndex(e => e.id === id);
  if (idx >= 0) {
    expensesList[idx] = { ...expensesList[idx], ...data }; saveExpenses();
    notify("expenses");
  }
}

export function deleteExpense(id: string) {
  const idx = expensesList.findIndex(e => e.id === id);
  if (idx >= 0) {
    expensesList.splice(idx, 1); saveExpenses();
    notify("expenses");
  }
}
