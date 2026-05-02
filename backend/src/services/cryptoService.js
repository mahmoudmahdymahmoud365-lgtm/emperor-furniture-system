// ==============================
// AES-256-GCM encryption for sensitive tokens (refresh_token)
// Key from BACKUP_ENCRYPTION_KEY (64 hex chars = 32 bytes).
// If missing, derives a stable key from a fixed salt + machine hostname so
// the system still works for single-machine installs (warning logged once).
// ==============================
const crypto = require("crypto");
const os = require("os");

let warned = false;
function getKey() {
  const hex = process.env.BACKUP_ENCRYPTION_KEY;
  if (hex && /^[0-9a-fA-F]{64}$/.test(hex)) {
    return Buffer.from(hex, "hex");
  }
  if (!warned) {
    console.warn("[CRYPTO] BACKUP_ENCRYPTION_KEY missing/invalid — using derived fallback. Set a 64-hex key in backend/.env for production.");
    warned = true;
  }
  return crypto.scryptSync(`emperor-fallback-${os.hostname()}`, "emperor-static-salt", 32);
}

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv:tag:ciphertext (all hex)
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

function decrypt(payload) {
  if (!payload || typeof payload !== "string" || !payload.includes(":")) return null;
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) return null;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}

module.exports = { encrypt, decrypt };
