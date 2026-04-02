// ==============================
// Auth & Users Module
// ==============================

import type { UserAccount, RolePermissions } from "./types";
import { DEFAULT_PERMISSIONS } from "./types";
import { loadFromStorage, saveToStorage, nextId, notifyListeners } from "./store.core";
import { hashPassword, verifyPassword, checkRateLimit, recordLoginAttempt, sanitizeEmail } from "@/utils/security";
import type { SecurityEvent } from "./types";

// ---- Security Log ----
const securityLog: SecurityEvent[] = loadFromStorage("securityLog", []);
let securityLogSnap: SecurityEvent[] = [...securityLog];

function saveSecurityLog() { saveToStorage("securityLog", securityLog); }

export function getSecurityLog(): SecurityEvent[] { return securityLogSnap; }

export function addSecurityEvent(type: SecurityEvent["type"], email: string, userName: string) {
  const event: SecurityEvent = {
    id: `SEC${Date.now().toString(36)}`,
    type, email, userName,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
  };
  securityLog.unshift(event);
  if (securityLog.length > 500) securityLog.splice(500);
  saveSecurityLog();
  securityLogSnap = [...securityLog];
}

export function clearSecurityLog() {
  securityLog.length = 0;
  saveSecurityLog();
  securityLogSnap = [];
  notifyListeners();
}

export function rebuildSecurityLogSnap() {
  securityLogSnap = [...securityLog];
}

// ---- Users ----
const DEFAULT_USERS: UserAccount[] = [
  { id: "U001", name: "المدير", email: "admin@emperor.com", password: "admin123", role: "admin", active: true },
  { id: "U002", name: "موظف مبيعات", email: "sales@emperor.com", password: "sales123", role: "sales", active: true },
  { id: "U003", name: "المحاسب", email: "accountant@emperor.com", password: "acc123", role: "accountant", active: true },
];

const users: UserAccount[] = loadFromStorage("userAccounts", DEFAULT_USERS);
let usersSnap: UserAccount[] = [...users];

function saveUsers() { saveToStorage("userAccounts", users); }

let currentUser: UserAccount | null = null;

export function getUsers(): UserAccount[] { return usersSnap; }
export function getCurrentUser(): UserAccount | null { return currentUser; }
export function _setCurrentUser(user: UserAccount | null) { currentUser = user; }

export function getUserPermissions(): RolePermissions {
  if (!currentUser) return DEFAULT_PERMISSIONS.sales;
  const base = DEFAULT_PERMISSIONS[currentUser.role] || DEFAULT_PERMISSIONS.sales;
  if (currentUser.customPermissions) {
    return { ...base, ...currentUser.customPermissions };
  }
  return base;
}

export function rebuildUsersSnap() {
  usersSnap = [...users];
}

// ---- Audit log reference (will be set by store.ts) ----
let addAuditLogFn: (action: string, entity: string, entityId: string, entityName: string, details: string) => void = () => {};
let notifyFn: (...entities: string[]) => void = () => {};

export function setAuthDeps(auditFn: typeof addAuditLogFn, nFn: typeof notifyFn) {
  addAuditLogFn = auditFn;
  notifyFn = nFn;
}

export async function addUser(data: Omit<UserAccount, "id">): Promise<UserAccount> {
  const hashedPassword = await hashPassword(data.password);
  const u = { id: nextId("U", users), ...data, password: hashedPassword };
  users.push(u);
  saveUsers();
  addAuditLogFn("create", "settings", u.id, u.name, `إضافة مستخدم: ${u.name} (${u.role})`);
  notifyFn("users");
  return u;
}

export async function updateUser(id: string, data: Partial<UserAccount>) {
  const idx = users.findIndex((u) => u.id === id);
  if (idx >= 0) {
    if (data.password && (!data.password.includes(":") || data.password.length < 40)) {
      data.password = await hashPassword(data.password);
    }
    users[idx] = { ...users[idx], ...data };
    saveUsers();
    addAuditLogFn("update", "settings", id, users[idx].name, `تعديل مستخدم: ${users[idx].name}`);
    notifyFn("users");
  }
}

export function deleteUser(id: string) {
  const idx = users.findIndex((u) => u.id === id);
  if (idx >= 0) {
    const name = users[idx].name;
    users.splice(idx, 1);
    saveUsers();
    addAuditLogFn("delete", "settings", id, name, `حذف مستخدم: ${name}`);
    notifyFn("users");
  }
}

// ---- Auth / Session ----
const AUTH_KEY = "isLoggedIn";
const CURRENT_USER_KEY = "currentUserId";
const SESSION_TOKEN_KEY = "sessionToken";
const SESSION_EXPIRY_KEY = "sessionExpiry";
const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours

function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, "0")).join("");
}

export function isAuthenticated(): boolean {
  const token = localStorage.getItem(SESSION_TOKEN_KEY);
  const expiry = localStorage.getItem(SESSION_EXPIRY_KEY);
  const loggedIn = localStorage.getItem(AUTH_KEY) === "true";

  if (!loggedIn || !token || !expiry) return false;

  if (Date.now() > parseInt(expiry, 10)) {
    logout();
    return false;
  }

  return true;
}

export async function login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  const cleanEmail = sanitizeEmail(email);

  const rateCheck = checkRateLimit(cleanEmail);
  if (!rateCheck.allowed) {
    const minutes = Math.ceil((rateCheck.lockedUntilMs || 0) / 60000);
    addSecurityEvent("login_failed", cleanEmail, "محاولات كثيرة");
    return { success: false, error: `تم تجاوز الحد المسموح. حاول بعد ${minutes} دقيقة` };
  }

  const user = users.find((u) => u.email === cleanEmail && u.active);
  if (!user) {
    recordLoginAttempt(cleanEmail, false);
    addSecurityEvent("login_failed", cleanEmail, "");
    return { success: false, error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" };
  }

  const passwordValid = await verifyPassword(password, user.password);
  if (!passwordValid) {
    recordLoginAttempt(cleanEmail, false);
    addSecurityEvent("login_failed", cleanEmail, "");
    const remaining = rateCheck.remainingAttempts - 1;
    return {
      success: false,
      error: remaining > 0
        ? `كلمة المرور غير صحيحة. متبقي ${remaining} محاولات`
        : "تم تجاوز الحد المسموح. حاول لاحقاً"
    };
  }

  // Auto-migrate plain-text passwords to hashed
  if (!user.password.includes(":") || user.password.length < 40) {
    const hashed = await hashPassword(password);
    const idx = users.findIndex(u => u.id === user.id);
    if (idx >= 0) {
      users[idx].password = hashed;
      saveUsers();
    }
  }

  recordLoginAttempt(cleanEmail, true);
  const sessionToken = generateSessionToken();
  localStorage.setItem(AUTH_KEY, "true");
  localStorage.setItem(CURRENT_USER_KEY, user.id);
  localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
  localStorage.setItem(SESSION_EXPIRY_KEY, String(Date.now() + SESSION_DURATION));
  currentUser = user;
  addSecurityEvent("login_success", cleanEmail, user.name);
  return { success: true };
}

export function logout() {
  if (currentUser) {
    addSecurityEvent("logout", currentUser.email, currentUser.name);
  }
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(CURRENT_USER_KEY);
  localStorage.removeItem(SESSION_TOKEN_KEY);
  localStorage.removeItem(SESSION_EXPIRY_KEY);
  currentUser = null;
}

// Restore user on load
(function restoreUser() {
  const userId = localStorage.getItem(CURRENT_USER_KEY);
  if (userId) {
    currentUser = users.find((u) => u.id === userId) || null;
  }
})();
