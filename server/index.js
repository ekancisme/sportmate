require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 3000;

/** Chuỗi kết nối MongoDB — chỉ lấy từ biến môi trường, một nguồn duy nhất */
const MONGODB_URI = (process.env.MONGODB_URI || "").trim();
if (!MONGODB_URI) {
  console.error(
    "❌ Thiếu MONGODB_URI trong server/.env. Ví dụ: MONGODB_URI=mongodb://host:27017/sportmate",
  );
  process.exit(1);
}

const BCRYPT_ROUNDS = 10;
const RESET_CODE_EXPIRE_MS = 15 * 60 * 1000; // 15 phút
const MIN_PASSWORD_LENGTH = 8;

// Middleware
app.use(cors());
app.use(express.json());

app.use((req, _res, next) => {
  const now = new Date().toISOString();
  console.log(
    `[${now}] ${req.method} ${req.url} - from ${req.ip || "unknown"}`,
  );
  next();
});

// Static upload folder for avatars
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

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

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    name: { type: String },
    age: { type: Number },
    location: { type: String },
    bio: { type: String },
    email: { type: String, required: true, unique: true },
    phone: { type: String },
    avatar: { type: String },
    stats: {
      matchesPlayed: { type: Number, default: 0 },
      winRate: { type: Number, default: 0 },
      hoursActive: { type: Number, default: 0 },
      followers: { type: Number, default: 0 },
    },
    sports: [
      {
        name: { type: String, required: true },
        level: { type: String, required: true },
      },
    ],
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

userSchema.set("toJSON", {
  transform: (_document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
    delete returnedObject.password;
  },
});

const User = mongoose.model("User", userSchema);

/** Mã đặt lại mật khẩu (TTL tự xóa document hết hạn) */
const passwordResetSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const PasswordReset = mongoose.model("PasswordReset", passwordResetSchema);

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function hashPassword(plain) {
  return bcrypt.hashSync(plain, BCRYPT_ROUNDS);
}

/** So khớp mật khẩu: hỗ trợ bcrypt (mới) và plain text (tài khoản cũ khi dev) */
function verifyPassword(plain, stored) {
  if (!stored) return false;
  if (
    stored.startsWith("$2a$") ||
    stored.startsWith("$2b$") ||
    stored.startsWith("$2y$")
  ) {
    return bcrypt.compareSync(plain, stored);
  }
  return plain === stored;
}

/** Gmail App Password: bỏ mọi khoảng trắng và dấu nháy thừa trong .env */
function getSmtpPassword() {
  const raw = process.env.SMTP_PASS;
  if (!raw) return "";
  return String(raw)
    .replace(/\s+/g, "")
    .replace(/^["']|["']$/g, "");
}

function createMailTransport() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = getSmtpPassword();
  if (!host || !user || !pass) {
    return null;
  }
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === "true";
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    requireTLS: !secure && port === 587,
    tls: {
      minVersion: "TLSv1.2",
    },
  });
}

async function sendMail({ to, subject, text, html }) {
  const transport = createMailTransport();
  let from =
    process.env.SMTP_FROM?.trim() ||
    process.env.SMTP_USER?.trim() ||
    "SportMate";
  // Bỏ dấu ngoặc kép nếu user copy nhầm trong .env
  from = from.replace(/^["']|["']$/g, "");

  if (!transport) {
    console.log("\n========== [SMTP chưa cấu hình — chỉ dùng dev] ==========");
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(text);
    console.log("========================================================\n");
    return;
  }

  await transport.sendMail({
    from,
    to,
    subject,
    text,
    html: html || text.replace(/\n/g, "<br/>"),
  });
}

function generateResetCode() {
  return String(crypto.randomInt(100000, 1000000));
}

/** Tìm user theo email không phân biệt hoa/thường (dữ liệu cũ có thể khác casing) */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findUserByEmailLoose(emailLower) {
  return User.findOne({
    email: new RegExp(`^${escapeRegex(emailLower)}$`, "i"),
  });
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Đăng ký
app.post("/api/auth/register", async (req, res) => {
  try {
    const { fullName, email, phone, password, role = "user" } = req.body;

    const name = (fullName || "").trim();
    const emailTrim = (email || "").trim().toLowerCase();
    const phoneTrim = (phone || "").trim();

    if (!name || name.length < 2) {
      return res.status(400).json({ error: "Họ tên phải có ít nhất 2 ký tự" });
    }
    if (!emailTrim) {
      return res.status(400).json({ error: "Vui lòng nhập email" });
    }
    if (!isValidEmail(emailTrim)) {
      return res.status(400).json({ error: "Email không hợp lệ" });
    }
    if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
      return res
        .status(400)
        .json({
          error: `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự`,
        });
    }
    if (phoneTrim && !/^[\d\s\-\+\(\)]+$/.test(phoneTrim)) {
      return res.status(400).json({ error: "Số điện thoại không hợp lệ" });
    }

    const usernameBase = emailTrim.split("@")[0].replace(/[^a-z0-9_]/gi, "_");
    const username = `${usernameBase}_${Date.now().toString(36)}`.toLowerCase();

    const user = new User({
      username,
      name,
      email: emailTrim,
      phone: phoneTrim || "",
      password: hashPassword(String(password)),
      role,
    });
    const savedUser = await user.save();
    console.log(`✅ Registered: ${savedUser.id} (${savedUser.email})`);
    return res.json(savedUser.toJSON());
  } catch (error) {
    console.error("❌ Register error:", error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || "email";
      return res.status(400).json({
        error:
          field === "email" ? "Email đã được sử dụng" : "Thông tin đã tồn tại",
      });
    }
    return res.status(500).json({ error: "Đăng ký thất bại" });
  }
});

// Đăng nhập
app.post("/api/auth/login", async (req, res) => {
  try {
    const identifier = (req.body.identifier || "").trim();
    const password = req.body.password;

    if (!identifier) {
      return res
        .status(400)
        .json({ error: "Vui lòng nhập email hoặc tên đăng nhập" });
    }
    if (!password) {
      return res.status(400).json({ error: "Vui lòng nhập mật khẩu" });
    }

    const user = await User.findOne({
      $or: [{ username: identifier }, { email: identifier.toLowerCase() }],
    });
    if (!user || !verifyPassword(password, user.password)) {
      console.warn(`⚠️ Failed login for "${identifier}"`);
      return res
        .status(401)
        .json({ error: "Sai email/tên đăng nhập hoặc mật khẩu" });
    }

    console.log(`✅ Login: ${user.id} (${user.email})`);
    return res.json(user.toJSON());
  } catch (error) {
    console.error("❌ Login error:", error);
    return res.status(500).json({ error: "Đăng nhập thất bại" });
  }
});

// Gửi mã đặt lại mật khẩu qua email
app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ error: "Vui lòng nhập email" });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Email không hợp lệ" });
    }

    const user = await findUserByEmailLoose(email);
    if (!user) {
      // Không tiết lộ email có tồn tại hay không
      return res.json({
        ok: true,
        message: "Nếu email đã đăng ký, bạn sẽ nhận mã trong 15 phút.",
      });
    }

    const emailKey = String(user.email || email)
      .trim()
      .toLowerCase();

    await PasswordReset.deleteMany({ email: emailKey });

    const code = generateResetCode();
    const expiresAt = new Date(Date.now() + RESET_CODE_EXPIRE_MS);

    await PasswordReset.create({ email: emailKey, code, expiresAt });

    const subject = "SportMate — Mã đặt lại mật khẩu";
    const text = `Mã xác nhận của bạn: ${code}\nMã có hiệu lực trong 15 phút.\nNếu bạn không yêu cầu, hãy bỏ qua email này.`;

    try {
      await sendMail({
        to: emailKey,
        subject,
        text,
        html: `<p>Mã xác nhận của bạn: <strong>${code}</strong></p><p>Mã có hiệu lực trong 15 phút.</p>`,
      });
    } catch (mailErr) {
      await PasswordReset.deleteMany({ email: emailKey });
      console.error(
        "❌ forgot-password sendMail:",
        mailErr?.message || mailErr,
      );
      return res.status(502).json({
        error:
          "Không gửi được email. Kiểm tra SMTP trong server/.env (App Password Gmail: 16 ký tự, không dấu cách).",
        detail:
          process.env.NODE_ENV !== "production"
            ? String(mailErr?.message || mailErr)
            : undefined,
      });
    }

    console.log(`📧 Password reset code sent for ${emailKey}`);

    return res.json({
      ok: true,
      message: "Nếu email đã đăng ký, bạn sẽ nhận mã trong 15 phút.",
    });
  } catch (error) {
    console.error("❌ forgot-password:", error);
    return res.status(500).json({
      error: "Không thể tạo mã. Thử lại sau.",
      detail:
        process.env.NODE_ENV !== "production"
          ? String(error?.message || error)
          : undefined,
    });
  }
});

// Đặt lại mật khẩu bằng mã
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    const code = String(req.body.code || "").trim();
    const newPassword = req.body.newPassword;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: "Email không hợp lệ" });
    }
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: "Mã phải gồm 6 chữ số" });
    }
    if (!newPassword || String(newPassword).length < MIN_PASSWORD_LENGTH) {
      return res
        .status(400)
        .json({
          error: `Mật khẩu mới phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự`,
        });
    }

    const record = await PasswordReset.findOne({ email }).sort({
      createdAt: -1,
    });
    if (!record || record.code !== code) {
      return res.status(400).json({ error: "Mã không đúng hoặc đã hết hạn" });
    }
    if (record.expiresAt.getTime() < Date.now()) {
      await PasswordReset.deleteOne({ _id: record._id });
      return res
        .status(400)
        .json({ error: "Mã đã hết hạn. Vui lòng gửi lại mã." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Không nên xảy ra nhưng xử lý an toàn
      await PasswordReset.deleteMany({ email });
      return res.status(404).json({ error: "Không tìm thấy tài khoản" });
    }

    user.password = hashPassword(String(newPassword));
    await user.save();
    await PasswordReset.deleteMany({ email });

    console.log(`✅ Password reset for ${email}`);
    return res.json({
      ok: true,
      message: "Đặt lại mật khẩu thành công. Vui lòng đăng nhập.",
    });
  } catch (error) {
    console.error("❌ reset-password:", error);
    return res.status(500).json({ error: "Đặt lại mật khẩu thất bại" });
  }
});

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

// Lấy danh sách users để gợi ý partner
app.get("/api/users", async (req, res) => {
  try {
    const { exclude, sport, limit = 20, location: userLocation } = req.query;

    const filter = { role: "user" };

    // Loại trừ user hiện tại
    if (exclude) {
      filter._id = { $ne: exclude };
    }

    // Lọc theo sport nếu có
    if (sport) {
      filter["sports.name"] = { $regex: sport, $options: "i" };
    }

    const users = await User.find(filter)
      .select("name username avatar stats sports location")
      .limit(Number(limit) * 2)
      .sort({ createdAt: -1 });

    // Normalize location text
    const normalizeLoc = (loc) => {
      if (!loc) return "";
      return loc.toLowerCase().replace(/\s+/g, " ").trim();
    };

    // Tính độ ưu tiên location
    const getLocationScore = (userLoc) => {
      if (!userLoc || !userLocation) return 0;
      const normalized = normalizeLoc(userLoc);
      const userNorm = normalizeLoc(userLocation);

      // Trùng khớp hoàn toàn
      if (normalized === userNorm) return 100;
      // Có chứa nhau
      if (normalized.includes(userNorm) || userNorm.includes(normalized)) return 80;
      // Cùng thành phố (lấy 2 từ cuối)
      const userWords = userNorm.split(" ");
      const locWords = normalized.split(" ");
      const userLast2 = userWords.slice(-2).join(" ");
      const locLast2 = locWords.slice(-2).join(" ");
      if (locLast2 === userLast2 && userLast2.length > 3) return 60;
      // Cùng 1 từ quan trọng (TP, HCM, HN, quận...)
      const keywords = ["hồ chí minh", "hà nội", "hcm", "hn", "đà nẵng", "quận", "huyện", "tp"];
      for (const kw of keywords) {
        if (userNorm.includes(kw) && normalized.includes(kw)) return 40;
      }
      return 10;
    };

    // Transform data thành format partner
    let partners = users.map((user) => {
      const primarySport = user.sports?.[0];
      const locationScore = getLocationScore(user.location);
      console.log(`[Partner] ${user.username} - avatar:`, user.avatar);
      return {
        id: user._id.toString(),
        name: user.name || user.username || "User",
        sport: primarySport?.name || "Thể thao",
        level: primarySport?.level || "Intermediate",
        distance: user.location || "Không xác định",
        locationScore,
        winRate: user.stats?.winRate || Math.floor(Math.random() * 40) + 40,
        avatar: user.avatar || null,
        location: user.location || null,
      };
    });

    // Sắp xếp: ưu tiên location gần nhất, sau đó theo winRate
    partners = partners.sort((a, b) => {
      if (b.locationScore !== a.locationScore) {
        return b.locationScore - a.locationScore;
      }
      return b.winRate - a.winRate;
    });

    // Giới hạn kết quả
    partners = partners.slice(0, Number(limit));

    return res.json(partners);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Lấy danh sách users thất bại" });
  }
});

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

// Lấy thông tin user riêng biệt (dùng cho public profile)
app.get("/api/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("name username avatar age location bio stats sports schedule");

    if (!user) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    return res.json({
      id: user._id.toString(),
      name: user.name || user.username || "User",
      age: user.age || null,
      location: user.location || "Không xác định",
      bio: user.bio || "",
      avatar: user.avatar || null,
      stats: {
        matchesPlayed: user.stats?.matchesPlayed || 0,
        winRate: user.stats?.winRate || 0,
        hoursActive: user.stats?.hoursActive || 0,
        followers: user.stats?.followers || 0,
      },
      sports: user.sports || [],
      schedule: user.schedule || [],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Lấy thông tin người dùng thất bại" });
  }
});

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
