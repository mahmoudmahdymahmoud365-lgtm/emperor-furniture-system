// ==============================
// API Client - Communicates with Express Backend
// ==============================

const API_BASE = (window as any).__API_URL__ || "http://localhost:3001/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
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
};
