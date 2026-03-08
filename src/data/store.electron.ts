// ==============================
// Electron-based Store (uses SQLite via IPC)
// Drop-in replacement for store.ts when running inside Electron.
//
// HOW TO USE:
// 1. Rename store.ts → store.web.ts (backup)
// 2. Rename store.electron.ts → store.ts
// 3. All hooks.ts imports will automatically use SQLite
// ==============================

import type { Customer, Product, Invoice, Employee, Branch, Receipt, CompanySettings } from "./types";

// ---- Check if running in Electron ----
const api = (window as any).electronAPI;

if (!api) {
  console.warn("electronAPI not found — are you running inside Electron?");
}

// ---- Change listeners (for React re-renders) ----
type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  // Rebuild caches then notify
  Promise.all([
    refreshCustomers(),
    refreshProducts(),
    refreshInvoices(),
    refreshEmployees(),
    refreshBranches(),
    refreshReceipts(),
    refreshSettings(),
  ]).then(() => {
    listeners.forEach((fn) => fn());
  });
}

// ---- Snapshot caches (sync access for useSyncExternalStore) ----
let customersCache: Customer[] = [];
let productsCache: Product[] = [];
let invoicesCache: Invoice[] = [];
let employeesCache: Employee[] = [];
let branchesCache: Branch[] = [];
let receiptsCache: Receipt[] = [];
let settingsCache: CompanySettings = {
  name: "الامبراطور للأثاث",
  address: "",
  phone: "",
  phones: [],
  email: "",
  emails: [],
  logoUrl: "/logo.png",
};

async function refreshCustomers() { customersCache = (await api?.getCustomers()) || []; }
async function refreshProducts() { productsCache = (await api?.getProducts()) || []; }
async function refreshInvoices() { invoicesCache = (await api?.getInvoices()) || []; }
async function refreshEmployees() { employeesCache = (await api?.getEmployees()) || []; }
async function refreshBranches() { branchesCache = (await api?.getBranches()) || []; }
async function refreshReceipts() { receiptsCache = (await api?.getReceipts()) || []; }
async function refreshSettings() {
  const s = (await api?.getSettings()) || {};
  settingsCache = {
    name: s.name || "الامبراطور للأثاث",
    address: s.address || "",
    phone: s.phone || "",
    email: s.email || "",
    logoUrl: s.logoUrl || "/logo.png",
  };
}

// ---- Initial load ----
if (api) {
  notify(); // loads all data on startup
}

// ---- Auth (kept simple — localStorage) ----
const AUTH_KEY = "isLoggedIn";
export function isAuthenticated(): boolean { return localStorage.getItem(AUTH_KEY) === "true"; }
export function login(email: string, password: string): boolean {
  if (email && password) { localStorage.setItem(AUTH_KEY, "true"); return true; }
  return false;
}
export function logout() { localStorage.removeItem(AUTH_KEY); }

// ==============================
// COMPANY SETTINGS
// ==============================
export function getCompanySettings(): CompanySettings { return settingsCache; }
export async function updateCompanySettings(data: Partial<CompanySettings>) {
  await api?.updateSettings(data);
  notify();
}

// ==============================
// CUSTOMERS
// ==============================
let lastAddedCustomer = "";
export function getCustomers(): Customer[] { return customersCache; }
export function getLastAddedCustomer(): string { return lastAddedCustomer; }

export async function addCustomer(data: Omit<Customer, "id">): Promise<Customer> {
  const c = await api.addCustomer(data);
  lastAddedCustomer = c.fullName;
  notify();
  return c;
}

export async function updateCustomer(id: string, data: Partial<Customer>) {
  await api.updateCustomer(id, data);
  notify();
}

export async function deleteCustomer(id: string) {
  await api.deleteCustomer(id);
  notify();
}

// ==============================
// PRODUCTS
// ==============================
export function getProducts(): Product[] { return productsCache; }

export async function addProduct(data: Omit<Product, "id">): Promise<Product> {
  const p = await api.addProduct(data);
  notify();
  return p;
}

export async function updateProduct(id: string, data: Partial<Product>) {
  await api.updateProduct(id, data);
  notify();
}

export async function deleteProduct(id: string) {
  await api.deleteProduct(id);
  notify();
}

// ==============================
// INVOICES
// ==============================
export function getInvoices(): Invoice[] { return invoicesCache; }

export async function addInvoice(data: Omit<Invoice, "id">): Promise<Invoice> {
  const inv = await api.addInvoice(data);
  notify();
  return inv;
}

export async function updateInvoice(id: string, data: Partial<Invoice>) {
  await api.updateInvoice(id, data);
  notify();
}

export async function deleteInvoice(id: string) {
  await api.deleteInvoice(id);
  notify();
}

// ==============================
// EMPLOYEES
// ==============================
export function getEmployees(): Employee[] { return employeesCache; }

export async function addEmployee(data: Omit<Employee, "id">): Promise<Employee> {
  const e = await api.addEmployee(data);
  notify();
  return e;
}

export async function updateEmployee(id: string, data: Partial<Employee>) {
  await api.updateEmployee(id, data);
  notify();
}

export async function deleteEmployee(id: string) {
  await api.deleteEmployee(id);
  notify();
}

// ==============================
// BRANCHES
// ==============================
export function getBranches(): Branch[] { return branchesCache; }

export async function addBranch(data: Omit<Branch, "id">): Promise<Branch> {
  const b = await api.addBranch(data);
  notify();
  return b;
}

export async function updateBranch(id: string, data: Partial<Branch>) {
  await api.updateBranch(id, data);
  notify();
}

export async function deleteBranch(id: string) {
  await api.deleteBranch(id);
  notify();
}

// ==============================
// RECEIPTS
// ==============================
export function getReceipts(): Receipt[] { return receiptsCache; }

export async function addReceipt(data: Omit<Receipt, "id">): Promise<Receipt> {
  const r = await api.addReceipt(data);
  notify();
  return r;
}

export async function updateReceipt(id: string, data: Partial<Receipt>) {
  await api.updateReceipt(id, data);
  notify();
}

export async function deleteReceipt(id: string) {
  await api.deleteReceipt(id);
  notify();
}
