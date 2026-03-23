const express = require('express');
const User = require('../models/User');

const router = express.Router();

// Tính khoảng cách Haversine giữa 2 điểm (km)
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Bán kính trái đất (km)
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

// Các thành phố Đà Nẵng để so sánh
const DA_NANG_KEYWORDS = ['đà nẵng', 'da nang', 'đn'];
const HCM_KEYWORDS = ['tp.hcm', 'tp hcm', 'hồ chí minh', 'hcm', 'sài gòn'];
const HN_KEYWORDS = ['hà nội', 'ha noi', 'hn', 'hanoi'];

// Tính khoảng cách location giữa 2 user (0 = cùng thành phố, 1 = cùng miền, 2 = khác miền)
function locationDistance(loc1, loc2) {
  if (!loc1 || !loc2) return 1;
  
  const l1 = loc1.toLowerCase();
  const l2 = loc2.toLowerCase();
  
  if (l1 === l2) return 0;
  
  const sameCity =
    (containsAny(l1, DA_NANG_KEYWORDS) && containsAny(l2, DA_NANG_KEYWORDS)) ||
    (containsAny(l1, HCM_KEYWORDS) && containsAny(l2, HCM_KEYWORDS)) ||
    (containsAny(l1, HN_KEYWORDS) && containsAny(l2, HN_KEYWORDS));
  
  if (sameCity) return 0;
  
  const sameRegion =
    (isMiềnTrung(l1) && isMiềnTrung(l2)) ||
    (isMiềnNam(l1) && isMiềnNam(l2)) ||
    (isMiềnBắc(l1) && isMiềnBắc(l2));
  
  return sameRegion ? 1 : 2;
}

function containsAny(str, keywords) {
  return keywords.some(kw => str.includes(kw));
}

function isMiềnNam(loc) {
  const keywords = [...HCM_KEYWORDS, 'vũng tàu', 'bình dương', 'đồng nai', 'bình phước', 'tây ninh', 
    'an giang', 'bạc liêu', 'bến tre', 'cà mau', 'hậu giang', 'kiên giang', 'lâm đồng', 
    'long an', 'minh hai', 'nam định', 'nghệ an', 'ninh thuận', 'phú yên', 'quảng bình', 
    'quảng nam', 'quảng ngãi', 'sóc trăng', 'thanh hóa', 'thừa thiên huế', 'tiền giang', 
    'trà vinh', 'tuyên quang', 'vĩnh long', 'vĩnh phúc'];
  return containsAny(loc, keywords);
}

function isMiềnTrung(loc) {
  const keywords = ['đà nẵng', 'da nang', 'đắk lắk', 'đak lak', 'đắk nông', 'dak nong', 'gia lai', 
    'khánh hòa', 'ninh thuận', 'phú yên', 'quảng bình', 'quảng nam', 'quảng ngãi', 'quảng trị', 
    'thừa thiên huế', 'bình định', 'kon tum'];
  return containsAny(loc, keywords);
}

function isMiềnBắc(loc) {
  const keywords = [...HN_KEYWORDS, 'hải phòng', 'hai phong', 'hải duơng', 'hải dương', 'đà nẵng', 
    'thái nguyên', 'lạng sơn', 'bắc cạn', 'bắc giang', 'bắc ninh', 'hà giang', 'hòa bình', 
    'hưng yên', 'lai châu', 'lào cai', 'nam định', 'ninh bình', 'phú thọ', 'quảng ninh', 
    'sơn la', 'thái bình', 'thanh hóa', 'tuyên quang', 'vĩnh phúc', 'yên bái', 'điện biên', 
    'hà nam', 'nam định'];
  return containsAny(loc, keywords);
}

// GET /api/partners/suggested - Lấy danh sách partners gợi ý
router.get('/suggested', async (req, res) => {
  try {
    const { userId, lat, lng, limit = 20, currentLocation } = req.query;
    
    // Lấy thông tin user hiện tại để biết location
    // Ưu tiên: currentLocation (từ GPS) > user.location (từ DB)
    let userLocation = currentLocation as string | null;
    
    if (!userLocation && userId) {
      const currentUser = await User.findById(userId).select('location').lean();
      if (currentUser?.location) {
        userLocation = currentUser.location;
      }
    }
    
    // Build query để exclude user hiện tại
    const query = {};
    if (userId) {
      query._id = { $ne: userId };
    }
    
    // Lấy tất cả users (trừ user hiện tại)
    const users = await User.find(query)
      .select('name username avatar location bio stats sports')
      .lean();
    
    // Transform và tính distance
    let result = users.map(u => {
      const userLoc = u.location || '';
      const dist = userLocation ? locationDistance(userLocation, userLoc) : 1;
      
      return {
        id: u._id.toString(),
        name: u.name || u.username,
        username: u.username,
        avatar: u.avatar,
        location: u.location,
        bio: u.bio,
        winRate: u.stats?.winRate || 0,
        matchesPlayed: u.stats?.matchesPlayed || 0,
        sport: u.sports?.[0]?.name || null,
        level: u.sports?.[0]?.level || null,
        _distance: dist,
      };
    });
    
    // Sắp xếp theo khoảng cách (gần nhất lên đầu)
    result.sort((a, b) => a._distance - b._distance);
    
    // Giới hạn số lượng
    result = result.slice(0, Number(limit));
    
    // Trả về kèm khoảng cách để hiển thị
    result = result.map(({ _distance, ...rest }) => ({
      ...rest,
      distanceLevel: _distance === 0 ? 'same_city' : _distance === 1 ? 'same_region' : 'far',
    }));
    
    res.json({
      partners: result,
      total: users.length,
      userLocation: userLocation,
    });
  } catch (error) {
    console.error('Error fetching suggested partners:', error);
    res.status(500).json({ error: 'Lấy danh sách partner thất bại' });
  }
});

module.exports = router;
