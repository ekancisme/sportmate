const User = require('../models/User');

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Tìm user theo email không phân biệt hoa/thường (dữ liệu cũ có thể khác casing) */
async function findUserByEmailLoose(emailLower) {
  return User.findOne({
    email: new RegExp(`^${escapeRegex(emailLower)}$`, 'i'),
  });
}

module.exports = {
  findUserByEmailLoose,
  escapeRegex,
};
