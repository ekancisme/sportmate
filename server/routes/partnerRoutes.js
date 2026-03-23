const express = require("express");
const User = require("../models/User");

const router = express.Router();

// ─── Haversine distance (km) ────────────────────────────────────────────────
function haversineKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Text-based distance (city / region) ────────────────────────────────────
const CITIES = {
  // Key = normalised, Value = region (-1=north, 0=central, 1=south)
  "tp.hcm": 1,
  "tp hcm": 1,
  "hồ chí minh": 1,
  hcm: 1,
  "sài gòn": 1,
  "vũng tàu": 1,
  "bình dương": 1,
  "đồng nai": 1,
  "bình phước": 1,
  "tây ninh": 1,
  "an giang": 1,
  "bạc liêu": 1,
  "bến tre": 1,
  "cà mau": 1,
  "hậu giang": 1,
  "kiên giang": 1,
  "lâm đồng": 1,
  "long an": 1,
  "tiền giang": 1,
  "trà vinh": 1,
  "vĩnh long": 1,
  "đà nẵng": 0,
  "da nang": 0,
  đn: 0,
  "quảng nam": 0,
  "quảng ngãi": 0,
  "quảng bình": 0,
  "quảng trị": 0,
  "thừa thiên huế": 0,
  huế: 0,
  hue: 0,
  "bình định": 0,
  "kon tum": 0,
  "đắk lắk": 0,
  "đak lak": 0,
  "đắk nông": 0,
  "dak nong": 0,
  "gia lai": 0,
  "khánh hòa": 0,
  "ninh thuận": 0,
  "phú yên": 0,
  "hà nội": -1,
  "ha noi": -1,
  hn: -1,
  hanoi: -1,
  "hải phòng": -1,
  "hai phong": -1,
  "hải dương": -1,
  "hải duơng": -1,
  "thái nguyên": -1,
  "lạng sơn": -1,
  "bắc cạn": -1,
  "bắc giang": -1,
  "bắc ninh": -1,
  "hà giang": -1,
  "hòa bình": -1,
  "hưng yên": -1,
  "lai châu": -1,
  "lào cai": -1,
  "nam định": -1,
  "ninh bình": -1,
  "phú thọ": -1,
  "quảng ninh": -1,
  "sơn la": -1,
  "thái bình": -1,
  "thanh hóa": -1,
  "tuyên quang": -1,
  "vĩnh phúc": -1,
  "yên bái": -1,
  "điện biên": -1,
  "hà nam": -1,
};

// Keywords that indicate a VAGUE / street-level address (no city/town name)
const VAGUE_KEYWORDS = [
  "yên lãng",
  "trần phú",
  "nguyễn trãi",
  "lê lai",
  "đê la",
  "quang trung",
  "lê duẩn",
  "hoàng diệu",
  "bà huyện",
  "phan",
  "nguyễn",
  "trần",
  "đặng",
  "võ nguyên",
  "bùi",
  "đường",
  "phố",
  "quốc lộ",
  "tỉnh lộ",
  "ấp",
  "xã",
  "thôn",
  "phường",
  "số ",
  "phạm",
  "lý",
  "chu",
  "huyền",
  "thanh",
];

function norm(str) {
  return String(str || "")
    .toLowerCase()
    .trim();
}

function getCityFromLocation(loc) {
  if (!loc) return null;
  const l = norm(loc);
  for (const [key, region] of Object.entries(CITIES)) {
    if (l.includes(key)) return region;
  }
  return null;
}

function isVagueAddress(loc) {
  if (!loc) return true;
  const l = norm(loc);
  // Has digits but no known city → likely a street number address
  if (/\d/.test(l) && getCityFromLocation(l) === null) return true;
  // Check vague keyword patterns
  return VAGUE_KEYWORDS.some((kw) => l.includes(kw));
}

function calcTextDist(loc1, loc2) {
  if (!loc1 || !loc2) return 3;
  const l1 = norm(loc1);
  const l2 = norm(loc2);
  if (l1 === l2) return 0;

  const c1 = getCityFromLocation(l1);
  const c2 = getCityFromLocation(l2);

  if (c1 === null || c2 === null) {
    // At least one vague → lower priority
    if (c1 === null && c2 === null) return 3;
    return 2;
  }
  return c1 === c2 ? 0 : Math.abs(c1 - c2) === 1 ? 1 : 2;
}

// ─── Score a partner: lower = more relevant ──────────────────────────────────
// Priority: Same city > Same region > Different region
// Within same city: GPS partners first (sorted by distance), then non-GPS
function scorePartner(p, userLat, userLng, userLoc) {
  // Determine city/region of partner
  const partnerCity = getCityFromLocation(p.location);
  const userCity = getCityFromLocation(userLoc);
  
  // City/region score (primary ranking)
  let cityScore = 100; // Default: different region
  if (userCity !== null && partnerCity !== null) {
    if (partnerCity === userCity) {
      cityScore = 0; // Same city → highest priority
    } else if (Math.abs(partnerCity - userCity) === 1) {
      cityScore = 50; // Adjacent region
    } else {
      cityScore = 100; // Different region
    }
  } else if (userCity !== null || partnerCity !== null) {
    cityScore = 75; // One has city, one doesn't
  }

  // GPS bonus: partners with GPS get priority within same city tier
  const hasGps = p.latitude != null && p.longitude != null;
  const hasUserGps = userLat != null && userLng != null;
  
  let gpsBonus = 0;
  let kmDistance = 999; // Default far
  
  if (hasGps && hasUserGps) {
    // Both have GPS → calculate real distance
    kmDistance = haversineKm(userLat, userLng, p.latitude, p.longitude) || 999;
    // Closer partners get bonus (0-10 points)
    if (kmDistance < 5) gpsBonus = 0;
    else if (kmDistance < 20) gpsBonus = 2;
    else if (kmDistance < 50) gpsBonus = 5;
    else gpsBonus = 10;
  } else if (hasGps) {
    // Partner has GPS but user doesn't → slight penalty
    gpsBonus = 3;
  } else if (hasUserGps) {
    // User has GPS but partner doesn't → no GPS bonus
    gpsBonus = 5;
  } else {
    // Neither has GPS → higher penalty
    gpsBonus = 8;
  }

  // Vague address penalty (only if no city detected)
  const vague = isVagueAddress(p.location) || !p.location;
  const vaguePenalty = (vague && cityScore > 0) ? 20 : 0;

  return cityScore + gpsBonus + vaguePenalty;
}

// ─── GET /api/partners/suggested ─────────────────────────────────────────────
router.get("/suggested", async (req, res) => {
  try {
    const { userId, lat, lng, limit = 20, currentLocation } = req.query;

    const userLat = lat != null ? parseFloat(lat) : null;
    const userLng = lng != null ? parseFloat(lng) : null;
    let userLocation = currentLocation || null;

    // If no GPS location, try to get from DB
    if (!userLocation && userId) {
      const dbUser = await User.findById(userId)
        .select("location latitude longitude")
        .lean();
      if (dbUser) {
        // Use DB coordinates if available
        if (!userLat && dbUser.latitude != null && dbUser.longitude != null) {
          userLat = dbUser.latitude;
          userLng = dbUser.longitude;
        }
        if (!userLocation && dbUser.location) {
          userLocation = dbUser.location;
        }
      }
    }

    // Build exclude query
    const query = {};
    if (userId) {
      query._id = { $ne: userId };
    }

    // Fetch partners including lat/lng
    const users = await User.find(query)
      .select(
        "name username avatar location latitude longitude bio stats sports",
      )
      .lean();

    // Score and sort
    const scored = users.map((u) => {
      const partner = {
        id: u._id.toString(),
        name: u.name || u.username,
        username: u.username,
        avatar: u.avatar,
        location: u.location,
        bio: u.bio,
        latitude: u.latitude,
        longitude: u.longitude,
        winRate: u.stats?.winRate || 0,
        matchesPlayed: u.stats?.matchesPlayed || 0,
        sport: u.sports?.[0]?.name || null,
        level: u.sports?.[0]?.level || null,
      };
      const score = scorePartner(partner, userLat, userLng, userLocation);

      // Also compute readable distance
      let distanceKm = null;
      let distanceLevel = "unknown";
      if (
        userLat != null &&
        userLng != null &&
        u.latitude != null &&
        u.longitude != null
      ) {
        distanceKm = haversineKm(userLat, userLng, u.latitude, u.longitude);
      }
      if (distanceKm !== null) {
        if (distanceKm < 5) distanceLevel = "nearby";
        else if (distanceKm < 30) distanceLevel = "city";
        else if (distanceKm < 100) distanceLevel = "region";
        else distanceLevel = "far";
      } else {
        const td = calcTextDist(userLocation, u.location);
        distanceLevel =
          td === 0
            ? "same_city"
            : td === 1
              ? "same_region"
              : td === 2
                ? "different"
                : "unknown";
      }

      return {
        ...partner,
        _score: score,
        _distanceKm: distanceKm,
        distanceLevel,
      };
    });

    scored.sort((a, b) => {
      // Primary: score (lower = more relevant)
      if (a._score !== b._score) return a._score - b._score;
      // Secondary: win rate desc
      return (b.winRate || 0) - (a.winRate || 0);
    });

    const result = scored
      .slice(0, Number(limit))
      .map(({ _score, _distanceKm, latitude, longitude, ...rest }) => rest);

    res.json({
      partners: result,
      total: users.length,
      userLocation,
      userLat,
      userLng,
    });
  } catch (error) {
    console.error("Error fetching suggested partners:", error);
    res.status(500).json({ error: "Lấy danh sách partner thất bại", detail: error.message });
  }
});

module.exports = router;
