// ==============================
// OneDrive OAuth + status routes
// ==============================
const router = require("express").Router();
const onedrive = require("../services/onedriveService");

// GET /api/cloud/onedrive/status
router.get("/status", async (_req, res) => {
  try {
    const status = await onedrive.getStatus();
    res.json(status);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/cloud/onedrive/auth — returns auth URL (frontend opens it in new window)
router.get("/auth", (_req, res) => {
  if (!onedrive.isConfigured()) {
    return res.status(400).json({ error: "OneDrive not configured. Set MS_CLIENT_ID and MS_CLIENT_SECRET in backend/.env" });
  }
  const url = onedrive.buildAuthUrl("emperor");
  res.json({ url });
});

// GET /api/cloud/onedrive/callback — Microsoft redirects here with ?code=...
router.get("/callback", async (req, res) => {
  const { code, error, error_description } = req.query;
  if (error) {
    return res.status(400).send(htmlPage(false, error_description || error));
  }
  if (!code) {
    return res.status(400).send(htmlPage(false, "Missing authorization code"));
  }
  try {
    const tokens = await onedrive.exchangeCodeForToken(String(code));
    const userInfo = await onedrive.fetchUserInfo(tokens.access_token);
    await onedrive.saveTokens(tokens, userInfo);
    res.send(htmlPage(true, userInfo.email || userInfo.name || "OneDrive"));
  } catch (e) {
    res.status(500).send(htmlPage(false, e.message));
  }
});

// POST /api/cloud/onedrive/disconnect
router.post("/disconnect", async (_req, res) => {
  try {
    await onedrive.clearTokens();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/cloud/onedrive/test — verify credentials work by fetching /me
router.post("/test", async (_req, res) => {
  try {
    const status = await onedrive.getStatus();
    if (!status.connected) return res.status(400).json({ ok: false, error: "Not connected" });
    // Touch a token (forces refresh if expired)
    const row = await onedrive.loadTokens();
    if (!row) return res.status(400).json({ ok: false, error: "Not connected" });
    res.json({ ok: true, account: row.account_email || row.account_name });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

function htmlPage(ok, msg) {
  const color = ok ? "#16a34a" : "#dc2626";
  const title = ok ? "تم الربط بنجاح ✅" : "فشل الربط ❌";
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${title}</title>
    <style>body{font-family:system-ui,-apple-system,Segoe UI,Tahoma,sans-serif;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
    .card{background:#1e293b;padding:2rem 3rem;border-radius:1rem;text-align:center;max-width:480px}
    h1{margin:0 0 1rem;color:${color}}p{opacity:.85;line-height:1.6;word-break:break-word}
    button{margin-top:1.5rem;background:${color};color:#fff;border:0;padding:.6rem 1.2rem;border-radius:.5rem;cursor:pointer;font-size:1rem}
    </style></head><body><div class="card"><h1>${title}</h1><p>${escapeHtml(String(msg))}</p>
    <button onclick="window.close()">إغلاق النافذة</button></div>
    <script>setTimeout(()=>{try{window.close()}catch(e){}},3000)</script></body></html>`;
}
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}

module.exports = router;
