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

async function getRanking(req, res) {
  try {
    const users = await User.find({ isBanned: { $ne: true } })
      .select('name avatar location sports stats')
      .lean();

    // Sort: matchesWon desc → winRate desc → matchesPlayed desc
    const sorted = users
      .map((u) => ({
        id: u._id.toString(),
        name: u.name || 'Ẩn danh',
        avatar: u.avatar || null,
        location: u.location || '',
        sport: u.sports?.[0]?.name || null,
        level: u.sports?.[0]?.level || null,
        matchesWon:    u.stats?.matchesWon    ?? 0,
        matchesPlayed: u.stats?.matchesPlayed ?? 0,
        winRate:       u.stats?.winRate       ?? 0,
        hoursActive:   u.stats?.hoursActive   ?? 0,
      }))
      .sort((a, b) => {
        if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;
        if (b.winRate    !== a.winRate)    return b.winRate    - a.winRate;
        return b.matchesPlayed - a.matchesPlayed;
      });

    return res.json(sorted);
  } catch (error) {
    console.error('Ranking error:', error);
    return res.status(500).json({ error: 'Lấy bảng xếp hạng thất bại' });
  }
}

async function toggleFavorite(req, res) {
  try {
    const { id } = req.params;          // ID người được yêu thích
    const { fromUserId } = req.body;    // ID người đang ấn yêu thích

    if (!fromUserId) {
      return res.status(400).json({ error: 'Thiếu fromUserId' });
    }

    const target = await User.findById(id);
    if (!target) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    const alreadyFavorited = target.favorites
      .map(String)
      .includes(String(fromUserId));

    if (alreadyFavorited) {
      // Bỏ thích → xóa khỏi mảng
      await User.findByIdAndUpdate(id, { $pull: { favorites: fromUserId } });
    } else {
      // Yêu thích → thêm vào mảng (addToSet tránh trùng)
      await User.findByIdAndUpdate(id, { $addToSet: { favorites: fromUserId } });
    }

    const updated = await User.findById(id).select('favorites').lean();
    return res.json({
      favorited: !alreadyFavorited,
      favoritesCount: updated?.favorites?.length ?? 0,
    });
  } catch (error) {
    console.error('toggleFavorite error:', error);
    return res.status(500).json({ error: 'Thao tác yêu thích thất bại' });
  }
}

module.exports = {
  uploadAvatar,
  getUser,
  updateUser,
  getRanking,
  toggleFavorite,
};
