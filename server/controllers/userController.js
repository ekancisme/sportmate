const User = require('../models/User');

async function uploadAvatar(req, res) {
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
}

async function getUser(req, res) {
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
}

async function updateUser(req, res) {
  try {
    const allowedFields = [
      'name',
      'age',
      'location',
      'latitude',
      'longitude',
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
}

module.exports = {
  uploadAvatar,
  getUser,
  updateUser,
};
