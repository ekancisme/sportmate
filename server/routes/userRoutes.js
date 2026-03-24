const express = require('express');
const { upload } = require('../config/upload');
const userController = require('../controllers/userController');
const User = require('../models/User');

const router = express.Router();

router.post('/:id/avatar', upload.single('avatar'), userController.uploadAvatar);
router.get('/:id', userController.getUser);
router.put('/:id', userController.updateUser);

// Route mới: lấy danh sách suggested partners
router.get('/', async (req, res) => {
  try {
    const { exclude, limit = 10 } = req.query;
    const query = {};
    
    // Loại trừ user hiện tại (nếu có)
    if (exclude) {
      query._id = { $ne: exclude };
    }
    
    const users = await User.find(query)
      .select('name username avatar location bio stats sports')
      .limit(Number(limit))
      .lean();
    
    // Transform để phù hợp với client
    const result = users.map(u => ({
      id: u._id.toString(),
      name: u.name || u.username,
      username: u.username,
      avatar: u.avatar,
      location: u.location,
      bio: u.bio,
      winRate: u.stats?.winRate || 0,
      matchesPlayed: u.stats?.matchesPlayed || 0,
      sport: u.sports?.[0]?.name || 'Chưa chọn',
      level: u.sports?.[0]?.level || 'Tất cả',
    }));
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Lấy danh sách người dùng thất bại' });
  }
});

module.exports = router;
