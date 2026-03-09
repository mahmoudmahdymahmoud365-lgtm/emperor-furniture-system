// ==============================
// Security Utilities
// ==============================

/**
 * Hash a password using SHA-256 with a salt
 */
export async function hashPassword(password: string, salt?: string): Promise<string> {
  const usedSalt = salt || generateSalt();
  const data = new TextEncoder().encode(usedSalt + password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return `${usedSalt}:${hashHex}`;
}

/**
 * Verify a password against a stored hash
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // Support legacy plain-text passwords (migration)
  if (!storedHash.includes(":") || storedHash.length < 40) {
    return password === storedHash;
  }
  const [salt] = storedHash.split(":");
  const newHash = await hashPassword(password, salt);
  return newHash === storedHash;
}

/**
 * Generate a random salt
 */
function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Password strength validation
 */
export interface PasswordStrength {
  score: number; // 0-4
  label: string;
  color: string;
  errors: string[];
}

export function checkPasswordStrength(password: string): PasswordStrength {
  const errors: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  else errors.push("يجب أن تكون 8 أحرف على الأقل");

  if (password.length >= 12) score++;

  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  else if (password.length > 0) errors.push("يجب أن تحتوي على حروف كبيرة وصغيرة");

  if (/\d/.test(password)) score++;
  else if (password.length > 0) errors.push("يجب أن تحتوي على رقم واحد على الأقل");

  if (/[^A-Za-z0-9]/.test(password)) score++;
  else if (password.length > 0) errors.push("يُفضل إضافة رمز خاص (!@#$...)");

  // Cap at 4
  score = Math.min(score, 4);

  const labels = ["ضعيفة جداً", "ضعيفة", "متوسطة", "قوية", "قوية جداً"];
  const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500", "bg-emerald-500"];

  return { score, label: labels[score], color: colors[score], errors };
}

/**
 * Sanitize text for safe HTML insertion (prevent XSS)
 */
export function escapeHtml(text: string | undefined | null): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Rate limiter for login attempts
 */
const loginAttempts: Record<string, { count: number; lastAttempt: number; lockedUntil: number }> = {};

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes
const ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes

export function checkRateLimit(email: string): { allowed: boolean; remainingAttempts: number; lockedUntilMs?: number } {
  const key = email.toLowerCase().trim();
  const now = Date.now();
  const record = loginAttempts[key];

  if (!record) {
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
  }

  // Check if locked
  if (record.lockedUntil > now) {
    return { allowed: false, remainingAttempts: 0, lockedUntilMs: record.lockedUntil - now };
  }

  // Reset if window expired
  if (now - record.lastAttempt > ATTEMPT_WINDOW) {
    delete loginAttempts[key];
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
  }

  return { allowed: true, remainingAttempts: Math.max(0, MAX_ATTEMPTS - record.count) };
}

export function recordLoginAttempt(email: string, success: boolean) {
  const key = email.toLowerCase().trim();
  const now = Date.now();

  if (success) {
    delete loginAttempts[key];
    return;
  }

  if (!loginAttempts[key]) {
    loginAttempts[key] = { count: 0, lastAttempt: now, lockedUntil: 0 };
  }

  loginAttempts[key].count++;
  loginAttempts[key].lastAttempt = now;

  if (loginAttempts[key].count >= MAX_ATTEMPTS) {
    loginAttempts[key].lockedUntil = now + LOCKOUT_DURATION;
  }
}

/**
 * Validate and sanitize email input
 */
export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase().slice(0, 255);
}

/**
 * Validate input length
 */
export function validateInputLength(value: string, maxLength: number): boolean {
  return value.length <= maxLength;
}
