// ==============================
// Backup Module
// ==============================

import type {
  Customer, Product, Invoice, Employee, Branch, Receipt,
  Offer, StockMovement, ProductReturn, Shift, AttendanceRecord,
  Expense, AuditLogEntry, UserAccount, CompanySettings,
} from "./types";

export interface BackupMeta {
  id: string;
  timestamp: string;
  size: number;
  type: "auto" | "manual";
  label?: string;
}

export interface CloudConfig {
  enabled: boolean;
  provider: "lovable-cloud" | "onedrive" | "none";
  lastSync?: string;
  autoSync: boolean;
}

const MAX_AUTO_BACKUPS = 7;
const AUTO_BACKUP_KEY = "auto_backup_list";
const AUTO_BACKUP_INTERVAL_KEY = "auto_backup_interval";
const LAST_AUTO_BACKUP_KEY = "last_auto_backup";

// Will be set by store.ts
let getBackupDataFn: () => any = () => ({});
let importBackupFn: (json: string) => boolean = () => false;

export function setBackupDeps(getDataFn: typeof getBackupDataFn, importFn: typeof importBackupFn) {
  getBackupDataFn = getDataFn;
  importBackupFn = importFn;
}

export function exportBackup(): string {
  return JSON.stringify(getBackupDataFn(), null, 2);
}

export function exportBackupAsFile(): Blob {
  const json = exportBackup();
  return new Blob([json], { type: "application/json" });
}

export function getAutoBackupList(): BackupMeta[] {
  try {
    const saved = localStorage.getItem(AUTO_BACKUP_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

function saveAutoBackupList(list: BackupMeta[]) {
  localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(list));
}

export function createAutoBackup(): BackupMeta | null {
  try {
    const json = JSON.stringify(getBackupDataFn());
    const id = `auto_${Date.now()}`;
    const meta: BackupMeta = {
      id,
      timestamp: new Date().toISOString(),
      size: new Blob([json]).size,
      type: "auto",
    };
    localStorage.setItem(`backup_${id}`, json);
    const list = getAutoBackupList();
    list.unshift(meta);
    while (list.length > MAX_AUTO_BACKUPS) {
      const old = list.pop();
      if (old) localStorage.removeItem(`backup_${old.id}`);
    }
    saveAutoBackupList(list);
    localStorage.setItem(LAST_AUTO_BACKUP_KEY, new Date().toISOString());
    return meta;
  } catch (e) {
    console.warn("Auto-backup failed:", e);
    return null;
  }
}

export function createManualBackup(label?: string): BackupMeta | null {
  try {
    const json = JSON.stringify(getBackupDataFn());
    const id = `manual_${Date.now()}`;
    const meta: BackupMeta = {
      id,
      timestamp: new Date().toISOString(),
      size: new Blob([json]).size,
      type: "manual",
      label,
    };
    localStorage.setItem(`backup_${id}`, json);
    const list = getAutoBackupList();
    list.unshift(meta);
    saveAutoBackupList(list);
    return meta;
  } catch (e) {
    console.warn("Manual backup failed:", e);
    return null;
  }
}

export function restoreFromBackupId(id: string): boolean {
  try {
    const json = localStorage.getItem(`backup_${id}`);
    if (!json) return false;
    return importBackupFn(json);
  } catch {
    return false;
  }
}

export function deleteBackup(id: string) {
  localStorage.removeItem(`backup_${id}`);
  const list = getAutoBackupList().filter(b => b.id !== id);
  saveAutoBackupList(list);
}

export function getLastAutoBackupTime(): string | null {
  return localStorage.getItem(LAST_AUTO_BACKUP_KEY);
}

export function getAutoBackupInterval(): number {
  try {
    const v = localStorage.getItem(AUTO_BACKUP_INTERVAL_KEY);
    if (v) return parseInt(v, 10);
  } catch {}
  return 24;
}

export function setAutoBackupInterval(hours: number) {
  localStorage.setItem(AUTO_BACKUP_INTERVAL_KEY, String(hours));
}

export function checkAndRunAutoBackup(): boolean {
  const interval = getAutoBackupInterval();
  const last = getLastAutoBackupTime();
  if (!last) {
    createAutoBackup();
    return true;
  }
  const elapsed = (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60);
  if (elapsed >= interval) {
    createAutoBackup();
    return true;
  }
  return false;
}

export function getCloudConfig(): CloudConfig {
  try {
    const saved = localStorage.getItem("cloud_config");
    if (saved) return JSON.parse(saved);
  } catch {}
  return { enabled: false, provider: "none", autoSync: false };
}

export function updateCloudConfig(config: Partial<CloudConfig>) {
  const current = getCloudConfig();
  const updated = { ...current, ...config };
  localStorage.setItem("cloud_config", JSON.stringify(updated));
}
