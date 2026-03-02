import { useSyncExternalStore, useCallback } from "react";
import * as store from "./store";

function useStoreData<T>(getter: () => T): T {
  return useSyncExternalStore(store.subscribe, getter, getter);
}

// ---- Company Settings ----
export function useCompanySettings() {
  const settings = useStoreData(store.getCompanySettings);
  return {
    settings,
    updateSettings: useCallback(store.updateCompanySettings, []),
  };
}

// ---- Customers ----
export function useCustomers() {
  const customers = useStoreData(store.getCustomers);
  return {
    customers,
    lastAddedCustomer: store.getLastAddedCustomer(),
    addCustomer: useCallback(store.addCustomer, []),
    updateCustomer: useCallback(store.updateCustomer, []),
    deleteCustomer: useCallback(store.deleteCustomer, []),
  };
}

// ---- Products ----
export function useProducts() {
  const products = useStoreData(store.getProducts);
  return {
    products,
    addProduct: useCallback(store.addProduct, []),
    updateProduct: useCallback(store.updateProduct, []),
    deleteProduct: useCallback(store.deleteProduct, []),
  };
}

// ---- Invoices ----
export function useInvoices() {
  const invoices = useStoreData(store.getInvoices);
  return {
    invoices,
    addInvoice: useCallback(store.addInvoice, []),
    updateInvoice: useCallback(store.updateInvoice, []),
    deleteInvoice: useCallback(store.deleteInvoice, []),
  };
}

// ---- Employees ----
export function useEmployees() {
  const employees = useStoreData(store.getEmployees);
  return {
    employees,
    addEmployee: useCallback(store.addEmployee, []),
    updateEmployee: useCallback(store.updateEmployee, []),
    deleteEmployee: useCallback(store.deleteEmployee, []),
  };
}

// ---- Branches ----
export function useBranches() {
  const branches = useStoreData(store.getBranches);
  return {
    branches,
    addBranch: useCallback(store.addBranch, []),
    updateBranch: useCallback(store.updateBranch, []),
    deleteBranch: useCallback(store.deleteBranch, []),
  };
}

// ---- Receipts (Installments) ----
export function useReceipts() {
  const receipts = useStoreData(store.getReceipts);
  return {
    receipts,
    addReceipt: useCallback(store.addReceipt, []),
    updateReceipt: useCallback(store.updateReceipt, []),
    deleteReceipt: useCallback(store.deleteReceipt, []),
  };
}
