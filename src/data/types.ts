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
