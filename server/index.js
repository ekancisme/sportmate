const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Simple request logger để debug kết nối từ client
app.use((req, _res, next) => {
  const now = new Date().toISOString();
  console.log(
    `[${now}] ${req.method} ${req.url} - from ${req.ip || "unknown"}`,
  );
  next();
});

// Static upload folder for avatars
const uploadDir = path.join(__dirname, "uploads");
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const unique = Date.now().toString(36);
    const ext = path.extname(file.originalname || ".jpg");
    cb(null, `avatar_${unique}${ext}`);
  },
});
const upload = multer({ storage });
app.use("/uploads", express.static(uploadDir));

// Kết nối MongoDB local
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://36.50.54.246:27017";

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("✅ Connected to local MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// User Schema (bao gồm cả thông tin profile)
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    // Profile cơ bản
    name: { type: String },
    age: { type: Number },
    location: { type: String },
    bio: { type: String },
    email: { type: String, required: true, unique: true },
    phone: { type: String },
    avatar: { type: String },
    // Stats
    stats: {
      matchesPlayed: { type: Number, default: 0 },
      winRate: { type: Number, default: 0 },
      hoursActive: { type: Number, default: 0 },
      followers: { type: Number, default: 0 },
    },
    // Môn thể thao + level
    sports: [
      {
        name: { type: String, required: true },
        level: { type: String, required: true },
      },
    ],
    // Lịch tập
    schedule: [
      {
        day: { type: String, required: true },
        time: { type: String },
        activity: { type: String, required: true },
      },
    ],
  },
  { timestamps: true },
);

// Chuẩn hoá output JSON: _id -> id, ẩn password & __v
userSchema.set("toJSON", {
  transform: (_document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
    delete returnedObject.password;
  },
});

const User = mongoose.model("User", userSchema);

// Health check
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// helper validate email đơn giản
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Đăng ký (tạm thời bỏ validate chặt để dễ debug)
app.post("/api/auth/register", async (req, res) => {
  try {
    const { fullName, email, phone, password, role = "user" } = req.body;

    // Tạm thời relax validate: tự sinh username/email nếu thiếu để tránh lỗi
    const safeEmail = (email || "").trim();
    const usernameBase =
      safeEmail || (fullName || "").trim() || `user_${Date.now().toString(36)}`;
    const username = usernameBase.toLowerCase().replace(/\s+/g, "");

    const user = new User({
      username,
      name: fullName || usernameBase,
      email: safeEmail || `${username}@example.com`,
      phone: phone || "",
      password: password || "",
      role,
    });
    const savedUser = await user.save();
    console.log(`✅ Registered new user: ${savedUser.id} (${savedUser.email})`);
    return res.json(savedUser.toJSON());
  } catch (error) {
    console.error("❌ Register error:", error);
    return res.status(500).json({ error: "Đăng ký thất bại" });
  }
});

// Đăng nhập
app.post("/api/auth/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;

    const user = await User.findOne({
      $or: [{ username: identifier }, { email: identifier }],
    });
    if (!user || user.password !== password) {
      console.warn(`⚠️ Failed login for identifier="${identifier}"`);
      return res.status(401).json({ error: "Sai thông tin đăng nhập" });
    }

    console.log(`✅ Login success: ${user.id} (${user.email})`);
    return res.json(user.toJSON());
  } catch (error) {
    console.error("❌ Login error:", error);
    return res.status(500).json({ error: "Đăng nhập thất bại" });
  }
});

// Upload avatar và cập nhật user.avatar
app.post("/api/users/:id/avatar", upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const avatarUrl = `/uploads/${req.file.filename}`;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { avatar: avatarUrl },
      { new: true },
    );

    if (!user) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    return res.json(user.toJSON());
  } catch (error) {
    console.error("Avatar upload error:", error);
    return res.status(500).json({ error: "Upload avatar thất bại" });
  }
});

// Lấy profile theo id
app.get("/api/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }
    return res.json(user.toJSON());
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Lấy thông tin người dùng thất bại" });
  }
});

// Cập nhật profile (không đổi password ở đây)
app.put("/api/users/:id", async (req, res) => {
  try {
    const allowedFields = [
      "name",
      "age",
      "location",
      "bio",
      "email",
      "phone",
      "avatar",
      "stats",
      "sports",
      "schedule",
    ];

    const update = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        update[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(req.params.id, update, {
      new: true,
    });
    if (!user) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    return res.json(user.toJSON());
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: "Cập nhật thông tin người dùng thất bại" });
  }
});

// Khởi chạy server API
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server is running on http://0.0.0.0:${PORT}`);
});
