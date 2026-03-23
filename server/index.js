require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { setupUploadStatic } = require("./config/upload");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const matchRoutes = require("./routes/matchRoutes");
const partnerRoutes = require("./routes/partnerRoutes");
const adminRoutes = require("./routes/adminRoutes");
const venueRoutes = require("./routes/venueRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

const MONGODB_URI = (process.env.MONGODB_URI || "").trim();
if (!MONGODB_URI) {
  console.error(
    "❌ Thiếu MONGODB_URI trong server/.env. Ví dụ: MONGODB_URI=mongodb://host:27017/sportmate",
  );
  process.exit(1);
}

app.use(cors());
app.use(express.json());

app.use((req, _res, next) => {
  const now = new Date().toISOString();
  console.log(
    `[${now}] ${req.method} ${req.url} - from ${req.ip || "unknown"}`,
  );
  next();
});

setupUploadStatic(app);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/partners", partnerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/venues", venueRoutes);

async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Đã kết nối MongoDB (MONGODB_URI từ .env)");
  } catch (err) {
    console.error("❌ Không kết nối được MongoDB:", err?.message || err);
    process.exit(1);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server: http://0.0.0.0:${PORT}`);
  });
}

start();
