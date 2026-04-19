// ==============================
// Auth & Users Module — API-First with server-side sessions
// ==============================

import type { UserAccount, RolePermissions } from "./types";
import { DEFAULT_PERMISSIONS } from "./types";
import { notifyListeners } from "./store.core";
import type { SecurityEvent } from "./types";
import { api } from "./apiClient";
import { getSessionToken, clearSessionToken, setOnSessionExpired } from "./apiClient";

// ---- Security Log (API-backed, local buffer for fire-and-forget) ----
let securityLogCache: SecurityEvent[] = [];
let securityLogSnap: SecurityEvent[] = [];

export function getSecurityLog(): SecurityEvent[] { return securityLogSnap; }

export function addSecurityEvent(type: SecurityEvent["type"], email: string, userName: string) {
  const event: SecurityEvent = {
    id: `SEC${Date.now().toString(36)}`,
    type, email, userName,
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
  };
  securityLogCache.unshift(event);
  if (securityLogCache.length > 500) securityLogCache.splice(500);
  securityLogSnap = [...securityLogCache];
  api.addSecurityEvent(event).catch(() => {});
}

export async function clearSecurityLog() {
  try {
    await api.clearSecurityLog();
    securityLogCache = [];
    securityLogSnap = [];
    notifyListeners();
  } catch {}
}

export function rebuildSecurityLogSnap() {
  securityLogSnap = [...securityLogCache];
}

export async function loadSecurityLogFromApi() {
  try {
    const log = await api.getSecurityLog();
    if (Array.isArray(log)) {
      securityLogCache = log;
      securityLogSnap = [...log];
    }
  } catch {}
}

// ---- Users — NO local storage, API only ----
let currentUser: UserAccount | null = null;

export function getUsers(): UserAccount[] { return []; }
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

export function rebuildUsersSnap() {}

// ---- Audit log reference (set by store.ts) ----
let addAuditLogFn: (action: string, entity: string, entityId: string, entityName: string, details: string) => void = () => {};
let notifyFn: (...entities: string[]) => void = () => {};

export function setAuthDeps(auditFn: typeof addAuditLogFn, nFn: typeof notifyFn) {
  addAuditLogFn = auditFn;
  notifyFn = nFn;
}

// ---- Session Management — uses server-issued tokens ----
const CURRENT_USER_KEY = "currentUserData";

// Register session expiry callback — auto-logout on 401
setOnSessionExpired(() => {
  currentUser = null;
  localStorage.removeItem(CURRENT_USER_KEY);
  localStorage.removeItem("isLoggedIn");
  localStorage.removeItem("currentUserId");
  // Force redirect to login
  if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
    window.location.href = "/login";
  }
});

export function isAuthenticated(): boolean {
  const token = getSessionToken();
  if (!token) return false;

  // Restore currentUser from session cache if needed
  if (!currentUser) {
    try {
      const cached = localStorage.getItem(CURRENT_USER_KEY);
      if (cached) {
        currentUser = JSON.parse(cached);
      }
    } catch {}
  }

  return !!currentUser;
}

export function logout() {
  if (currentUser) {
    addSecurityEvent("logout", currentUser.email, currentUser.name);
  }
  // Notify server to destroy session
  api.logoutUser().catch(() => {});
  clearSessionToken();
  localStorage.removeItem(CURRENT_USER_KEY);
  localStorage.removeItem("isLoggedIn");
  localStorage.removeItem("currentUserId");
  currentUser = null;
}

// NOTE: login() is defined in store.ts as API-first — NOT here.
