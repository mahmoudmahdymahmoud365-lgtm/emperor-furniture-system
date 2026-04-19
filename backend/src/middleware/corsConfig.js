// ==============================
// CORS Configuration — Restrict to known networks
// Allows: localhost, LAN (192.168.x.x, 10.x.x.x, 172.16-31.x.x), Tailscale (100.x.x.x)
// ==============================

const ALLOWED_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
  /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(:\d+)?$/,
  /^https?:\/\/100\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/, // Tailscale
];

function isAllowedOrigin(origin) {
  if (!origin) return true; // Same-origin requests (no Origin header)
  return ALLOWED_PATTERNS.some(pattern => pattern.test(origin));
}

function getCorsOptions() {
  return {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400, // 24h preflight cache
  };
}

module.exports = { getCorsOptions, isAllowedOrigin };
