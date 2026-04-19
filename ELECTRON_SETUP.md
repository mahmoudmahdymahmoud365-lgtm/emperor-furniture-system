# 🖥️ تحويل المشروع إلى تطبيق Desktop (Electron + SQLite)

## المتطلبات

- Node.js 18+
- npm أو yarn

---

## الخطوات

### 1. تثبيت الحزم

```bash
npm install --save-dev electron electron-builder
npm install better-sqlite3
```

### 2. تعديل package.json

أضف الحقول التالية:

```json
{
  "main": "electron/main.js",
  "scripts": {
    "electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:5173 && NODE_ENV=development electron .\"",
    "electron:build": "npm run build && electron-builder"
  },
  "build": {
    "appId": "com.emperor.furniture",
    "productName": "الامبراطور للأثاث",
    "files": [
      "dist/**/*",
      "electron/**/*",
      "public/**/*"
    ],
    "directories": {
      "output": "release"
    },
    "win": {
      "target": "nsis",
      "icon": "public/logo.png"
    },
    "mac": {
      "target": "dmg"
    },
    "linux": {
      "target": "AppImage"
    }
  }
}
```

ثبّت أدوات التطوير الإضافية:

```bash
npm install --save-dev concurrently wait-on
```

### 3. تبديل Store للعمل مع SQLite

```bash
# احتفظ بنسخة الويب
mv src/data/store.ts src/data/store.web.ts

# فعّل نسخة Electron
mv src/data/store.electron.ts src/data/store.ts
```

### 4. تشغيل في وضع التطوير

```bash
npm run electron:dev
```

### 5. بناء التطبيق للتوزيع

```bash
npm run electron:build
```

سيتم إنشاء ملف التثبيت في مجلد `release/`.

---

## هيكل الملفات

```
electron/
├── main.js        ← العملية الرئيسية (Main Process)
├── preload.js     ← الجسر بين المتصفح و Node.js
└── database.js    ← منطق SQLite (CRUD)

src/data/
├── store.ts           ← النسخة الحالية (ذاكرة مؤقتة)
├── store.electron.ts  ← النسخة البديلة (SQLite عبر IPC)
├── hooks.ts           ← لا تحتاج تعديل
└── types.ts           ← لا تحتاج تعديل
```

---

## ملاحظات مهمة

- **لا تعارضات ESM**: جميع ملفات Electron مكتوبة بصيغة CommonJS
- **contextIsolation: true**: الأمان مفعّل — لا يوجد وصول مباشر لـ Node.js من المتصفح
- **قاعدة البيانات**: تُحفظ تلقائياً في `userData` (مسار آمن لكل مستخدم)
- **hooks.ts**: لا تحتاج أي تعديل — تعمل مع كلا النسختين
- **الطباعة واللوجو**: تعمل كما هي بدون تغيير
