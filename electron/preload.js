// ==============================
// Electron Preload Script
// Exposes a safe API to the renderer via contextBridge
// CommonJS format — no ESM issues
// ==============================

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // ---- Customers ----
  getCustomers: () => ipcRenderer.invoke("db:getCustomers"),
  addCustomer: (data) => ipcRenderer.invoke("db:addCustomer", data),
  updateCustomer: (id, data) => ipcRenderer.invoke("db:updateCustomer", id, data),
  deleteCustomer: (id) => ipcRenderer.invoke("db:deleteCustomer", id),

  // ---- Products ----
  getProducts: () => ipcRenderer.invoke("db:getProducts"),
  addProduct: (data) => ipcRenderer.invoke("db:addProduct", data),
  updateProduct: (id, data) => ipcRenderer.invoke("db:updateProduct", id, data),
  deleteProduct: (id) => ipcRenderer.invoke("db:deleteProduct", id),

  // ---- Invoices ----
  getInvoices: () => ipcRenderer.invoke("db:getInvoices"),
  addInvoice: (data) => ipcRenderer.invoke("db:addInvoice", data),
  updateInvoice: (id, data) => ipcRenderer.invoke("db:updateInvoice", id, data),
  deleteInvoice: (id) => ipcRenderer.invoke("db:deleteInvoice", id),

  // ---- Employees ----
  getEmployees: () => ipcRenderer.invoke("db:getEmployees"),
  addEmployee: (data) => ipcRenderer.invoke("db:addEmployee", data),
  updateEmployee: (id, data) => ipcRenderer.invoke("db:updateEmployee", id, data),
  deleteEmployee: (id) => ipcRenderer.invoke("db:deleteEmployee", id),

  // ---- Branches ----
  getBranches: () => ipcRenderer.invoke("db:getBranches"),
  addBranch: (data) => ipcRenderer.invoke("db:addBranch", data),
  updateBranch: (id, data) => ipcRenderer.invoke("db:updateBranch", id, data),
  deleteBranch: (id) => ipcRenderer.invoke("db:deleteBranch", id),

  // ---- Receipts ----
  getReceipts: () => ipcRenderer.invoke("db:getReceipts"),
  addReceipt: (data) => ipcRenderer.invoke("db:addReceipt", data),
  updateReceipt: (id, data) => ipcRenderer.invoke("db:updateReceipt", id, data),
  deleteReceipt: (id) => ipcRenderer.invoke("db:deleteReceipt", id),

  // ---- Settings ----
  getSettings: () => ipcRenderer.invoke("db:getSettings"),
  updateSettings: (data) => ipcRenderer.invoke("db:updateSettings", data),
});
