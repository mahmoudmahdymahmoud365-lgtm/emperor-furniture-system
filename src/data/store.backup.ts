// ==============================
// Backup Module — REAL server-backed only.
// Local backups live on the SERVER disk at the configured path.
// OneDrive integration is fully server-side.
// ==============================

import { api } from "./apiClient";

export interface BackupMeta {
  id: string;
  filename: string;
  size: number;
  createdAt: string;
  type: "auto" | "manual" | "safety";
  label?: string;
}

export interface BackupConfig {
  localPath: string;
  defaultPath: string;
  pathExists: boolean;
  autoEnabled: boolean;
  intervalHours: number;
  onedriveUpload: boolean;
}

export interface OneDriveStatus {
  configured: boolean;
  connected: boolean;
  reason?: string;
  accountEmail?: string | null;
  accountName?: string | null;
  expiresAt?: string | null;
  lastSync?: string | null;
  lastSyncStatus?: "ok" | "error" | null;
  lastSyncError?: string | null;
}

// store.ts wires this for legacy compatibility (no-op now)
let _getBackupDataFn: () => any = () => ({});
let _importBackupFn: (json: string) => boolean = () => false;
export function setBackupDeps(getDataFn: typeof _getBackupDataFn, importFn: typeof _importBackupFn) {
  _getBackupDataFn = getDataFn;
  _importBackupFn = importFn;
}

// ==============================
// Backup config
// ==============================
export async function getBackupConfig(): Promise<BackupConfig> {
  return api.getBackupConfig();
}
export async function updateBackupConfig(patch: Partial<Pick<BackupConfig, "localPath" | "autoEnabled" | "intervalHours" | "onedriveUpload">>): Promise<BackupConfig> {
  const res = await api.updateBackupConfig(patch);
  return res.config;
}

// ==============================
// Server backups
// ==============================
export async function getServerBackups(): Promise<BackupMeta[]> {
  try { return await api.getBackups(); } catch { return []; }
}

export async function createServerBackup(type: "auto" | "manual" = "manual", label?: string) {
  return api.createBackup(type, label);
}

export async function restoreServerBackup(id: string): Promise<boolean> {
  try { await api.restoreBackup(id); return true; } catch { return false; }
}

export async function deleteServerBackup(id: string): Promise<void> {
  await api.deleteBackup(id);
}

export function getBackupDownloadUrl(id: string): string {
  return api.downloadBackupUrl(id);
}

// Restore by uploading a backup JSON file (sent to server)
export async function restoreFromUpload(jsonStr: string): Promise<boolean> {
  try {
    const data = JSON.parse(jsonStr);
    const backupData = data.data ? data : { data };
    await api.restoreBackupUpload(backupData);
    return true;
  } catch { return false; }
}

// ==============================
// OneDrive
// ==============================
export async function getOneDriveStatus(): Promise<OneDriveStatus> {
  return api.oneDriveStatus();
}
export async function getOneDriveAuthUrl(): Promise<string> {
  const r = await api.oneDriveAuthUrl();
  return r.url;
}
export async function disconnectOneDrive(): Promise<void> {
  await api.oneDriveDisconnect();
}
