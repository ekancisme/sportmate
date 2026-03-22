require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

/** Chuỗi kết nối MongoDB — chỉ lấy từ biến môi trường, một nguồn duy nhất */
const MONGODB_URI = (process.env.MONGODB_URI || '').trim();
if (!MONGODB_URI) {
  console.error(
    '❌ Thiếu MONGODB_URI trong server/.env. Ví dụ: MONGODB_URI=mongodb://host:27017/sportmate',
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
  console.log(`[${now}] ${req.method} ${req.url} - from ${req.ip || 'unknown'}`);
  next();
});

// Static upload folder for avatars
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const unique = Date.now().toString(36);
    const ext = path.extname(file.originalname || '.jpg');
    cb(null, `avatar_${unique}${ext}`);
  },
});
const upload = multer({ storage });
app.use('/uploads', express.static(uploadDir));

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
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

userSchema.set('toJSON', {
  transform: (_document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
    delete returnedObject.password;
  },
});

const User = mongoose.model('User', userSchema);

const matchSchema = new mongoose.Schema(
  {
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sport: { type: String, required: true },
    title: { type: String, required: true },
    location: { type: String, required: true },
    /** yyyy-mm-dd */
    date: { type: String, required: true },
    time: { type: String, default: '' },
    maxPlayers: { type: Number, required: true, min: 1 },
    currentPlayers: { type: Number, default: 0, min: 0 },
    participantIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
    minSkillLevel: { type: String, default: 'Tất Cả' },
    description: { type: String, default: '' },
    rules: { type: String, default: '' },
  },
  { timestamps: true },
);

matchSchema.set('toJSON', {
  transform: (_document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    if (returnedObject.hostId) {
      const hid = returnedObject.hostId;
      if (hid && typeof hid === 'object' && !(hid instanceof mongoose.Types.ObjectId)) {
        returnedObject.hostId = hid;
      } else {
        returnedObject.hostId = returnedObject.hostId.toString();
      }
    }
    delete returnedObject._id;
    delete returnedObject.__v;
  },
});

const Match = mongoose.model('Match', matchSchema);

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
const PasswordReset = mongoose.model('PasswordReset', passwordResetSchema);

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function hashPassword(plain) {
  return bcrypt.hashSync(plain, BCRYPT_ROUNDS);
}

/** So khớp mật khẩu: hỗ trợ bcrypt (mới) và plain text (tài khoản cũ khi dev) */
function verifyPassword(plain, stored) {
  if (!stored) return false;
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
    return bcrypt.compareSync(plain, stored);
  }
  return plain === stored;
}

/** Gmail App Password: bỏ mọi khoảng trắng và dấu nháy thừa trong .env */
function getSmtpPassword() {
  const raw = process.env.SMTP_PASS;
  if (!raw) return '';
  return String(raw).replace(/\s+/g, '').replace(/^["']|["']$/g, '');
}

function createMailTransport() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = getSmtpPassword();
  if (!host || !user || !pass) {
    return null;
  }
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === 'true';
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    requireTLS: !secure && port === 587,
    tls: {
      minVersion: 'TLSv1.2',
    },
  });
}

async function sendMail({ to, subject, text, html }) {
  const transport = createMailTransport();
  let from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim() || 'SportMate';
  // Bỏ dấu ngoặc kép nếu user copy nhầm trong .env
  from = from.replace(/^["']|["']$/g, '');

  if (!transport) {
    console.log('\n========== [SMTP chưa cấu hình — chỉ dùng dev] ==========');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(text);
    console.log('========================================================\n');
    return;
  }

  await transport.sendMail({
    from,
    to,
    subject,
    text,
    html: html || text.replace(/\n/g, '<br/>'),
  });
}

function generateResetCode() {
  return String(crypto.randomInt(100000, 1000000));
}

/** Tìm user theo email không phân biệt hoa/thường (dữ liệu cũ có thể khác casing) */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findUserByEmailLoose(emailLower) {
  return User.findOne({
    email: new RegExp(`^${escapeRegex(emailLower)}$`, 'i'),
  });
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Đăng ký
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, email, phone, password, role = 'user' } = req.body;

    const name = (fullName || '').trim();
    const emailTrim = (email || '').trim().toLowerCase();
    const phoneTrim = (phone || '').trim();

    if (!name || name.length < 2) {
      return res.status(400).json({ error: 'Họ tên phải có ít nhất 2 ký tự' });
    }
    if (!emailTrim) {
      return res.status(400).json({ error: 'Vui lòng nhập email' });
    }
    if (!isValidEmail(emailTrim)) {
      return res.status(400).json({ error: 'Email không hợp lệ' });
    }
    if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
      return res
        .status(400)
        .json({ error: `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự` });
    }
    if (phoneTrim && !/^[\d\s\-\+\(\)]+$/.test(phoneTrim)) {
      return res.status(400).json({ error: 'Số điện thoại không hợp lệ' });
    }

    const usernameBase = emailTrim.split('@')[0].replace(/[^a-z0-9_]/gi, '_');
    const username = `${usernameBase}_${Date.now().toString(36)}`.toLowerCase();

    const user = new User({
      username,
      name,
      email: emailTrim,
      phone: phoneTrim || '',
      password: hashPassword(String(password)),
      role,
    });
    const savedUser = await user.save();
    console.log(`✅ Registered: ${savedUser.id} (${savedUser.email})`);
    return res.json(savedUser.toJSON());
  } catch (error) {
    console.error('❌ Register error:', error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'email';
      return res.status(400).json({
        error: field === 'email' ? 'Email đã được sử dụng' : 'Thông tin đã tồn tại',
      });
    }
    return res.status(500).json({ error: 'Đăng ký thất bại' });
  }
});

// Đăng nhập
app.post('/api/auth/login', async (req, res) => {
  try {
    const identifier = (req.body.identifier || '').trim();
    const password = req.body.password;

    if (!identifier) {
      return res.status(400).json({ error: 'Vui lòng nhập email hoặc tên đăng nhập' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Vui lòng nhập mật khẩu' });
    }

    const user = await User.findOne({
      $or: [{ username: identifier }, { email: identifier.toLowerCase() }],
    });
    if (!user || !verifyPassword(password, user.password)) {
      console.warn(`⚠️ Failed login for "${identifier}"`);
      return res.status(401).json({ error: 'Sai email/tên đăng nhập hoặc mật khẩu' });
    }

    console.log(`✅ Login: ${user.id} (${user.email})`);
    return res.json(user.toJSON());
  } catch (error) {
    console.error('❌ Login error:', error);
    return res.status(500).json({ error: 'Đăng nhập thất bại' });
  }
});

// Gửi mã đặt lại mật khẩu qua email
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ error: 'Vui lòng nhập email' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Email không hợp lệ' });
    }

    const user = await findUserByEmailLoose(email);
    if (!user) {
      // Không tiết lộ email có tồn tại hay không
      return res.json({
        ok: true,
        message: 'Nếu email đã đăng ký, bạn sẽ nhận mã trong 15 phút.',
      });
    }

    const emailKey = String(user.email || email).trim().toLowerCase();

    await PasswordReset.deleteMany({ email: emailKey });

    const code = generateResetCode();
    const expiresAt = new Date(Date.now() + RESET_CODE_EXPIRE_MS);

    await PasswordReset.create({ email: emailKey, code, expiresAt });

    const subject = 'SportMate — Mã đặt lại mật khẩu';
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
      console.error('❌ forgot-password sendMail:', mailErr?.message || mailErr);
      return res.status(502).json({
        error:
          'Không gửi được email. Kiểm tra SMTP trong server/.env (App Password Gmail: 16 ký tự, không dấu cách).',
        detail: process.env.NODE_ENV !== 'production' ? String(mailErr?.message || mailErr) : undefined,
      });
    }

    console.log(`📧 Password reset code sent for ${emailKey}`);

    return res.json({
      ok: true,
      message: 'Nếu email đã đăng ký, bạn sẽ nhận mã trong 15 phút.',
    });
  } catch (error) {
    console.error('❌ forgot-password:', error);
    return res.status(500).json({
      error: 'Không thể tạo mã. Thử lại sau.',
      detail: process.env.NODE_ENV !== 'production' ? String(error?.message || error) : undefined,
    });
  }
});

// Đặt lại mật khẩu bằng mã
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const code = String(req.body.code || '').trim();
    const newPassword = req.body.newPassword;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Email không hợp lệ' });
    }
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Mã phải gồm 6 chữ số' });
    }
    if (!newPassword || String(newPassword).length < MIN_PASSWORD_LENGTH) {
      return res
        .status(400)
        .json({ error: `Mật khẩu mới phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự` });
    }

    const record = await PasswordReset.findOne({ email }).sort({ createdAt: -1 });
    if (!record || record.code !== code) {
      return res.status(400).json({ error: 'Mã không đúng hoặc đã hết hạn' });
    }
    if (record.expiresAt.getTime() < Date.now()) {
      await PasswordReset.deleteOne({ _id: record._id });
      return res.status(400).json({ error: 'Mã đã hết hạn. Vui lòng gửi lại mã.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Không nên xảy ra nhưng xử lý an toàn
      await PasswordReset.deleteMany({ email });
      return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
    }

    user.password = hashPassword(String(newPassword));
    await user.save();
    await PasswordReset.deleteMany({ email });

    console.log(`✅ Password reset for ${email}`);
    return res.json({ ok: true, message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập.' });
  } catch (error) {
    console.error('❌ reset-password:', error);
    return res.status(500).json({ error: 'Đặt lại mật khẩu thất bại' });
  }
});

app.post('/api/users/:id/avatar', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const avatarUrl = `/uploads/${req.file.filename}`;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { avatar: avatarUrl },
      { new: true },
    );

    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    return res.json(user.toJSON());
  } catch (error) {
    console.error('Avatar upload error:', error);
    return res.status(500).json({ error: 'Upload avatar thất bại' });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }
    return res.json(user.toJSON());
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Lấy thông tin người dùng thất bại' });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const allowedFields = [
      'name',
      'age',
      'location',
      'bio',
      'email',
      'phone',
      'avatar',
      'stats',
      'sports',
      'schedule',
    ];

    const update = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        update[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    return res.json(user.toJSON());
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Cập nhật thông tin người dùng thất bại' });
  }
});

function matchHostIdString(doc) {
  if (!doc.hostId) return undefined;
  const h = doc.hostId;
  if (h && typeof h === 'object' && !(h instanceof mongoose.Types.ObjectId)) {
    return h._id ? h._id.toString() : String(h.id || '');
  }
  return h.toString();
}

function matchJsonWithHost(doc, options = {}) {
  const viewerUserId = options.viewerUserId;
  const j = doc.toJSON();
  const hostIdStr = matchHostIdString(doc);
  const pids = doc.participantIds || [];
  const legacy = Number(j.currentPlayers ?? 0);
  const cp =
    Array.isArray(pids) && pids.length > 0 ? pids.length : legacy;

  let viewerJoined = false;
  if (
    viewerUserId &&
    mongoose.Types.ObjectId.isValid(String(viewerUserId)) &&
    Array.isArray(pids)
  ) {
    const v = new mongoose.Types.ObjectId(String(viewerUserId));
    viewerJoined = pids.some((p) => p.equals(v));
  }

  let host = null;
  if (doc.populated('hostId') && doc.hostId) {
    const h = doc.hostId.toJSON();
    host = {
      id: h.id,
      name: h.name || h.username || 'Host',
      username: h.username,
      avatar: h.avatar,
      matchesPlayed: h.stats?.matchesPlayed ?? 0,
      winRate: h.stats?.winRate ?? 50,
    };
  }
  delete j.hostId;
  delete j.participantIds;
  return { ...j, host, hostId: hostIdStr, currentPlayers: cp, viewerJoined };
}

// Danh sách trận (mới nhất trước)
app.get('/api/matches', async (_req, res) => {
  try {
    const matches = await Match.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('hostId', 'name username avatar stats');
    return res.json(matches.map((m) => matchJsonWithHost(m)));
  } catch (error) {
    console.error('❌ GET /api/matches:', error);
    return res.status(500).json({ error: 'Không lấy được danh sách trận' });
  }
});

// Trận do một host tạo (đặt trước :id để không nhầm "mine" thành id)
app.get('/api/matches/mine', async (req, res) => {
  try {
    const hostId = req.query.hostId;
    if (!hostId || !mongoose.Types.ObjectId.isValid(String(hostId))) {
      return res.status(400).json({ error: 'Thiếu hoặc sai hostId' });
    }
    const matches = await Match.find({ hostId })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('hostId', 'name username avatar stats');
    return res.json(matches.map((m) => matchJsonWithHost(m)));
  } catch (error) {
    console.error('❌ GET /api/matches/mine', error);
    return res.status(500).json({ error: 'Không lấy được trận của bạn' });
  }
});

// Chi tiết một trận
app.get('/api/matches/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID không hợp lệ' });
    }
    const doc = await Match.findById(id).populate('hostId', 'name username avatar stats');
    if (!doc) {
      return res.status(404).json({ error: 'Không tìm thấy trận' });
    }
    const viewerUserId = req.query.userId;
    return res.json(
      matchJsonWithHost(doc, {
        viewerUserId:
          viewerUserId && mongoose.Types.ObjectId.isValid(String(viewerUserId))
            ? String(viewerUserId)
            : undefined,
      }),
    );
  } catch (error) {
    console.error('❌ GET /api/matches/:id', error);
    return res.status(500).json({ error: 'Không lấy được trận' });
  }
});

// Tham gia trận (lưu DB)
app.post('/api/matches/:id/join', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID trận không hợp lệ' });
    }
    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(400).json({ error: 'Thiếu hoặc sai userId' });
    }

    const doc = await Match.findById(id);
    if (!doc) {
      return res.status(404).json({ error: 'Không tìm thấy trận' });
    }

    const uid = new mongoose.Types.ObjectId(String(userId));
    const pids = doc.participantIds || [];
    const used =
      pids.length > 0 ? pids.length : Number(doc.currentPlayers ?? 0);

    if (pids.some((p) => p.equals(uid))) {
      await doc.populate('hostId', 'name username avatar stats');
      return res.json(matchJsonWithHost(doc, { viewerUserId: String(userId) }));
    }

    if (used >= doc.maxPlayers) {
      return res.status(400).json({ error: 'Trận đã đủ người' });
    }

    doc.participantIds = [...pids, uid];
    doc.currentPlayers = doc.participantIds.length;
    await doc.save();
    await doc.populate('hostId', 'name username avatar stats');
    return res.json(matchJsonWithHost(doc, { viewerUserId: String(userId) }));
  } catch (error) {
    console.error('❌ POST /api/matches/:id/join', error);
    return res.status(500).json({ error: 'Không tham gia được trận' });
  }
});

// Rời trận
app.post('/api/matches/:id/leave', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID trận không hợp lệ' });
    }
    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(400).json({ error: 'Thiếu hoặc sai userId' });
    }

    const doc = await Match.findById(id);
    if (!doc) {
      return res.status(404).json({ error: 'Không tìm thấy trận' });
    }

    const uid = new mongoose.Types.ObjectId(String(userId));
    const pids = doc.participantIds || [];
    const had = pids.some((p) => p.equals(uid));

    if (!had) {
      return res.status(400).json({ error: 'Bạn chưa tham gia trận này' });
    }

    doc.participantIds = pids.filter((p) => !p.equals(uid));
    doc.currentPlayers = doc.participantIds.length;

    await doc.save();
    await doc.populate('hostId', 'name username avatar stats');
    return res.json(matchJsonWithHost(doc, { viewerUserId: String(userId) }));
  } catch (error) {
    console.error('❌ POST /api/matches/:id/leave', error);
    return res.status(500).json({ error: 'Không rời trận được' });
  }
});

// Cập nhật trận (chỉ host)
app.patch('/api/matches/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      hostId,
      sport,
      title,
      location,
      date,
      time,
      maxPlayers,
      minSkillLevel,
      description,
      rules,
    } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID không hợp lệ' });
    }
    if (!hostId || !mongoose.Types.ObjectId.isValid(String(hostId))) {
      return res.status(400).json({ error: 'Thiếu hoặc sai hostId' });
    }

    const doc = await Match.findById(id);
    if (!doc) {
      return res.status(404).json({ error: 'Không tìm thấy trận' });
    }
    if (!doc.hostId.equals(new mongoose.Types.ObjectId(String(hostId)))) {
      return res.status(403).json({ error: 'Chỉ host mới được sửa trận' });
    }

    const pids = doc.participantIds || [];
    const used =
      pids.length > 0 ? pids.length : Number(doc.currentPlayers ?? 0);

    if (sport !== undefined) {
      const sportTrim = String(sport || '').trim();
      if (!sportTrim) {
        return res.status(400).json({ error: 'Vui lòng chọn môn thể thao' });
      }
      doc.sport = sportTrim;
    }
    if (title !== undefined) {
      const titleTrim = String(title || '').trim();
      if (titleTrim.length < 2) {
        return res.status(400).json({ error: 'Tiêu đề cần ít nhất 2 ký tự' });
      }
      doc.title = titleTrim;
    }
    if (location !== undefined) {
      const locationTrim = String(location || '').trim();
      if (!locationTrim) {
        return res.status(400).json({ error: 'Vui lòng nhập địa điểm' });
      }
      doc.location = locationTrim;
    }
    if (date !== undefined) {
      const dateStr = String(date || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return res.status(400).json({ error: 'Ngày không hợp lệ (dùng yyyy-mm-dd)' });
      }
      doc.date = dateStr;
    }
    if (time !== undefined) {
      doc.time = String(time || '').trim();
    }
    if (maxPlayers !== undefined) {
      const maxN = Number(maxPlayers);
      if (!Number.isFinite(maxN) || maxN < 1 || maxN > 999) {
        return res.status(400).json({ error: 'Số người phải từ 1 đến 999' });
      }
      const rounded = Math.round(maxN);
      if (rounded < used) {
        return res.status(400).json({
          error: `Số người tối đa không được nhỏ hơn số người đã tham gia (${used})`,
        });
      }
      doc.maxPlayers = rounded;
    }
    if (minSkillLevel !== undefined) {
      doc.minSkillLevel = String(minSkillLevel || '').trim() || 'Tất Cả';
    }
    if (description !== undefined) {
      doc.description = String(description || '').trim();
    }
    if (rules !== undefined) {
      doc.rules = String(rules || '').trim();
    }

    await doc.save();
    await doc.populate('hostId', 'name username avatar stats');
    return res.json(matchJsonWithHost(doc, { viewerUserId: String(hostId) }));
  } catch (error) {
    console.error('❌ PATCH /api/matches/:id', error);
    return res.status(500).json({ error: 'Cập nhật trận thất bại' });
  }
});

// Xóa trận (chỉ host)
app.delete('/api/matches/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { hostId } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID không hợp lệ' });
    }
    if (!hostId || !mongoose.Types.ObjectId.isValid(String(hostId))) {
      return res.status(400).json({ error: 'Thiếu hoặc sai hostId' });
    }

    const doc = await Match.findById(id);
    if (!doc) {
      return res.status(404).json({ error: 'Không tìm thấy trận' });
    }
    if (!doc.hostId.equals(new mongoose.Types.ObjectId(String(hostId)))) {
      return res.status(403).json({ error: 'Chỉ host mới được xóa trận' });
    }

    await Match.findByIdAndDelete(id);
    return res.status(204).send();
  } catch (error) {
    console.error('❌ DELETE /api/matches/:id', error);
    return res.status(500).json({ error: 'Xóa trận thất bại' });
  }
});

// Tạo trận đấu
app.post('/api/matches', async (req, res) => {
  try {
    const {
      hostId,
      sport,
      title,
      location,
      date,
      time,
      maxPlayers,
      minSkillLevel,
      description,
      rules,
    } = req.body;

    if (!hostId || !mongoose.Types.ObjectId.isValid(String(hostId))) {
      return res.status(400).json({ error: 'Thiếu hoặc sai hostId (người tạo trận)' });
    }

    const host = await User.findById(hostId);
    if (!host) {
      return res.status(400).json({ error: 'Không tìm thấy người dùng' });
    }

    const sportTrim = String(sport || '').trim();
    if (!sportTrim) {
      return res.status(400).json({ error: 'Vui lòng chọn môn thể thao' });
    }

    const titleTrim = String(title || '').trim();
    if (titleTrim.length < 2) {
      return res.status(400).json({ error: 'Tiêu đề cần ít nhất 2 ký tự' });
    }

    const locationTrim = String(location || '').trim();
    if (!locationTrim) {
      return res.status(400).json({ error: 'Vui lòng nhập địa điểm' });
    }

    const dateStr = String(date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ error: 'Ngày không hợp lệ (dùng yyyy-mm-dd)' });
    }

    const maxN = Number(maxPlayers);
    if (!Number.isFinite(maxN) || maxN < 1 || maxN > 999) {
      return res.status(400).json({ error: 'Số người phải từ 1 đến 999' });
    }

    const minSkillTrim = String(minSkillLevel || '').trim() || 'Tất Cả';

    const match = await Match.create({
      hostId,
      sport: sportTrim,
      title: titleTrim,
      location: locationTrim,
      date: dateStr,
      time: String(time || '').trim(),
      maxPlayers: Math.round(maxN),
      minSkillLevel: minSkillTrim,
      description: String(description || '').trim(),
      rules: String(rules || '').trim(),
    });

    console.log(`✅ Match created: ${match.id} by host ${hostId}`);
    return res.status(201).json(match.toJSON());
  } catch (error) {
    console.error('❌ POST /api/matches:', error);
    return res.status(500).json({ error: 'Tạo trận đấu thất bại' });
  }
});

async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Đã kết nối MongoDB (MONGODB_URI từ .env)');
  } catch (err) {
    console.error('❌ Không kết nối được MongoDB:', err?.message || err);
    process.exit(1);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server: http://0.0.0.0:${PORT}`);
  });
}

start();
