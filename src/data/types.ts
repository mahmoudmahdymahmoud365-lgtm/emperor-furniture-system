// ==============================
// Unified Type Definitions
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
  notes?: string;
  // Manufacturing tracking
  manufacturingStatus?: ManufacturingStatus;
  manufacturingNotes?: string;
  manufacturingUpdatedAt?: string;
  // Recurring invoice
  isRecurring?: boolean;
  recurringInterval?: RecurringInterval;
  recurringNextDate?: string;
  recurringTemplateId?: string;
  // Installment schedule
  nextDueDate?: string;
  installmentCount?: number;
}

export type ManufacturingStatus = "pending" | "in_production" | "quality_check" | "ready" | "delivered";

export const MANUFACTURING_STATUS_LABELS: Record<ManufacturingStatus, string> = {
  pending: "في الانتظار",
  in_production: "قيد التصنيع",
  quality_check: "فحص الجودة",
  ready: "جاهز للتسليم",
  delivered: "تم التسليم",
};

export const MANUFACTURING_STATUS_COLORS: Record<ManufacturingStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  in_production: "bg-info/10 text-info",
  quality_check: "bg-warning/10 text-warning",
  ready: "bg-success/10 text-success",
  delivered: "bg-primary/10 text-primary",
};

export type RecurringInterval = "weekly" | "monthly" | "quarterly" | "yearly";

export const RECURRING_INTERVAL_LABELS: Record<RecurringInterval, string> = {
  weekly: "أسبوعي",
  monthly: "شهري",
  quarterly: "ربع سنوي",
  yearly: "سنوي",
};

export interface CompanySettings {
  name: string;
  address: string;
  phone: string;
  phones: string[];
  email: string;
  emails: string[];
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

// ==============================
// Shifts & Attendance
// ==============================
export interface Shift {
  id: string;
  name: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  hours: number;
  branch: string;
  active: boolean;
  notes: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  shiftId: string;
  shiftName: string;
  date: string;
  checkIn: string;  // HH:mm
  checkOut: string;  // HH:mm
  hoursWorked: number;
  status: AttendanceStatus;
  overtimeHours: number;
  notes: string;
}

export type AttendanceStatus = "present" | "absent" | "late" | "leave" | "half-day";

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "حاضر",
  absent: "غائب",
  late: "متأخر",
  leave: "إجازة",
  "half-day": "نصف يوم",
};

export const ATTENDANCE_STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: "bg-success/10 text-success",
  absent: "bg-destructive/10 text-destructive",
  late: "bg-warning/10 text-warning",
  leave: "bg-info/10 text-info",
  "half-day": "bg-muted text-muted-foreground",
};

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
  value: number;
  productId: string;
  productName: string;
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
// Stock Movements
// ==============================
export type StockMovementType = "in" | "out" | "return" | "adjustment";

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: StockMovementType;
  qty: number;
  date: string;
  reason: string;
  relatedId?: string;
}

export const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  in: "وارد",
  out: "صادر",
  return: "مرتجع",
  adjustment: "تعديل يدوي",
};

// ==============================
// Returns
// ==============================
export interface ReturnItem {
  productName: string;
  qty: number;
  unitPrice: number;
}

export interface ProductReturn {
  id: string;
  invoiceId: string;
  customer: string;
  date: string;
  items: ReturnItem[];
  totalAmount: number;
  reason: string;
  notes: string;
}

// ==============================
// Stored Images (IndexedDB)
// ==============================
export interface StoredImage {
  id: string;
  name: string;
  type: string;
  relatedTo: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

// ==============================
// Security Events
// ==============================
export interface SecurityEvent {
  id: string;
  type: "login_success" | "login_failed" | "logout" | "password_change" | "session_expired";
  email: string;
  userName: string;
  timestamp: string;
  ip?: string;
  userAgent?: string;
}

// ==============================
// Audit Log
// ==============================
export type AuditAction = "create" | "update" | "delete";
export type AuditEntity = "customer" | "product" | "invoice" | "employee" | "branch" | "receipt" | "settings" | "offer" | "return" | "stock" | "shift" | "attendance" | "expense";

// ==============================
// Expenses
// ==============================
export type ExpenseCategory = "electricity" | "water" | "food" | "drinks" | "rent" | "salaries" | "maintenance" | "transport" | "supplies" | "other";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  electricity: "كهرباء",
  water: "مياه",
  food: "طعام",
  drinks: "مشروبات",
  rent: "إيجارات",
  salaries: "مرتبات",
  maintenance: "صيانة",
  transport: "نقل ومواصلات",
  supplies: "مستلزمات",
  other: "أخرى",
};

export interface Expense {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  date: string;
  branch: string;
  paidBy: string;
  recurring: boolean;
  notes: string;
}

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

// Operation-level permission type
export type ModuleAccess = boolean | { view: boolean; create: boolean; edit: boolean; delete: boolean };

export interface RolePermissions {
  dashboard: boolean;
  customers: ModuleAccess;
  products: ModuleAccess;
  invoices: ModuleAccess;
  installments: ModuleAccess;
  employees: ModuleAccess;
  branches: ModuleAccess;
  reports: boolean;
  settings: boolean;
  auditLog: boolean;
  users: boolean;
  backup: boolean;
  offers: ModuleAccess;
  inventory: ModuleAccess;
  returns: ModuleAccess;
}

// Helper to check specific operation permission
export function canDo(perm: ModuleAccess | undefined, op: "view" | "create" | "edit" | "delete"): boolean {
  if (perm === undefined || perm === false) return false;
  if (perm === true) return true;
  return perm[op] === true;
}

export const OPERATION_LABELS: Record<string, string> = {
  view: "عرض",
  create: "إضافة",
  edit: "تعديل",
  delete: "حذف",
};

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
  inventory: "المخزون",
  returns: "المرتجعات",
};

export const DEFAULT_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    dashboard: true,
    customers: { view: true, create: true, edit: true, delete: true },
    products: { view: true, create: true, edit: true, delete: true },
    invoices: { view: true, create: true, edit: true, delete: true },
    installments: { view: true, create: true, edit: true, delete: true },
    employees: { view: true, create: true, edit: true, delete: true },
    branches: { view: true, create: true, edit: true, delete: true },
    reports: true, settings: true, auditLog: true, users: true, backup: true,
    offers: { view: true, create: true, edit: true, delete: true },
    inventory: { view: true, create: true, edit: true, delete: true },
    returns: { view: true, create: true, edit: true, delete: true },
  },
  sales: {
    dashboard: true,
    customers: { view: true, create: true, edit: false, delete: false },
    products: { view: true, create: false, edit: false, delete: false },
    invoices: { view: true, create: true, edit: false, delete: false },
    installments: { view: true, create: true, edit: false, delete: false },
    employees: false, branches: false, reports: false,
    settings: false, auditLog: false, users: false, backup: false, offers: false, inventory: false,
    returns: { view: true, create: true, edit: false, delete: false },
  },
  accountant: {
    dashboard: true,
    customers: { view: true, create: true, edit: true, delete: false },
    products: { view: true, create: true, edit: true, delete: false },
    invoices: { view: true, create: true, edit: true, delete: false },
    installments: { view: true, create: true, edit: true, delete: false },
    employees: { view: true, create: false, edit: false, delete: false },
    branches: { view: true, create: false, edit: false, delete: false },
    reports: true, settings: false, auditLog: true, users: false, backup: false,
    offers: { view: true, create: true, edit: true, delete: false },
    inventory: { view: true, create: true, edit: true, delete: false },
    returns: { view: true, create: true, edit: false, delete: false },
  },
};
