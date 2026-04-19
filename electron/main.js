// ==============================
// Electron Main Process
// CommonJS format to avoid ESM conflicts
// ==============================

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const db = require("./database");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, "../public/logo.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // In development, load from Vite dev server
  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  db.initialize();
  registerIpcHandlers();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ==============================
// IPC Handlers — bridge between renderer and SQLite
// ==============================

function registerIpcHandlers() {
  // ---- Customers ----
  ipcMain.handle("db:getCustomers", () => db.getCustomers());
  ipcMain.handle("db:addCustomer", (_e, data) => db.addCustomer(data));
  ipcMain.handle("db:updateCustomer", (_e, id, data) => db.updateCustomer(id, data));
  ipcMain.handle("db:deleteCustomer", (_e, id) => db.deleteCustomer(id));

  // ---- Products ----
  ipcMain.handle("db:getProducts", () => db.getProducts());
  ipcMain.handle("db:addProduct", (_e, data) => db.addProduct(data));
  ipcMain.handle("db:updateProduct", (_e, id, data) => db.updateProduct(id, data));
  ipcMain.handle("db:deleteProduct", (_e, id) => db.deleteProduct(id));

  // ---- Invoices ----
  ipcMain.handle("db:getInvoices", () => db.getInvoices());
  ipcMain.handle("db:addInvoice", (_e, data) => db.addInvoice(data));
  ipcMain.handle("db:updateInvoice", (_e, id, data) => db.updateInvoice(id, data));
  ipcMain.handle("db:deleteInvoice", (_e, id) => db.deleteInvoice(id));

  // ---- Employees ----
  ipcMain.handle("db:getEmployees", () => db.getEmployees());
  ipcMain.handle("db:addEmployee", (_e, data) => db.addEmployee(data));
  ipcMain.handle("db:updateEmployee", (_e, id, data) => db.updateEmployee(id, data));
  ipcMain.handle("db:deleteEmployee", (_e, id) => db.deleteEmployee(id));

  // ---- Branches ----
  ipcMain.handle("db:getBranches", () => db.getBranches());
  ipcMain.handle("db:addBranch", (_e, data) => db.addBranch(data));
  ipcMain.handle("db:updateBranch", (_e, id, data) => db.updateBranch(id, data));
  ipcMain.handle("db:deleteBranch", (_e, id) => db.deleteBranch(id));

  // ---- Receipts ----
  ipcMain.handle("db:getReceipts", () => db.getReceipts());
  ipcMain.handle("db:addReceipt", (_e, data) => db.addReceipt(data));
  ipcMain.handle("db:updateReceipt", (_e, id, data) => db.updateReceipt(id, data));
  ipcMain.handle("db:deleteReceipt", (_e, id) => db.deleteReceipt(id));

  // ---- Settings ----
  ipcMain.handle("db:getSettings", () => db.getSettings());
  ipcMain.handle("db:updateSettings", (_e, data) => db.updateSettings(data));
}
