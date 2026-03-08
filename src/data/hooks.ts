import { useSyncExternalStore, useCallback } from "react";
import * as store from "./store";

function useStoreData<T>(getter: () => T): T {
  return useSyncExternalStore(store.subscribe, getter, getter);
}

export function useCompanySettings() {
  const settings = useStoreData(store.getCompanySettings);
  return { settings, updateSettings: useCallback(store.updateCompanySettings, []) };
}

export function useCustomers() {
  const customers = useStoreData(store.getCustomers);
  return {
    customers, lastAddedCustomer: store.getLastAddedCustomer(),
    addCustomer: useCallback(store.addCustomer, []),
    updateCustomer: useCallback(store.updateCustomer, []),
    deleteCustomer: useCallback(store.deleteCustomer, []),
  };
}

export function useProducts() {
  const products = useStoreData(store.getProducts);
  return {
    products,
    addProduct: useCallback(store.addProduct, []),
    updateProduct: useCallback(store.updateProduct, []),
    deleteProduct: useCallback(store.deleteProduct, []),
  };
}

export function useInvoices() {
  const invoices = useStoreData(store.getInvoices);
  return {
    invoices,
    addInvoice: useCallback(store.addInvoice, []),
    updateInvoice: useCallback(store.updateInvoice, []),
    deleteInvoice: useCallback(store.deleteInvoice, []),
  };
}

export function useEmployees() {
  const employees = useStoreData(store.getEmployees);
  return {
    employees,
    addEmployee: useCallback(store.addEmployee, []),
    updateEmployee: useCallback(store.updateEmployee, []),
    deleteEmployee: useCallback(store.deleteEmployee, []),
  };
}

export function useBranches() {
  const branches = useStoreData(store.getBranches);
  return {
    branches,
    addBranch: useCallback(store.addBranch, []),
    updateBranch: useCallback(store.updateBranch, []),
    deleteBranch: useCallback(store.deleteBranch, []),
  };
}

export function useReceipts() {
  const receipts = useStoreData(store.getReceipts);
  return {
    receipts,
    addReceipt: useCallback(store.addReceipt, []),
    updateReceipt: useCallback(store.updateReceipt, []),
    deleteReceipt: useCallback(store.deleteReceipt, []),
  };
}

export function useAuditLog() {
  const log = useStoreData(store.getAuditLog);
  return { log, clearAuditLog: useCallback(store.clearAuditLog, []) };
}

export function useUsers() {
  const users = useStoreData(store.getUsers);
  return {
    users, currentUser: store.getCurrentUser(), permissions: store.getUserPermissions(),
    addUser: useCallback(store.addUser, []),
    updateUser: useCallback(store.updateUser, []),
    deleteUser: useCallback(store.deleteUser, []),
  };
}

export function useOffers() {
  const offers = useStoreData(store.getOffers);
  return {
    offers, activeOffers: store.getActiveOffers(), getProductDiscount: store.getProductDiscount,
    addOffer: useCallback(store.addOffer, []),
    updateOffer: useCallback(store.updateOffer, []),
    deleteOffer: useCallback(store.deleteOffer, []),
  };
}

export function useStockMovements() {
  const movements = useStoreData(store.getStockMovements);
  return { movements, addManualMovement: useCallback(store.addManualStockMovement, []) };
}

export function useReturns() {
  const returns = useStoreData(store.getReturns);
  return { returns, addReturn: useCallback(store.addReturn, []) };
}

export function useShifts() {
  const shifts = useStoreData(store.getShifts);
  return {
    shifts,
    addShift: useCallback(store.addShift, []),
    updateShift: useCallback(store.updateShift, []),
    deleteShift: useCallback(store.deleteShift, []),
  };
}

export function useAttendance() {
  const attendance = useStoreData(store.getAttendance);
  return {
  attendance,
    addAttendance: useCallback(store.addAttendance, []),
    updateAttendance: useCallback(store.updateAttendance, []),
    deleteAttendance: useCallback(store.deleteAttendance, []),
  };
}

export function useSecurityLog() {
  const events = useStoreData(store.getSecurityLog);
  return { events, clearSecurityLog: useCallback(store.clearSecurityLog, []) };
}
