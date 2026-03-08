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
  stock: number;
  minStock: number;
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
  appliedOfferName?: string;
  appliedDiscount?: number;
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
  nationalId: string;
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
// Offers & Discounts
// ==============================
export type OfferType = "percentage" | "fixed" | "timed";

export interface Offer {
  id: string;
  name: string;
  type: OfferType;
  value: number; // percentage or fixed amount
  productId: string; // "" = all products
  productName: string; // "" = all
  startDate: string;
  endDate: string;
  active: boolean;
  notes: string;
}

export const OFFER_TYPE_LABELS: Record<OfferType, string> = {
  percentage: "نسبة مئوية",
  fixed: "مبلغ ثابت",
  timed: "عرض بفترة زمنية",
};

// ==============================
// Stored Images (IndexedDB)
// ==============================
export interface StoredImage {
  id: string;
  name: string;
  type: string; // "بطاقة عميل" | "تصميم" | "أخرى"
  relatedTo: string; // customer name, invoice id, etc.
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

// ==============================
// Audit Log
// ==============================
export type AuditAction = "create" | "update" | "delete";
export type AuditEntity = "customer" | "product" | "invoice" | "employee" | "branch" | "receipt" | "settings" | "offer";

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
  customPermissions?: Partial<RolePermissions>;
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
  offers: boolean;
}

export const PERMISSION_LABELS: Record<keyof RolePermissions, string> = {
  dashboard: "لوحة التحكم",
  customers: "العملاء",
  products: "المنتجات",
  invoices: "الفواتير",
  installments: "الأقساط",
  employees: "الموظفين",
  branches: "الفروع",
  reports: "التقارير",
  settings: "الإعدادات",
  auditLog: "سجل العمليات",
  users: "المستخدمين",
  backup: "النسخ الاحتياطي",
  offers: "العروض والخصومات",
};

export const DEFAULT_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    dashboard: true, customers: true, products: true, invoices: true,
    installments: true, employees: true, branches: true, reports: true,
    settings: true, auditLog: true, users: true, backup: true, offers: true,
  },
  sales: {
    dashboard: true, customers: true, products: true, invoices: true,
    installments: true, employees: false, branches: false, reports: false,
    settings: false, auditLog: false, users: false, backup: false, offers: false,
  },
  accountant: {
    dashboard: true, customers: true, products: true, invoices: true,
    installments: true, employees: true, branches: true, reports: true,
    settings: false, auditLog: true, users: false, backup: false, offers: true,
  },
};
