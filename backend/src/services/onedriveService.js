// ==============================
// Microsoft OneDrive Service — REAL Graph API integration
// OAuth 2.0 (auth code flow) + token refresh + file upload.
// All operations are server-side; tokens never leave the backend.
// ==============================
const fs = require("fs");
const path = require("path");
const pool = require("../db");
const { encrypt, decrypt } = require("./cryptoService");

const TENANT = process.env.MS_TENANT || "common";
const CLIENT_ID = process.env.MS_CLIENT_ID || "";
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.MS_REDIRECT_URI || "http://localhost:3001/api/cloud/onedrive/callback";
const SCOPES = ["offline_access", "Files.ReadWrite", "User.Read"];
const REMOTE_FOLDER = "EmperorBackups";

const AUTH_BASE = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0`;
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

function isConfigured() {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

function buildAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    response_mode: "query",
    scope: SCOPES.join(" "),
    state: state || "emperor",
  });
  return `${AUTH_BASE}/authorize?${params.toString()}`;
}

async function exchangeCodeForToken(code) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
    scope: SCOPES.join(" "),
  });
  const res = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Token exchange failed: ${json.error_description || json.error || res.status}`);
  return json; // { access_token, refresh_token, expires_in, ... }
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: SCOPES.join(" "),
  });
  const res = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Token refresh failed: ${json.error_description || json.error || res.status}`);
  return json;
}

// ==============================
// Token persistence (cloud_tokens table)
// ==============================
async function saveTokens(tokens, accountInfo = {}) {
  const expiresAt = new Date(Date.now() + (tokens.expires_in - 60) * 1000);
  const encryptedRefresh = encrypt(tokens.refresh_token || "");
  // Single-row provider model (one account per provider). Upsert by provider.
  await pool.query(
    `INSERT INTO cloud_tokens (provider, access_token, refresh_token_enc, expires_at, account_email, account_name, updated_at)
     VALUES ('onedrive', $1, $2, $3, $4, $5, NOW())
     ON CONFLICT (provider) DO UPDATE SET
       access_token = EXCLUDED.access_token,
       refresh_token_enc = EXCLUDED.refresh_token_enc,
       expires_at = EXCLUDED.expires_at,
       account_email = COALESCE(EXCLUDED.account_email, cloud_tokens.account_email),
       account_name = COALESCE(EXCLUDED.account_name, cloud_tokens.account_name),
       updated_at = NOW()`,
    [tokens.access_token, encryptedRefresh, expiresAt, accountInfo.email || null, accountInfo.name || null]
  );
}

async function loadTokens() {
  const { rows } = await pool.query(`SELECT * FROM cloud_tokens WHERE provider='onedrive' LIMIT 1`);
  return rows[0] || null;
}

async function clearTokens() {
  await pool.query(`DELETE FROM cloud_tokens WHERE provider='onedrive'`);
}

async function getValidAccessToken() {
  const row = await loadTokens();
  if (!row) throw new Error("OneDrive not connected");
  // If access token still valid (>30s buffer) reuse
  if (row.expires_at && new Date(row.expires_at).getTime() > Date.now() + 30_000) {
    return row.access_token;
  }
  const refreshToken = decrypt(row.refresh_token_enc);
  if (!refreshToken) throw new Error("Stored refresh token unreadable — please reconnect OneDrive");
  const refreshed = await refreshAccessToken(refreshToken);
  await saveTokens({
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token || refreshToken,
    expires_in: refreshed.expires_in || 3600,
  });
  return refreshed.access_token;
}

async function fetchUserInfo(accessToken) {
  const res = await fetch(`${GRAPH_BASE}/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return {};
  const json = await res.json();
  return { email: json.mail || json.userPrincipalName || null, name: json.displayName || null };
}

// ==============================
// Upload backup file to OneDrive
// Small files (<4MB): single PUT. Large files: upload session.
// ==============================
async function ensureFolder(accessToken, folderName) {
  // Try get; if 404 create under root
  const getRes = await fetch(`${GRAPH_BASE}/me/drive/root:/${encodeURIComponent(folderName)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (getRes.ok) return;
  if (getRes.status !== 404) {
    const err = await getRes.text();
    throw new Error(`Folder check failed: ${getRes.status} ${err}`);
  }
  const createRes = await fetch(`${GRAPH_BASE}/me/drive/root/children`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: folderName, folder: {}, "@microsoft.graph.conflictBehavior": "replace" }),
  });
  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Folder create failed: ${createRes.status} ${err}`);
  }
}

async function uploadFile(localPath, remoteName) {
  if (!fs.existsSync(localPath)) throw new Error(`Local file not found: ${localPath}`);
  const accessToken = await getValidAccessToken();
  await ensureFolder(accessToken, REMOTE_FOLDER);

  const stat = fs.statSync(localPath);
  const remotePath = `${REMOTE_FOLDER}/${remoteName}`;
  const SMALL_LIMIT = 4 * 1024 * 1024;

  if (stat.size <= SMALL_LIMIT) {
    const buf = fs.readFileSync(localPath);
    const url = `${GRAPH_BASE}/me/drive/root:/${encodeURIComponent(remotePath)}:/content`;
    const res = await fetch(url, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/octet-stream" },
      body: buf,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Upload failed: ${res.status} ${err}`);
    }
    const json = await res.json();
    return { id: json.id, name: json.name, size: json.size, webUrl: json.webUrl };
  }

  // Large file → upload session (chunked)
  const sessionRes = await fetch(
    `${GRAPH_BASE}/me/drive/root:/${encodeURIComponent(remotePath)}:/createUploadSession`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "replace", name: remoteName } }),
    }
  );
  if (!sessionRes.ok) {
    const err = await sessionRes.text();
    throw new Error(`Upload session failed: ${sessionRes.status} ${err}`);
  }
  const { uploadUrl } = await sessionRes.json();

  const CHUNK = 5 * 1024 * 1024; // 5MB chunks
  const fd = fs.openSync(localPath, "r");
  try {
    let offset = 0;
    let lastJson = null;
    const buf = Buffer.alloc(CHUNK);
    while (offset < stat.size) {
      const toRead = Math.min(CHUNK, stat.size - offset);
      const bytesRead = fs.readSync(fd, buf, 0, toRead, offset);
      const slice = buf.subarray(0, bytesRead);
      const range = `bytes ${offset}-${offset + bytesRead - 1}/${stat.size}`;
      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Length": String(bytesRead), "Content-Range": range },
        body: slice,
      });
      if (res.status !== 202 && !res.ok) {
        const err = await res.text();
        throw new Error(`Chunk upload failed at ${range}: ${res.status} ${err}`);
      }
      if (res.ok) lastJson = await res.json();
      offset += bytesRead;
    }
    return lastJson ? { id: lastJson.id, name: lastJson.name, size: lastJson.size, webUrl: lastJson.webUrl } : { name: remoteName, size: stat.size };
  } finally {
    fs.closeSync(fd);
  }
}

async function getStatus() {
  if (!isConfigured()) {
    return { configured: false, connected: false, reason: "MS_CLIENT_ID / MS_CLIENT_SECRET not set in backend/.env" };
  }
  const row = await loadTokens();
  if (!row) return { configured: true, connected: false };
  return {
    configured: true,
    connected: true,
    accountEmail: row.account_email,
    accountName: row.account_name,
    expiresAt: row.expires_at,
    lastSync: row.last_sync_at,
    lastSyncStatus: row.last_sync_status,
    lastSyncError: row.last_sync_error,
  };
}

async function recordSync(success, error) {
  await pool.query(
    `UPDATE cloud_tokens SET last_sync_at=NOW(), last_sync_status=$1, last_sync_error=$2 WHERE provider='onedrive'`,
    [success ? "ok" : "error", success ? null : (error || "unknown").slice(0, 500)]
  );
}

module.exports = {
  isConfigured,
  buildAuthUrl,
  exchangeCodeForToken,
  saveTokens,
  loadTokens,
  clearTokens,
  fetchUserInfo,
  uploadFile,
  getStatus,
  recordSync,
  REDIRECT_URI,
};
