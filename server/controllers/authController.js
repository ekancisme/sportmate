const User = require('../models/User');
const PasswordReset = require('../models/PasswordReset');
const { MIN_PASSWORD_LENGTH, RESET_CODE_EXPIRE_MS } = require('../config/constants');
const { hashPassword, verifyPassword, isValidEmail } = require('../utils/auth');
const { sendMail, generateResetCode } = require('../utils/mail');
const { findUserByEmailLoose } = require('../utils/userQueries');

async function register(req, res) {
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
}

async function login(req, res) {
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
}

async function forgotPassword(req, res) {
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
}

async function resetPassword(req, res) {
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
}

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
};
