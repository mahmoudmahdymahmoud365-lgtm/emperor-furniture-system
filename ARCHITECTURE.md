# 🏗️ هيكلة النظام: Electron + API Server + PostgreSQL

## الهيكل المعماري

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Electron   │────▶│  Express API     │────▶│  PostgreSQL  │
│   (Frontend) │ HTTP│  (Backend)       │     │  (Database)  │
│   Vite+React │◀────│  Port: 3001      │◀────│  Port: 5432  │
│   Port: 5173 │     └──────────────────┘     └──────────────┘
└──────────────┘
        ▲
        │ يمكن فتحه من أي جهاز على نفس الشبكة
        │
┌──────────────┐
│   Electron   │ (جهاز آخر / فرع آخر)
│   (Frontend) │
└──────────────┘
```

## المتطلبات

- **Node.js 18+**
- **PostgreSQL 14+** (مثبت ويعمل)
- **npm** أو **yarn**

---

## خطوات التشغيل

### 1. إعداد قاعدة البيانات PostgreSQL

```bash
# إنشاء قاعدة البيانات
createdb emperor_furniture

# أو من داخل psql
psql -U postgres -c "CREATE DATABASE emperor_furniture;"
```

### 2. إعداد Backend

```bash
cd backend

# نسخ ملف الإعدادات
cp .env.example .env

# تعديل .env بيانات الاتصال الصحيحة
# DATABASE_URL=postgresql://postgres:password@localhost:5432/emperor_furniture

# تثبيت الحزم
npm install

# تهيئة الجداول
node src/initDb.js

# تشغيل السيرفر
npm run dev
```

### 3. تبديل Store للعمل مع API

```bash
# احتفظ بالنسخة الأصلية
cp src/data/store.ts src/data/store.local.ts

# فعّل نسخة API
cp src/data/store.api.ts src/data/store.ts
```

### 4. تبديل Electron للعمل مع API

```bash
# احتفظ بالنسخة الأصلية
cp electron/main.js electron/main.sqlite.js

# فعّل نسخة API
cp electron/main.api.js electron/main.js
```

### 5. تشغيل كل شيء معاً (وضع التطوير)

أضف هذا السكربت في `package.json` الرئيسي:

```json
{
  "scripts": {
    "dev:all": "concurrently \"npm run dev\" \"cd backend && npm run dev\" \"wait-on http://localhost:5173 && NODE_ENV=development electron .\""
  }
}
```

ثم:
```bash
npm install --save-dev concurrently wait-on
npm run dev:all
```

### 6. بناء التطبيق للإنتاج

```bash
# بناء Frontend
npm run build

# تشغيل Backend على سيرفر مركزي
cd backend && npm start

# بناء Electron
npx electron-builder
```

---

## الإعدادات المتقدمة

### تشغيل على عدة أجهزة

1. شغّل **Backend + PostgreSQL** على سيرفر مركزي (أو جهاز واحد)
2. في كل جهاز Electron، عدّل `API_URL`:

```bash
# في متغيرات البيئة للجهاز
API_URL=http://192.168.1.100:3001/api
```

أو عدّل `src/data/apiClient.ts`:
```typescript
const API_BASE = "http://SERVER_IP:3001/api";
```

### تشغيل فروع متعددة

كل فرع يتصل بنفس **Backend + PostgreSQL** المركزي. البيانات مشتركة ومتزامنة تلقائياً.

---

## هيكل الملفات

```
backend/
├── package.json
├── .env.example
├── .env                  ← إعدادات الاتصال (لا ترفعه لـ Git)
└── src/
    ├── server.js         ← Express API Server
    ├── db.js             ← PostgreSQL Connection Pool
    ├── initDb.js         ← إنشاء الجداول
    └── routes/
        ├── customers.js
        ├── products.js
        ├── invoices.js
        ├── employees.js
        ├── branches.js
        ├── receipts.js
        ├── offers.js
        ├── stockMovements.js
        ├── returns.js
        ├── shifts.js
        ├── attendance.js
        ├── expenses.js
        ├── users.js
        ├── settings.js
        ├── auditLog.js
        └── securityLog.js

src/data/
├── store.ts              ← النسخة النشطة (localStorage أو API)
├── store.api.ts          ← نسخة API (PostgreSQL)
├── store.local.ts        ← نسخة localStorage (الأصلية)
├── store.electron.ts     ← نسخة SQLite (Electron مستقل)
├── apiClient.ts          ← HTTP Client للتواصل مع Backend
├── hooks.ts              ← لا تحتاج تعديل ✅
└── types.ts              ← لا تحتاج تعديل ✅

electron/
├── main.js               ← النسخة النشطة
├── main.api.js           ← نسخة API Server
├── main.sqlite.js        ← نسخة SQLite المستقلة
├── preload.js
└── database.js           ← منطق SQLite (للنسخة المستقلة)
```

---

## ملاحظات مهمة

- **hooks.ts لا تحتاج أي تعديل** — تعمل مع كل النسخ
- **types.ts لا تحتاج أي تعديل** — مشتركة بين الجميع
- **الـ Polling** يتم كل 10 ثوانٍ لمزامنة البيانات بين الأجهزة
- **قاعدة البيانات مركزية** — أي تغيير يظهر فوراً على كل الأجهزة
- **كلمات المرور** لا تزال نص عادي — يُنصح بإضافة bcrypt مستقبلاً
