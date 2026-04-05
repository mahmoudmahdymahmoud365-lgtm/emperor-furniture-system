// ==============================
// Backup Module — API-backed (server-side storage)
// ==============================

import { api } from "./apiClient";

export interface BackupMeta {
  id: string;
  filename: string;
  size: number;
  createdAt: string;
  type: "auto" | "manual";
  label?: string;
}

export interface CloudConfig {
  enabled: boolean;
  provider: "lovable-cloud" | "onedrive" | "none";
  lastSync?: string;
  autoSync: boolean;
}

// Will be set by store.ts
let getBackupDataFn: () => any = () => ({});
let importBackupFn: (json: string) => boolean = () => false;

export function setBackupDeps(getDataFn: typeof getBackupDataFn, importFn: typeof importBackupFn) {
  getBackupDataFn = getDataFn;
  importBackupFn = importFn;
}

// ==============================
// Server-side backup operations
// ==============================

export async function getServerBackups(): Promise<BackupMeta[]> {
  try {
    return await api.getBackups();
  } catch {
    return [];
  }
}

export async function createServerBackup(type: "auto" | "manual" = "manual", label?: string): Promise<BackupMeta | null> {
  try {
    return await api.createBackup(type, label);
  } catch (e) {
    console.error("Backup failed:", e);
    return null;
  }
}

export async function restoreServerBackup(id: string): Promise<boolean> {
  try {
    await api.restoreBackup(id);
    return true;
  } catch {
    return false;
  }
}

export async function deleteServerBackup(id: string): Promise<void> {
  await api.deleteBackup(id);
}

export function getBackupDownloadUrl(id: string): string {
  return api.downloadBackupUrl(id);
}

// ==============================
// Client-side export (download JSON file)
// ==============================
export function exportBackup(): string {
  return JSON.stringify(getBackupDataFn(), null, 2);
}

export function exportBackupAsFile(): Blob {
  return new Blob([exportBackup()], { type: "application/json" });
}

// ==============================
// Client-side restore from uploaded file (sends to server)
// ==============================
export async function restoreFromUpload(jsonStr: string): Promise<boolean> {
  try {
    const data = JSON.parse(jsonStr);
    // If it's a server backup format, extract data
    const backupData = data.data || data;
    await api.restoreBackupUpload({ data: backupData });
    return true;
  } catch {
    return false;
  }
}

// ==============================
// Legacy compatibility — localStorage-based (deprecated, kept for migration)
// ==============================
export function getAutoBackupList(): BackupMeta[] { return []; }
export function createAutoBackup(): BackupMeta | null { return null; }
export function createManualBackup(label?: string): BackupMeta | null { return null; }
export function restoreFromBackupId(_id: string): boolean { return false; }
export function deleteBackup(_id: string) {}
export function getLastAutoBackupTime(): string | null { return null; }
export function getAutoBackupInterval(): number { return 24; }
export function setAutoBackupInterval(_hours: number) {}
export function checkAndRunAutoBackup(): boolean { return false; }
export function importBackup(_json: string): boolean { return false; }

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
