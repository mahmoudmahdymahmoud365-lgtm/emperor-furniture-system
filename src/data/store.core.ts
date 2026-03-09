// ==============================
// Store Core: Helpers, Persistence, Subscription
// ==============================

// ---- Generic persistence helpers ----
export function loadFromStorage<T>(key: string, fallback: T[]): T[] {
  try {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);
  } catch {}
  return [...fallback];
}

export function saveToStorage<T>(key: string, data: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn(`Failed to save ${key}:`, e);
  }
}

// ---- Generic ID helper ----
export function nextId(prefix: string, list: { id: string }[]): string {
  let maxNum = 0;
  const isInvoice = prefix.includes("INV");
  for (const item of list) {
    const match = item.id.match(/(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  const next = maxNum + 1;
  return isInvoice
    ? `INV-${String(next).padStart(3, "0")}`
    : `${prefix}${String(next).padStart(3, "0")}`;
}

// ---- Change listeners ----
type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notifyListeners() {
  listeners.forEach((fn) => fn());
}
