// ==============================
// In-Memory Data Store
// ==============================

import type {
  Customer, Product, Invoice, Employee, Branch, Receipt, CompanySettings,
  AuditLogEntry, AuditAction, AuditEntity, UserAccount, RolePermissions,
  Offer, StockMovement, ProductReturn, Shift, AttendanceRecord,
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
let usersSnap: UserAccount[] = [...users];

function saveUsers() {
  localStorage.setItem("userAccounts", JSON.stringify(users));
}

let currentUser: UserAccount | null = null;

export function getUsers(): UserAccount[] { return usersSnap; }
export function getCurrentUser(): UserAccount | null { return currentUser; }

export function getUserPermissions(): RolePermissions {
  if (!currentUser) return DEFAULT_PERMISSIONS.sales;
  const base = DEFAULT_PERMISSIONS[currentUser.role] || DEFAULT_PERMISSIONS.sales;
  if (currentUser.customPermissions) {
    return { ...base, ...currentUser.customPermissions };
  }
  return base;
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
  if (email && password) {
    localStorage.setItem(AUTH_KEY, "true");
    currentUser = DEFAULT_USERS[0];
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
  action: AuditAction, entity: AuditEntity, entityId: string, entityName: string, details: string,
) {
  const entry: AuditLogEntry = {
    id: `AL${String(auditLog.length + 1).padStart(5, "0")}`,
    timestamp: new Date().toISOString(),
    user: currentUser?.name || "النظام",
    action, entity, entityId, entityName, details,
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
  notify();
}

// ---- Initial seed data ----
const customers: Customer[] = [
  { id: "C001", fullName: "أحمد محمد علي", nationalId: "29901011234567", phone: "01012345678", address: "شارع التحرير", governorate: "القاهرة", jobTitle: "مهندس", notes: "" },
  { id: "C002", fullName: "سارة أحمد حسن", nationalId: "30001021234567", phone: "01098765432", address: "شارع الهرم", governorate: "الجيزة", jobTitle: "طبيبة", notes: "عميل مميز" },
  { id: "C003", fullName: "محمود حسن إبراهيم", nationalId: "28501031234567", phone: "01112345678", address: "شارع النصر", governorate: "الإسكندرية", jobTitle: "تاجر", notes: "" },
];

const products: Product[] = [
  { id: "P001", name: "غرفة نوم كاملة", category: "غرف نوم", defaultPrice: 25000, unit: "قطعة", stock: 10, minStock: 2, notes: "" },
  { id: "P002", name: "طقم أنتريه مودرن", category: "أنتريهات", defaultPrice: 18000, unit: "قطعة", stock: 8, minStock: 2, notes: "" },
  { id: "P003", name: "مطبخ ألوميتال", category: "مطابخ", defaultPrice: 15000, unit: "متر", stock: 50, minStock: 10, notes: "" },
  { id: "P004", name: "غرفة سفرة ٨ كراسي", category: "سفرة", defaultPrice: 22000, unit: "قطعة", stock: 5, minStock: 1, notes: "" },
  { id: "P005", name: "دولاب ملابس", category: "غرف نوم", defaultPrice: 8000, unit: "قطعة", stock: 15, minStock: 3, notes: "" },
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
  { id: "E001", name: "محمد سعيد", nationalId: "29001011234567", phone: "01011111111", branch: "القاهرة", monthlySalary: 5000, role: "مبيعات", active: true },
  { id: "E002", name: "علي حسن", nationalId: "29101021234567", phone: "01022222222", branch: "الجيزة", monthlySalary: 4500, role: "مبيعات", active: true },
  { id: "E003", name: "نورا أحمد", nationalId: "29201031234567", phone: "01033333333", branch: "القاهرة", monthlySalary: 6000, role: "محاسب", active: true },
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

// ==============================
// OFFERS
// ==============================
function loadOffers(): Offer[] {
  try {
    const saved = localStorage.getItem("offers");
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

const offers: Offer[] = loadOffers();
let offersSnap: Offer[] = [...offers];

function saveOffers() {
  localStorage.setItem("offers", JSON.stringify(offers));
}

// ==============================
// STOCK MOVEMENTS
// ==============================
function loadStockMovements(): StockMovement[] {
  try {
    const saved = localStorage.getItem("stockMovements");
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

const stockMovements: StockMovement[] = loadStockMovements();
let stockMovementsSnap: StockMovement[] = [...stockMovements];

function saveStockMovements() {
  localStorage.setItem("stockMovements", JSON.stringify(stockMovements));
}

function recordStockMovement(productName: string, type: StockMovement["type"], qty: number, reason: string, relatedId?: string) {
  const product = products.find(p => p.name === productName);
  stockMovements.unshift({
    id: `SM${String(stockMovements.length + 1).padStart(5, "0")}`,
    productId: product?.id || "",
    productName,
    type, qty,
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
function loadReturns(): ProductReturn[] {
  try {
    const saved = localStorage.getItem("productReturns");
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

const productReturns: ProductReturn[] = loadReturns();
let returnsSnap: ProductReturn[] = [...productReturns];

function saveReturns() {
  localStorage.setItem("productReturns", JSON.stringify(productReturns));
}

export function getReturns(): ProductReturn[] { return returnsSnap; }

export function addReturn(data: Omit<ProductReturn, "id">): ProductReturn {
  const r: ProductReturn = { id: `RET${String(productReturns.length + 1).padStart(3, "0")}`, ...data };
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
  }
  saveReturns();
  addAuditLog("create", "return", r.id, r.id, `مرتجع: ${r.id} من فاتورة ${r.invoiceId}`);
  notify();
  return r;
}

// ==============================
// SHIFTS
// ==============================
function loadShifts(): Shift[] {
  try {
    const saved = localStorage.getItem("shifts");
    if (saved) return JSON.parse(saved);
  } catch {}
  return [
    { id: "SH001", name: "صباحي", startTime: "08:00", endTime: "16:00", hours: 8, branch: "القاهرة", active: true, notes: "" },
    { id: "SH002", name: "مسائي", startTime: "16:00", endTime: "00:00", hours: 8, branch: "القاهرة", active: true, notes: "" },
    { id: "SH003", name: "مرن", startTime: "10:00", endTime: "18:00", hours: 8, branch: "الجيزة", active: true, notes: "" },
  ];
}

const shifts: Shift[] = loadShifts();
let shiftsSnap: Shift[] = [...shifts];

function saveShifts() {
  localStorage.setItem("shifts", JSON.stringify(shifts));
}

export function getShifts(): Shift[] { return shiftsSnap; }

export function addShift(data: Omit<Shift, "id">): Shift {
  const s: Shift = { id: `SH${String(shifts.length + 1).padStart(3, "0")}`, ...data };
  shifts.push(s);
  saveShifts();
  addAuditLog("create", "shift", s.id, s.name, `إضافة شفت: ${s.name}`);
  notify();
  return s;
}

export function updateShift(id: string, data: Partial<Shift>) {
  const idx = shifts.findIndex(s => s.id === id);
  if (idx >= 0) {
    shifts[idx] = { ...shifts[idx], ...data };
    saveShifts();
    addAuditLog("update", "shift", id, shifts[idx].name, `تعديل شفت: ${shifts[idx].name}`);
    notify();
  }
}

export function deleteShift(id: string) {
  const idx = shifts.findIndex(s => s.id === id);
  if (idx >= 0) {
    const name = shifts[idx].name;
    shifts.splice(idx, 1);
    saveShifts();
    addAuditLog("delete", "shift", id, name, `حذف شفت: ${name}`);
    notify();
  }
}

// ==============================
// ATTENDANCE
// ==============================
function loadAttendance(): AttendanceRecord[] {
  try {
    const saved = localStorage.getItem("attendance");
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

const attendance: AttendanceRecord[] = loadAttendance();
let attendanceSnap: AttendanceRecord[] = [...attendance];

function saveAttendance() {
  localStorage.setItem("attendance", JSON.stringify(attendance));
}

export function getAttendance(): AttendanceRecord[] { return attendanceSnap; }

export function addAttendance(data: Omit<AttendanceRecord, "id">): AttendanceRecord {
  const a: AttendanceRecord = { id: `ATT${String(attendance.length + 1).padStart(5, "0")}`, ...data };
  attendance.push(a);
  saveAttendance();
  addAuditLog("create", "attendance", a.id, a.employeeName, `تسجيل حضور: ${a.employeeName} (${a.status})`);
  notify();
  return a;
}

export function updateAttendance(id: string, data: Partial<AttendanceRecord>) {
  const idx = attendance.findIndex(a => a.id === id);
  if (idx >= 0) {
    attendance[idx] = { ...attendance[idx], ...data };
    saveAttendance();
    addAuditLog("update", "attendance", id, attendance[idx].employeeName, `تعديل حضور: ${attendance[idx].employeeName}`);
    notify();
  }
}

export function deleteAttendance(id: string) {
  const idx = attendance.findIndex(a => a.id === id);
  if (idx >= 0) {
    const name = attendance[idx].employeeName;
    attendance.splice(idx, 1);
    saveAttendance();
    addAuditLog("delete", "attendance", id, name, `حذف سجل حضور: ${name}`);
    notify();
  }
}



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
  const o = { id: `OF${String(offers.length + 1).padStart(3, "0")}`, ...data };
  offers.push(o);
  saveOffers();
  addAuditLog("create", "offer", o.id, o.name, `إضافة عرض: ${o.name}`);
  notify();
  return o;
}

export function updateOffer(id: string, data: Partial<Offer>) {
  const idx = offers.findIndex((o) => o.id === id);
  if (idx >= 0) {
    const name = offers[idx].name;
    offers[idx] = { ...offers[idx], ...data };
    saveOffers();
    addAuditLog("update", "offer", id, data.name || name, `تعديل عرض: ${data.name || name}`);
    notify();
  }
}

export function deleteOffer(id: string) {
  const idx = offers.findIndex((o) => o.id === id);
  if (idx >= 0) {
    const name = offers[idx].name;
    offers.splice(idx, 1);
    saveOffers();
    addAuditLog("delete", "offer", id, name, `حذف عرض: ${name}`);
    notify();
  }
}

// Track last added customer name
let lastAddedCustomer = "";

// ---- Generic helpers ----
function nextId(prefix: string, list: { id: string }[]): string {
  const num = list.length + 1;
  return prefix.includes("INV")
    ? `INV-${String(num).padStart(3, "0")}`
    : `${prefix}${String(num).padStart(3, "0")}`;
}

// ---- Change listeners ----
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
  usersSnap = [...users];
  offersSnap = [...offers];
  stockMovementsSnap = [...stockMovements];
  returnsSnap = [...productReturns];
  shiftsSnap = [...shifts];
  attendanceSnap = [...attendance];
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
  for (const item of inv.items) {
    const pIdx = products.findIndex(p => p.name === item.productName);
    if (pIdx >= 0) {
      products[pIdx] = { ...products[pIdx], stock: Math.max(0, products[pIdx].stock - item.qty) };
      recordStockMovement(item.productName, "out", item.qty, `فاتورة ${inv.id}`, inv.id);
    }
  }
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
    const inv = invoices[idx];
    for (const item of inv.items) {
      const pIdx = products.findIndex(p => p.name === item.productName);
      if (pIdx >= 0) {
        products[pIdx] = { ...products[pIdx], stock: products[pIdx].stock + item.qty };
        recordStockMovement(item.productName, "in", item.qty, `حذف فاتورة ${id} (استرجاع)`, id);
      }
    }
    invoices.splice(idx, 1);
    addAuditLog("delete", "invoice", id, id, `حذف فاتورة: ${id} (تم استرجاع المخزون)`);
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
  }
  addAuditLog("update", "product", productId, productName, `تعديل مخزون: ${type === "in" || type === "return" ? "+" : "-"}${qty} (${reason})`);
  notify();
}

// ==============================
// BACKUP (Web mode - export/import JSON)
// ==============================
export function exportBackup(): string {
  const data = {
    version: 3,
    timestamp: new Date().toISOString(),
    customers: [...customers],
    products: [...products],
    invoices: [...invoices],
    employees: [...employees],
    branches: [...branches],
    receipts: [...receipts],
    offers: [...offers],
    stockMovements: [...stockMovements],
    productReturns: [...productReturns],
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

    customers.length = 0; products.length = 0; invoices.length = 0;
    employees.length = 0; branches.length = 0; receipts.length = 0;
    auditLog.length = 0; offers.length = 0;
    stockMovements.length = 0; productReturns.length = 0;

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
    saveOffers();
    saveStockMovements();
    saveReturns();
    addAuditLog("update", "settings", "backup", "نسخ احتياطي", "استعادة نسخة احتياطية");
    notify();
    return true;
  } catch {
    return false;
  }
}
