// ==============================
// IndexedDB Image Storage
// Images stored as Blobs, not Base64
// ==============================

import type { StoredImage } from "./types";

const DB_NAME = "emperor_images";
const DB_VERSION = 1;
const IMAGES_STORE = "images";
const META_STORE = "meta";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IMAGES_STORE)) {
        db.createObjectStore(IMAGES_STORE); // key = image id
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveImage(file: File, meta: Omit<StoredImage, "id" | "fileName" | "mimeType" | "size" | "createdAt">): Promise<StoredImage> {
  const db = await openDB();
  const id = `IMG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const entry: StoredImage = {
    id,
    ...meta,
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
    createdAt: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction([IMAGES_STORE, META_STORE], "readwrite");
    tx.objectStore(IMAGES_STORE).put(file, id);
    tx.objectStore(META_STORE).put(entry);
    tx.oncomplete = () => resolve(entry);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getImageBlob(id: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGES_STORE, "readonly");
    const req = tx.objectStore(IMAGES_STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getImageURL(id: string): Promise<string | null> {
  const blob = await getImageBlob(id);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

export async function getAllImagesMeta(): Promise<StoredImage[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, "readonly");
    const req = tx.objectStore(META_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteImage(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([IMAGES_STORE, META_STORE], "readwrite");
    tx.objectStore(IMAGES_STORE).delete(id);
    tx.objectStore(META_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
