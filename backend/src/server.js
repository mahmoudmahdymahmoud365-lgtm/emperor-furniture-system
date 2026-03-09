// ==============================
// Express API Server
// ==============================
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "10mb" }));

// Health check
app.get("/api/health", (_, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

// Mount routes
app.use("/api/customers", require("./routes/customers"));
app.use("/api/products", require("./routes/products"));
app.use("/api/invoices", require("./routes/invoices"));
app.use("/api/employees", require("./routes/employees"));
app.use("/api/branches", require("./routes/branches"));
app.use("/api/receipts", require("./routes/receipts"));
app.use("/api/offers", require("./routes/offers"));
app.use("/api/stock-movements", require("./routes/stockMovements"));
app.use("/api/returns", require("./routes/returns"));
app.use("/api/shifts", require("./routes/shifts"));
app.use("/api/attendance", require("./routes/attendance"));
app.use("/api/expenses", require("./routes/expenses"));
app.use("/api/users", require("./routes/users"));
app.use("/api/settings", require("./routes/settings"));
app.use("/api/audit-log", require("./routes/auditLog"));
app.use("/api/security-log", require("./routes/securityLog"));

// Error handler
app.use((err, _req, res, _next) => {
  console.error("API Error:", err);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 Emperor API running on http://localhost:${PORT}`);
});
