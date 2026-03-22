const bcrypt = require('bcryptjs');
const { BCRYPT_ROUNDS } = require('../config/constants');

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

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

module.exports = {
  hashPassword,
  verifyPassword,
  isValidEmail,
};
