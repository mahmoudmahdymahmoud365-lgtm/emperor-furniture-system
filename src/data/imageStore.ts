// ==============================
// Server-side Image/File Storage
// Uses Express API instead of IndexedDB
// ==============================

import type { StoredImage } from "./types";
import { api } from "./apiClient";

// Convert API response to StoredImage
function toStoredImage(data: any): StoredImage {
  return {
    id: data.id,
    name: data.name,
    type: data.relatedTo || "",
    relatedTo: data.relatedTo || "",
    fileName: data.fileName,
    mimeType: data.mimeType,
    size: data.size,
    createdAt: data.createdAt,
  };
}

export async function saveImage(
  file: File,
  meta: Omit<StoredImage, "id" | "fileName" | "mimeType" | "size" | "createdAt">
): Promise<StoredImage> {
  const result = await api.uploadFile(file, {
    name: meta.name,
    relatedTo: meta.relatedTo || meta.type,
    relatedId: "",
  });
  return toStoredImage(result);
}

export function getImageURL(id: string): string {
  // Return direct URL — no async needed
  return api.getFileURL(id);
}

// Keep async version for backward compatibility
export async function getImageURLAsync(id: string): Promise<string | null> {
  return api.getFileURL(id);
}

export async function getImageBlob(id: string): Promise<Blob | null> {
  try {
    const url = api.getFileURL(id);
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.blob();
  } catch {
    return null;
  }
}

export async function getAllImagesMeta(): Promise<StoredImage[]> {
  try {
    const files = await api.getFiles();
    return files.map(toStoredImage);
  } catch {
    return [];
  }
}

export async function getImagesByRelation(relatedTo: string, relatedId?: string): Promise<StoredImage[]> {
  try {
    const files = await api.getFiles({ relatedTo, relatedId });
    return files.map(toStoredImage);
  } catch {
    return [];
  }
}

export async function deleteImage(id: string): Promise<void> {
  await api.deleteFile(id);
}
