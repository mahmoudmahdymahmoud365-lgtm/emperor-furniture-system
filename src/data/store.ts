// ==============================
// In-Memory Data Store
// Replace this file with SQLite calls when wrapping with Electron.
// All functions are synchronous now; make them async when switching to SQLite.
// ==============================

import type { Customer, Product, Invoice, Employee, Branch, Receipt } from "./types";

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
    date: "2025-06-15",
    items: [{ productName: "غرفة نوم كاملة", qty: 1, unitPrice: 25000, lineDiscount: 1000 }],
    status: "مؤكدة", paidTotal: 15000, commissionPercent: 3,
  },
  {
    id: "INV-002", customer: "سارة أحمد حسن", branch: "الجيزة", employee: "علي حسن",
    date: "2025-06-16",
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
  notify();
  return c;
}

export function updateCustomer(id: string, data: Partial<Customer>) {
  const idx = customers.findIndex((c) => c.id === id);
  if (idx >= 0) { customers[idx] = { ...customers[idx], ...data }; notify(); }
}

export function deleteCustomer(id: string) {
  const idx = customers.findIndex((c) => c.id === id);
  if (idx >= 0) { customers.splice(idx, 1); notify(); }
}

// ==============================
// PRODUCTS
// ==============================
export function getProducts(): Product[] { return productsSnap; }

export function addProduct(data: Omit<Product, "id">): Product {
  const p = { id: nextId("P", products), ...data };
  products.push(p);
  notify();
  return p;
}

export function updateProduct(id: string, data: Partial<Product>) {
  const idx = products.findIndex((p) => p.id === id);
  if (idx >= 0) { products[idx] = { ...products[idx], ...data }; notify(); }
}

export function deleteProduct(id: string) {
  const idx = products.findIndex((p) => p.id === id);
  if (idx >= 0) { products.splice(idx, 1); notify(); }
}

// ==============================
// INVOICES
// ==============================
export function getInvoices(): Invoice[] { return invoicesSnap; }

export function addInvoice(data: Omit<Invoice, "id">): Invoice {
  const inv = { id: nextId("INV-", invoices), ...data };
  invoices.push(inv);
  notify();
  return inv;
}

export function updateInvoice(id: string, data: Partial<Invoice>) {
  const idx = invoices.findIndex((i) => i.id === id);
  if (idx >= 0) { invoices[idx] = { ...invoices[idx], ...data }; notify(); }
}

export function deleteInvoice(id: string) {
  const idx = invoices.findIndex((i) => i.id === id);
  if (idx >= 0) { invoices.splice(idx, 1); notify(); }
}

// ==============================
// EMPLOYEES
// ==============================
export function getEmployees(): Employee[] { return employeesSnap; }

export function addEmployee(data: Omit<Employee, "id">): Employee {
  const e = { id: nextId("E", employees), ...data };
  employees.push(e);
  notify();
  return e;
}

export function updateEmployee(id: string, data: Partial<Employee>) {
  const idx = employees.findIndex((e) => e.id === id);
  if (idx >= 0) { employees[idx] = { ...employees[idx], ...data }; notify(); }
}

export function deleteEmployee(id: string) {
  const idx = employees.findIndex((e) => e.id === id);
  if (idx >= 0) { employees.splice(idx, 1); notify(); }
}

// ==============================
// BRANCHES
// ==============================
export function getBranches(): Branch[] { return branchesSnap; }

export function addBranch(data: Omit<Branch, "id">): Branch {
  const b = { id: nextId("B", branches), ...data };
  branches.push(b);
  notify();
  return b;
}

export function updateBranch(id: string, data: Partial<Branch>) {
  const idx = branches.findIndex((b) => b.id === id);
  if (idx >= 0) { branches[idx] = { ...branches[idx], ...data }; notify(); }
}

export function deleteBranch(id: string) {
  const idx = branches.findIndex((b) => b.id === id);
  if (idx >= 0) { branches.splice(idx, 1); notify(); }
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
  notify();
  return r;
}

export function updateReceipt(id: string, data: Partial<Receipt>) {
  const idx = receipts.findIndex((r) => r.id === id);
  if (idx >= 0) {
    const old = receipts[idx];
    const updated = { ...old, ...data };
    // Adjust invoice paidTotal if amount changed
    if (data.amount !== undefined && data.amount !== old.amount) {
      const invIdx = invoices.findIndex((i) => i.id === old.invoiceId);
      if (invIdx >= 0) {
        invoices[invIdx] = { ...invoices[invIdx], paidTotal: invoices[invIdx].paidTotal - old.amount + updated.amount };
      }
    }
    receipts[idx] = updated;
    notify();
  }
}

export function deleteReceipt(id: string) {
  const idx = receipts.findIndex((r) => r.id === id);
  if (idx >= 0) {
    const old = receipts[idx];
    // Subtract from invoice paidTotal
    const invIdx = invoices.findIndex((i) => i.id === old.invoiceId);
    if (invIdx >= 0) {
      invoices[invIdx] = { ...invoices[invIdx], paidTotal: Math.max(0, invoices[invIdx].paidTotal - old.amount) };
    }
    receipts.splice(idx, 1);
    notify();
  }
}
