// ==============================
// Unified Type Definitions
// When migrating to SQLite/Electron, only the store implementation changes.
// ==============================

export interface Customer {
  id: string;
  fullName: string;
  nationalId: string;
  phone: string;
  address: string;
  governorate: string;
  jobTitle: string;
  notes: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  defaultPrice: number;
  unit: string;
  notes: string;
}

export interface InvoiceItem {
  productName: string;
  qty: number;
  unitPrice: number;
  lineDiscount: number;
}

export interface Invoice {
  id: string;
  customer: string;
  branch: string;
  employee: string;
  date: string;
  deliveryDate: string;
  items: InvoiceItem[];
  status: string;
  paidTotal: number;
  commissionPercent: number;
}

export interface CompanySettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string;
}

export interface Employee {
  id: string;
  name: string;
  phone: string;
  branch: string;
  monthlySalary: number;
  role: string;
  active: boolean;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  rent: number;
  active: boolean;
}

export interface Receipt {
  id: string;
  invoiceId: string;
  customer: string;
  amount: number;
  date: string;
  method: string;
  notes: string;
}

// ==============================
// Audit Log
// ==============================
export type AuditAction = "create" | "update" | "delete";
export type AuditEntity = "customer" | "product" | "invoice" | "employee" | "branch" | "receipt" | "settings";

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  entityName: string;
  details: string;
}

// ==============================
// User Roles & Permissions
// ==============================
export type UserRole = "admin" | "sales" | "accountant";

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  active: boolean;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "مدير النظام",
  sales: "مبيعات",
  accountant: "محاسب",
};

export interface RolePermissions {
  dashboard: boolean;
  customers: boolean;
  products: boolean;
  invoices: boolean;
  installments: boolean;
  employees: boolean;
  branches: boolean;
  reports: boolean;
  settings: boolean;
  auditLog: boolean;
  users: boolean;
  backup: boolean;
}

export const DEFAULT_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    dashboard: true, customers: true, products: true, invoices: true,
    installments: true, employees: true, branches: true, reports: true,
    settings: true, auditLog: true, users: true, backup: true,
  },
  sales: {
    dashboard: true, customers: true, products: true, invoices: true,
    installments: true, employees: false, branches: false, reports: false,
    settings: false, auditLog: false, users: false, backup: false,
  },
  accountant: {
    dashboard: true, customers: true, products: true, invoices: true,
    installments: true, employees: true, branches: true, reports: true,
    settings: false, auditLog: true, users: false, backup: false,
  },
};
