// ==============================
// API Client — Dynamic URL for LAN/VPN/Electron + Session Auth
// ==============================

// function getApiBase(): string {
//   if ((window as any).__API_URL__) return (window as any).__API_URL__;
//   if (window.location.port === "3001" || !window.location.port) {
//     return `${window.location.protocol}//${window.location.host}/api`;
//   }
//   return "http://localhost:3001/api";
// }
function getApiBase(): string {
  // 🔥 1) لو Electron حقن API URL → استخدمه
  const injected = (window as any).__API_URL__;
  if (typeof injected === "string" && injected.trim()) {
    return injected.replace(/\/$/, "");
  }

  // 🔥 2) لو شغال داخل Electron (file://)
  if ((window as any).__IS_ELECTRON__ || window.location.protocol === "file:") {
    return "http://127.0.0.1:3001/api";
  }

  // 🔥 3) لو فاتح من نفس السيرفر (Web mode)
  if (window.location.port === "3001") {
    return `${window.location.protocol}//${window.location.host}/api`;
  }

  // 🔥 4) fallback آمن
  return "http://127.0.0.1:3001/api";
}

// ==============================
// Session Token Management
// ==============================
const SESSION_KEY = "emperor_session_token";
const SESSION_EXPIRY_KEY = "emperor_session_expiry";

export function setSessionToken(token: string, expiresIn: number) {
  localStorage.setItem(SESSION_KEY, token);
  localStorage.setItem(SESSION_EXPIRY_KEY, String(Date.now() + expiresIn));
}

export function getSessionToken(): string | null {
  const token = localStorage.getItem(SESSION_KEY);
  const expiry = localStorage.getItem(SESSION_EXPIRY_KEY);
  if (!token) return null;
  if (expiry && Date.now() > parseInt(expiry, 10)) {
    clearSessionToken();
    return null;
  }
  return token;
}

export function clearSessionToken() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_EXPIRY_KEY);
}

// ==============================
// Request with retry + session auth
// ==============================
const MAX_RETRIES = 2;
const REQUEST_TIMEOUT = 10000;

// Session expiry callback — set by store.ts
let onSessionExpired: (() => void) | null = null;
export function setOnSessionExpired(cb: () => void) { onSessionExpired = cb; }

async function request<T>(path: string, options?: RequestInit, retries = MAX_RETRIES): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options?.headers as Record<string, string> || {}),
    };

    // Attach session token if available
    const token = getSessionToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${getApiBase()}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      // Handle session expiry from server
      if (res.status === 401 && err.code === "SESSION_EXPIRED") {
        clearSessionToken();
        if (onSessionExpired) onSessionExpired();
        throw new Error("SESSION_EXPIRED");
      }
      throw new Error(err.error || res.statusText);
    }
    return res.json();
  } catch (e: any) {
    clearTimeout(timeout);
    if (retries > 0 && (e.name === "AbortError" || e.message?.includes("fetch"))) {
      await new Promise(r => setTimeout(r, 1000));
      return request<T>(path, options, retries - 1);
    }
    throw e;
  }
}

export const api = {
  // Health
  health: () => request<{ status: string }>("/health"),

  // Customers
  getCustomers: () => request<any[]>("/customers"),
  addCustomer: (data: any) => request<any>("/customers", { method: "POST", body: JSON.stringify(data) }),
  updateCustomer: (id: string, data: any) => request<any>(`/customers/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCustomer: (id: string) => request<any>(`/customers/${id}`, { method: "DELETE" }),

  // Products
  getProducts: () => request<any[]>("/products"),
  addProduct: (data: any) => request<any>("/products", { method: "POST", body: JSON.stringify(data) }),
  updateProduct: (id: string, data: any) => request<any>(`/products/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteProduct: (id: string) => request<any>(`/products/${id}`, { method: "DELETE" }),

  // Invoices
  getInvoices: () => request<any[]>("/invoices"),
  addInvoice: (data: any) => request<any>("/invoices", { method: "POST", body: JSON.stringify(data) }),
  updateInvoice: (id: string, data: any) => request<any>(`/invoices/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteInvoice: (id: string) => request<any>(`/invoices/${id}`, { method: "DELETE" }),

  // Employees
  getEmployees: () => request<any[]>("/employees"),
  addEmployee: (data: any) => request<any>("/employees", { method: "POST", body: JSON.stringify(data) }),
  updateEmployee: (id: string, data: any) => request<any>(`/employees/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteEmployee: (id: string) => request<any>(`/employees/${id}`, { method: "DELETE" }),

  // Branches
  getBranches: () => request<any[]>("/branches"),
  addBranch: (data: any) => request<any>("/branches", { method: "POST", body: JSON.stringify(data) }),
  updateBranch: (id: string, data: any) => request<any>(`/branches/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteBranch: (id: string) => request<any>(`/branches/${id}`, { method: "DELETE" }),

  // Receipts
  getReceipts: () => request<any[]>("/receipts"),
  addReceipt: (data: any) => request<any>("/receipts", { method: "POST", body: JSON.stringify(data) }),
  updateReceipt: (id: string, data: any) => request<any>(`/receipts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteReceipt: (id: string) => request<any>(`/receipts/${id}`, { method: "DELETE" }),

  // Offers
  getOffers: () => request<any[]>("/offers"),
  addOffer: (data: any) => request<any>("/offers", { method: "POST", body: JSON.stringify(data) }),
  updateOffer: (id: string, data: any) => request<any>(`/offers/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteOffer: (id: string) => request<any>(`/offers/${id}`, { method: "DELETE" }),

  // Stock Movements
  getStockMovements: () => request<any[]>("/stock-movements"),
  addStockMovement: (data: any) => request<any>("/stock-movements", { method: "POST", body: JSON.stringify(data) }),

  // Returns
  getReturns: () => request<any[]>("/returns"),
  addReturn: (data: any) => request<any>("/returns", { method: "POST", body: JSON.stringify(data) }),

  // Shifts
  getShifts: () => request<any[]>("/shifts"),
  addShift: (data: any) => request<any>("/shifts", { method: "POST", body: JSON.stringify(data) }),
  updateShift: (id: string, data: any) => request<any>(`/shifts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteShift: (id: string) => request<any>(`/shifts/${id}`, { method: "DELETE" }),

  // Attendance
  getAttendance: () => request<any[]>("/attendance"),
  addAttendance: (data: any) => request<any>("/attendance", { method: "POST", body: JSON.stringify(data) }),
  updateAttendance: (id: string, data: any) => request<any>(`/attendance/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteAttendance: (id: string) => request<any>(`/attendance/${id}`, { method: "DELETE" }),

  // Expenses
  getExpenses: () => request<any[]>("/expenses"),
  addExpense: (data: any) => request<any>("/expenses", { method: "POST", body: JSON.stringify(data) }),
  updateExpense: (id: string, data: any) => request<any>(`/expenses/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteExpense: (id: string) => request<any>(`/expenses/${id}`, { method: "DELETE" }),

  // Users
  getUsers: () => request<any[]>("/users"),
  loginUser: (email: string, password: string) => request<any>("/users/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logoutUser: () => request<any>("/users/logout", { method: "POST" }),
  validateSession: () => request<any>("/users/session"),
  addUser: (data: any) => request<any>("/users", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (id: string, data: any) => request<any>(`/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteUser: (id: string) => request<any>(`/users/${id}`, { method: "DELETE" }),

  // Settings
  getSettings: () => request<any>("/settings"),
  updateSettings: (data: any) => request<any>("/settings", { method: "PUT", body: JSON.stringify(data) }),

  // Audit Log
  getAuditLog: () => request<any[]>("/audit-log"),
  addAuditLog: (data: any) => request<any>("/audit-log", { method: "POST", body: JSON.stringify(data) }),
  clearAuditLog: () => request<any>("/audit-log", { method: "DELETE" }),

  // Security Log
  getSecurityLog: () => request<any[]>("/security-log"),
  addSecurityEvent: (data: any) => request<any>("/security-log", { method: "POST", body: JSON.stringify(data) }),
  clearSecurityLog: () => request<any>("/security-log", { method: "DELETE" }),

  // Backup
  getBackups: () => request<any[]>("/backup/list"),
  createBackup: (type: string, label?: string) => request<any>("/backup/export", { method: "POST", body: JSON.stringify({ type, label }) }),
  downloadBackupUrl: (id: string) => `${getApiBase()}/backup/download/${id}`,
  restoreBackup: (id: string) => request<any>(`/backup/restore/${id}`, { method: "POST" }),
  restoreBackupUpload: (data: any) => request<any>("/backup/restore-upload", { method: "POST", body: JSON.stringify(data) }),
  deleteBackup: (id: string) => request<any>(`/backup/${id}`, { method: "DELETE" }),

  // Files / Images
  getFiles: (params?: { relatedTo?: string; relatedId?: string }) => {
    const query = new URLSearchParams();
    if (params?.relatedTo) query.set("relatedTo", params.relatedTo);
    if (params?.relatedId) query.set("relatedId", params.relatedId);
    const qs = query.toString();
    return request<any[]>(`/files${qs ? `?${qs}` : ""}`);
  },
  uploadFile: async (file: File, meta: { name?: string; relatedTo?: string; relatedId?: string }) => {
    const formData = new FormData();
    formData.append("file", file);
    if (meta.name) formData.append("name", meta.name);
    if (meta.relatedTo) formData.append("relatedTo", meta.relatedTo);
    if (meta.relatedId) formData.append("relatedId", meta.relatedId);
    const headers: Record<string, string> = {};
    const token = getSessionToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${getApiBase()}/files`, { method: "POST", body: formData, headers });
    if (!res.ok) { const err = await res.json().catch(() => ({ error: res.statusText })); throw new Error(err.error || res.statusText); }
    return res.json();
  },
  getFileURL: (id: string) => `${getApiBase()}/files/${id}/view`,
  downloadFile: (id: string) => `${getApiBase()}/files/${id}/download`,
  deleteFile: (id: string) => request<any>(`/files/${id}`, { method: "DELETE" }),
};
