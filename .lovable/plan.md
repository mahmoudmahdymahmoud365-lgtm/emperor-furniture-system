## خطة التنفيذ — Emperor ERP/POS Enhancements

### 1) ألوان المنتجات الاختيارية
**Backend:**
- Migration: `ALTER TABLE products ADD COLUMN has_color_variants BOOLEAN DEFAULT FALSE`
- تحديث `routes/products.js` للقراءة/الكتابة
- في `db.js`: التأكد من توافق الـ migration مع pg-mem

**Frontend:**
- `types.ts`: إضافة `hasColorVariants?: boolean`
- `Products.tsx`: Checkbox "هذا المنتج له ألوان محددة" — إذا غير مفعل، إخفاء حقل الألوان
- `Invoices.tsx` + `POS.tsx`: إذا `hasColorVariants=false` → عدم عرض dropdown الألوان، `color=null`
- `demoMode.ts`: دعم نفس الحقل

### 2) نوع عرض جديد: fixed_price
**Backend:**
- توسيع `OfferType` ليشمل `fixed_price`
- لا migration لازمة (type نصي) — فقط تحديث logic

**Frontend:**
- `types.ts`: `OfferType = "percentage" | "fixed" | "fixed_price" | "timed"`
- `OFFER_TYPE_LABELS`: إضافة "سعر ثابت للمنتج"
- `Offers.tsx`: UI واضح للنوع الجديد
- `Invoices.tsx` + `POS.tsx`: عند تطبيق العرض، إذا `fixed_price` → استبدال `unitPrice` بقيمة العرض بدلاً من خصم

### 3) التسويات المالية (Customer Balance Adjustments)
**Backend:**
- Migration: جدول جديد
```sql
CREATE TABLE customer_balance_adjustments (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  invoice_id TEXT,
  adjustment_type TEXT NOT NULL, -- 'discount' | 'debt_settlement' | 'interest' | 'manual'
  amount NUMERIC(14,2) NOT NULL, -- موجب يزيد، سالب يقلل
  reason TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE SEQUENCE adjustments_seq;
```
- Route جديد: `routes/adjustments.js` (GET list, POST create, DELETE)
- كل INSERT يكتب تلقائياً إلى `audit_log` (user, before, after, reason)
- تسجيل في `server.js`

**Frontend:**
- `types.ts`: `BalanceAdjustment` interface + enum
- `apiClient.ts` + `store.ts`: CRUD methods
- صفحة/Dialog داخل `CustomerReport.tsx` لإضافة تسوية
- حساب الرصيد: invoice total − payments + sum(adjustments)
- `demoMode.ts`: دعم الجدول

### 4) فائدة/تعديل المتبقي على الأقساط
- استخدام نفس `customer_balance_adjustments` مع `adjustment_type='interest'` و `invoice_id` محدد
- `Installments.tsx`: زر "إضافة فائدة/تسوية" يفتح dialog ينشئ adjustment
- العرض في كشف العميل والفاتورة

### 5) وحدة القياس (Unit)
- الحقل `unit` موجود بالفعل في `products` و invoice items عبر `productName` lookup
- إضافة `unit` صراحة لكل `InvoiceItem` (snapshot) لكي لا تتأثر الفواتير القديمة بتغيير وحدة المنتج
- Migration: لا شيء (items JSONB)
- Frontend: عند إضافة بند، نسخ `unit` من المنتج
- عرض الوحدة في: الطباعة، POS، Invoices grid، Reports، Offers

### 6) إصلاح حالة الفاتورة
- توحيد statuses: `draft | pending | partially_paid | paid | cancelled`
- في backend `routes/invoices.js`: helper يحسب status تلقائياً عند POST/PUT بناءً على paid/total/cancelled
- دالة `recomputeInvoiceStatus(invoice)` تستدعى أيضاً عند POST/DELETE في `receipts.js` و `adjustments.js`
- في frontend: إزالة أي manual status override إلا للأدمن (permission check)
- Cache invalidation: التأكد من `refreshInvoices()` بعد كل update
- Labels عربية ثابتة في `INVOICE_STATUS_LABELS`

### 7) التوافق مع pg-mem
- جميع الـ migrations: SQL standard فقط (no PG extensions)
- استخدام `nextval('seq')` و `LPAD` (مدعومة)
- `JSONB` → `JSON` في pg-mem mode (التحقق من db.js)
- لا triggers

### الملفات المتأثرة
**Backend:** `migrations.js`, `routes/products.js`, `routes/invoices.js`, `routes/offers.js`, `routes/receipts.js`, `routes/adjustments.js` (جديد), `server.js`, `db.js`

**Frontend:** `data/types.ts`, `data/apiClient.ts`, `data/store.ts`, `data/demoMode.ts`, `pages/Products.tsx`, `pages/Offers.tsx`, `pages/Invoices.tsx`, `pages/POS.tsx`, `pages/CustomerReport.tsx`, `pages/Installments.tsx`, `components/InvoicePrint.tsx`

### ترتيب التنفيذ
1. Migrations + db schema (products.has_color_variants, adjustments table, invoice status enum values)
2. Backend routes (products, offers, invoices status helper, adjustments)
3. types.ts + apiClient + demoMode
4. Frontend pages (Products → Offers → Invoices/POS → Customer/Installments)
5. InvoicePrint للوحدة والتسويات
6. اختبار سريع: build + console
