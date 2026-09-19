const mongoose = require('mongoose');

const Court = require('../models/Court');
const CourtBooking = require('../models/CourtBooking');
const User = require('../models/User');
const { getSportLabel, isValidSportKey, normalizeSportKey } = require('../config/courtSports');
const { normalizeCourtHours } = require('../utils/courtSchedule');
const { courtJsonWithOwner } = require('../utils/courtJson');

function isValidPhone(phone) {
  return /^[\d\s\-\+\(\)]+$/.test(phone);
}

function normalizeAmenities(raw) {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, 12);
  }

  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12);
  }

  return [];
}

function normalizeVisibilityStatus(raw) {
  return String(raw || '').trim().toLowerCase() === 'hidden' ? 'hidden' : 'active';
}

function normalizeImageList(raw) {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, 8);
  }

  if (typeof raw === 'string' && raw.trim()) {
    return [raw.trim()];
  }

  return [];
}

function applyCourtDerivedFields(doc, { sportKey, images }) {
  if (sportKey) {
    doc.sportKey = sportKey;
    doc.sport = getSportLabel(sportKey);
  }
  if (images) {
    doc.images = images;
    doc.imageUrl = images[0] || '';
  }
}

async function resolveOwnerUser(ownerId) {
  if (!ownerId || !mongoose.Types.ObjectId.isValid(String(ownerId))) {
    return { error: 'Thiếu hoặc sai ownerId', status: 400 };
  }

  const user = await User.findById(ownerId);
  if (!user) {
    return { error: 'Không tìm thấy người dùng', status: 404 };
  }

  if (user.role !== 'owner' && user.role !== 'admin') {
    return { error: 'Chỉ tài khoản owner mới được đăng hoặc quản lý sân', status: 403 };
  }

  return { user };
}

function buildPublicCourtFilter(req) {
  // Chỉ hiển thị sân đã được admin duyệt (approvalStatus = 'active')
  const filter = {
    $and: [
      { approvalStatus: 'active' },
      { $or: [{ visibilityStatus: 'active' }, { visibilityStatus: { $exists: false } }] },
    ],
  };
  const q = String(req.query.q || '').trim();
  const sportKey = normalizeSportKey(req.query.sportKey || req.query.sport || '');

  if (sportKey && isValidSportKey(sportKey)) {
    filter.$and.push({ $or: [{ sportKey }, { sport: getSportLabel(sportKey) }] });
  }

  if (q) {
    const pattern = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$and.push({ $or: [{ name: pattern }, { address: pattern }, { sport: pattern }] });
  }

  return filter;
}

async function listCourts(req, res) {
  try {
    const courts = await Court.find(buildPublicCourtFilter(req))
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('ownerId', 'name username avatar phone role');

    return res.json(courts.map((court) => courtJsonWithOwner(court)));
  } catch (error) {
    console.error('❌ GET /api/courts', error);
    return res.status(500).json({ error: 'Không lấy được danh sách sân' });
  }
}

async function listMine(req, res) {
  try {
    const ownerId = req.query.ownerId;
    const ownerResult = await resolveOwnerUser(ownerId);
    if (!ownerResult.user) {
      return res.status(ownerResult.status).json({ error: ownerResult.error });
    }

    const courts = await Court.find({ ownerId })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('ownerId', 'name username avatar phone role');

    return res.json(courts.map((court) => courtJsonWithOwner(court)));
  } catch (error) {
    console.error('❌ GET /api/courts/mine', error);
    return res.status(500).json({ error: 'Không lấy được sân của bạn' });
  }
}

async function getCourt(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID sân không hợp lệ' });
    }

    const doc = await Court.findById(id).populate('ownerId', 'name username avatar phone role');
    if (!doc) {
      return res.status(404).json({ error: 'Không tìm thấy sân' });
    }

    return res.json(courtJsonWithOwner(doc));
  } catch (error) {
    console.error('❌ GET /api/courts/:id', error);
    return res.status(500).json({ error: 'Không lấy được thông tin sân' });
  }
}

async function createCourt(req, res) {
  try {
    const {
      ownerId,
      name,
      sportKey: rawSportKey,
      sport,
      address,
      pricePerHour,
      description,
      amenities,
      images,
      imageUrl,
      contactPhone,
      visibilityStatus,
      openTime,
      closeTime,
      slotMinutes,
    } = req.body || {};

    const ownerResult = await resolveOwnerUser(ownerId);
    if (!ownerResult.user) {
      return res.status(ownerResult.status).json({ error: ownerResult.error });
    }

    const nameTrim = String(name || '').trim();
    if (nameTrim.length < 2) {
      return res.status(400).json({ error: 'Tên sân cần ít nhất 2 ký tự' });
    }

    const normalizedSportKey = normalizeSportKey(rawSportKey || sport);
    if (!isValidSportKey(normalizedSportKey)) {
      return res.status(400).json({ error: 'Môn thể thao của sân không hợp lệ' });
    }

    const addressTrim = String(address || '').trim();
    if (!addressTrim) {
      return res.status(400).json({ error: 'Vui lòng nhập địa chỉ sân' });
    }

    const phoneTrim = String(contactPhone || '').trim();
    if (phoneTrim && !isValidPhone(phoneTrim)) {
      return res.status(400).json({ error: 'Số điện thoại liên hệ không hợp lệ' });
    }

    const priceNum = Number(pricePerHour || 0);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      return res.status(400).json({ error: 'Giá thuê sân phải là số không âm' });
    }

    const normalizedImages = normalizeImageList(images).length
      ? normalizeImageList(images)
      : normalizeImageList(imageUrl);
    const normalizedHours = normalizeCourtHours({ openTime, closeTime, slotMinutes });

    const court = await Court.create({
      ownerId,
      name: nameTrim,
      sportKey: normalizedSportKey,
      sport: getSportLabel(normalizedSportKey),
      address: addressTrim,
      pricePerHour: Math.round(priceNum),
      description: String(description || '').trim(),
      amenities: normalizeAmenities(amenities),
      images: normalizedImages,
      imageUrl: normalizedImages[0] || '',
      contactPhone: phoneTrim,
      visibilityStatus: normalizeVisibilityStatus(visibilityStatus),
      openTime: normalizedHours.openTime,
      closeTime: normalizedHours.closeTime,
      slotMinutes: normalizedHours.slotMinutes,
      // Sân mới luôn ở trạng thái chờ duyệt
      approvalStatus: 'pending',
      rejectReason: '',
    });

    await court.populate('ownerId', 'name username avatar phone role');
    return res.status(201).json(courtJsonWithOwner(court));
  } catch (error) {
    console.error('❌ POST /api/courts', error);
    return res.status(500).json({ error: 'Không đăng được sân' });
  }
}

async function patchCourt(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID sân không hợp lệ' });
    }

    const {
      ownerId,
      name,
      sportKey: rawSportKey,
      sport,
      address,
      pricePerHour,
      description,
      amenities,
      images,
      imageUrl,
      contactPhone,
      visibilityStatus,
      openTime,
      closeTime,
      slotMinutes,
    } = req.body || {};

    const ownerResult = await resolveOwnerUser(ownerId);
    if (!ownerResult.user) {
      return res.status(ownerResult.status).json({ error: ownerResult.error });
    }

    const doc = await Court.findById(id);
    if (!doc) {
      return res.status(404).json({ error: 'Không tìm thấy sân' });
    }

    const callerId = String(ownerResult.user._id);
    const isAdmin = ownerResult.user.role === 'admin';
    if (!isAdmin && !doc.ownerId.equals(new mongoose.Types.ObjectId(callerId))) {
      return res.status(403).json({ error: 'Bạn không có quyền sửa sân này' });
    }

    if (name !== undefined) {
      const nameTrim = String(name || '').trim();
      if (nameTrim.length < 2) {
        return res.status(400).json({ error: 'Tên sân cần ít nhất 2 ký tự' });
      }
      doc.name = nameTrim;
    }

    if (rawSportKey !== undefined || sport !== undefined) {
      const normalizedSportKey = normalizeSportKey(rawSportKey || sport);
      if (!isValidSportKey(normalizedSportKey)) {
        return res.status(400).json({ error: 'Môn thể thao của sân không hợp lệ' });
      }
      applyCourtDerivedFields(doc, { sportKey: normalizedSportKey });
    }

    if (address !== undefined) {
      const addressTrim = String(address || '').trim();
      if (!addressTrim) {
        return res.status(400).json({ error: 'Vui lòng nhập địa chỉ sân' });
      }
      doc.address = addressTrim;
    }

    if (pricePerHour !== undefined) {
      const priceNum = Number(pricePerHour || 0);
      if (!Number.isFinite(priceNum) || priceNum < 0) {
        return res.status(400).json({ error: 'Giá thuê sân phải là số không âm' });
      }
      doc.pricePerHour = Math.round(priceNum);
    }

    if (description !== undefined) {
      doc.description = String(description || '').trim();
    }

    if (amenities !== undefined) {
      doc.amenities = normalizeAmenities(amenities);
    }

    if (images !== undefined || imageUrl !== undefined) {
      const normalizedImages = normalizeImageList(images).length
        ? normalizeImageList(images)
        : normalizeImageList(imageUrl);
      applyCourtDerivedFields(doc, { images: normalizedImages });
    }

    if (contactPhone !== undefined) {
      const phoneTrim = String(contactPhone || '').trim();
      if (phoneTrim && !isValidPhone(phoneTrim)) {
        return res.status(400).json({ error: 'Số điện thoại liên hệ không hợp lệ' });
      }
      doc.contactPhone = phoneTrim;
    }

    if (visibilityStatus !== undefined) {
      doc.visibilityStatus = normalizeVisibilityStatus(visibilityStatus);
    }

    if (openTime !== undefined || closeTime !== undefined || slotMinutes !== undefined) {
      const normalizedHours = normalizeCourtHours({
        openTime: openTime !== undefined ? openTime : doc.openTime,
        closeTime: closeTime !== undefined ? closeTime : doc.closeTime,
        slotMinutes: slotMinutes !== undefined ? slotMinutes : doc.slotMinutes,
      });
      doc.openTime = normalizedHours.openTime;
      doc.closeTime = normalizedHours.closeTime;
      doc.slotMinutes = normalizedHours.slotMinutes;
    }

    await doc.save();
    await doc.populate('ownerId', 'name username avatar phone role');
    return res.json(courtJsonWithOwner(doc));
  } catch (error) {
    console.error('❌ PATCH /api/courts/:id', error);
    return res.status(500).json({ error: 'Không cập nhật được sân' });
  }
}

async function uploadCourtImages(req, res) {
  try {
    const { id } = req.params;
    const ownerId = req.body?.ownerId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID sân không hợp lệ' });
    }
    if (!Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ error: 'Chưa có ảnh được tải lên' });
    }

    const ownerResult = await resolveOwnerUser(ownerId);
    if (!ownerResult.user) {
      return res.status(ownerResult.status).json({ error: ownerResult.error });
    }

    const doc = await Court.findById(id);
    if (!doc) {
      return res.status(404).json({ error: 'Không tìm thấy sân' });
    }

    const callerId = String(ownerResult.user._id);
    const isAdmin = ownerResult.user.role === 'admin';
    if (!isAdmin && !doc.ownerId.equals(new mongoose.Types.ObjectId(callerId))) {
      return res.status(403).json({ error: 'Bạn không có quyền cập nhật ảnh sân này' });
    }

    const uploadedImages = req.files.map((file) => `/uploads/${file.filename}`);
    const existingImages = Array.isArray(doc.images) ? doc.images.filter(Boolean) : [];
    const mergedImages = [...existingImages, ...uploadedImages].slice(0, 8);
    applyCourtDerivedFields(doc, { images: mergedImages });

    await doc.save();
    await doc.populate('ownerId', 'name username avatar phone role');
    return res.json(courtJsonWithOwner(doc));
  } catch (error) {
    console.error('❌ POST /api/courts/:id/images', error);
    return res.status(500).json({ error: 'Không tải ảnh sân lên được' });
  }
}

async function deleteCourt(req, res) {
  try {
    const { id } = req.params;
    const { ownerId } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID sân không hợp lệ' });
    }

    const ownerResult = await resolveOwnerUser(ownerId);
    if (!ownerResult.user) {
      return res.status(ownerResult.status).json({ error: ownerResult.error });
    }

    const doc = await Court.findById(id);
    if (!doc) {
      return res.status(404).json({ error: 'Không tìm thấy sân' });
    }

    const callerId = String(ownerResult.user._id);
    const isAdmin = ownerResult.user.role === 'admin';
    if (!isAdmin && !doc.ownerId.equals(new mongoose.Types.ObjectId(callerId))) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa sân này' });
    }

    await CourtBooking.deleteMany({ courtId: id });
    await Court.findByIdAndDelete(id);
    return res.status(204).send();
  } catch (error) {
    console.error('❌ DELETE /api/courts/:id', error);
    return res.status(500).json({ error: 'Không xóa được sân' });
  }
}

// ─── Admin-only functions ────────────────────────────────────────────────

/**
 * Lấy toàn bộ sân (tất cả approvalStatus) dành cho admin.
 * Sân pending được đẩy lên đầu.
 */
async function listAllCourtsAdmin(_req, res) {
  try {
    const courts = await Court.find({})
      .sort({ approvalStatus: 1, createdAt: -1 })
      .limit(300)
      .populate('ownerId', 'name username avatar phone role');

    return res.json(courts.map((court) => courtJsonWithOwner(court)));
  } catch (error) {
    console.error('❌ GET /api/admin/courts', error);
    return res.status(500).json({ error: 'Không lấy được danh sách sân' });
  }
}

/**
 * Admin duyệt sân: chuyển approvalStatus thành 'active'.
 */
async function approveCourt(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID sân không hợp lệ' });
    }

    const court = await Court.findByIdAndUpdate(
      id,
      { approvalStatus: 'active', rejectReason: '' },
      { new: true },
    ).populate('ownerId', 'name username avatar phone role');

    if (!court) return res.status(404).json({ error: 'Không tìm thấy sân' });
    return res.json(courtJsonWithOwner(court));
  } catch (error) {
    console.error('❌ PATCH /api/admin/courts/:id/approve', error);
    return res.status(500).json({ error: 'Duyệt sân thất bại' });
  }
}

/**
 * Admin từ chối sân: chuyển approvalStatus thành 'rejected' kèm lý do.
 */
async function rejectCourt(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID sân không hợp lệ' });
    }

    const reasonTrim = String(reason || '').trim();
    if (!reasonTrim || reasonTrim.length < 3) {
      return res.status(400).json({ error: 'Vui lòng nhập lý do từ chối (ít nhất 3 ký tự)' });
    }

    const court = await Court.findByIdAndUpdate(
      id,
      { approvalStatus: 'rejected', rejectReason: reasonTrim },
      { new: true },
    ).populate('ownerId', 'name username avatar phone role');

    if (!court) return res.status(404).json({ error: 'Không tìm thấy sân' });
    return res.json(courtJsonWithOwner(court));
  } catch (error) {
    console.error('❌ PATCH /api/admin/courts/:id/reject', error);
    return res.status(500).json({ error: 'Từ chối sân thất bại' });
  }
}

/**
 * Owner đăng lại sân bị từ chối: reset approvalStatus về 'pending'.
 * Chỉ được gọi khi sân đang ở trạng thái 'rejected'.
 */
async function resubmitCourt(req, res) {
  try {
    const { id } = req.params;
    const { ownerId } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID sân không hợp lệ' });
    }

    const ownerResult = await resolveOwnerUser(ownerId);
    if (!ownerResult.user) {
      return res.status(ownerResult.status).json({ error: ownerResult.error });
    }

    const doc = await Court.findById(id);
    if (!doc) {
      return res.status(404).json({ error: 'Không tìm thấy sân' });
    }

    const callerId = String(ownerResult.user._id);
    const isAdmin = ownerResult.user.role === 'admin';
    if (!isAdmin && !doc.ownerId.equals(new mongoose.Types.ObjectId(callerId))) {
      return res.status(403).json({ error: 'Bạn không có quyền đăng lại sân này' });
    }

    if (doc.approvalStatus !== 'rejected') {
      return res.status(400).json({ error: 'Chỉ có thể đăng lại sân đang bị từ chối' });
    }

    const court = await Court.findByIdAndUpdate(
      id,
      { approvalStatus: 'pending', rejectReason: '' },
      { new: true },
    ).populate('ownerId', 'name username avatar phone role');

    return res.json(courtJsonWithOwner(court));
  } catch (error) {
    console.error('❌ PATCH /api/courts/:id/resubmit', error);
    return res.status(500).json({ error: 'Không đăng lại được sân' });
  }
}

module.exports = {
  createCourt,
  deleteCourt,
  getCourt,
  listCourts,
  listMine,
  listAllCourtsAdmin,
  approveCourt,
  rejectCourt,
  resubmitCourt,
  patchCourt,
  resolveOwnerUser,
  uploadCourtImages,
};
