const mongoose = require('mongoose');

const Court = require('../models/Court');
const CourtBooking = require('../models/CourtBooking');
const User = require('../models/User');
const { courtJsonWithOwner } = require('../utils/courtJson');
const {
  buildCourtSlots,
  isValidDateKey,
  normalizeCourtHours,
  todayDateKey,
} = require('../utils/courtSchedule');

function bookingJsonWithUser(doc) {
  const json = doc.toJSON();
  let user = null;

  if (doc.populated('userId') && doc.userId) {
    const hydratedUser = doc.userId.toJSON();
    user = {
      id: hydratedUser.id,
      name: hydratedUser.name || hydratedUser.username || 'Nguoi dat san',
      username: hydratedUser.username,
      phone: hydratedUser.phone,
      avatar: hydratedUser.avatar,
    };
  }

  return { ...json, user };
}

async function resolveUser(userId) {
  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
    return { error: 'Thiếu hoặc sai userId', status: 400 };
  }

  const user = await User.findById(userId);
  if (!user) {
    return { error: 'Không tìm thấy người dùng', status: 404 };
  }

  return { user };
}

async function resolveOwnerActor(ownerId) {
  const result = await resolveUser(ownerId);
  if (!result.user) return result;
  if (result.user.role !== 'owner' && result.user.role !== 'admin') {
    return { error: 'Chỉ owner mới được quản lý lịch đặt', status: 403 };
  }
  return result;
}

function getCourtHours(court) {
  return normalizeCourtHours({
    openTime: court.openTime,
    closeTime: court.closeTime,
    slotMinutes: court.slotMinutes,
  });
}

function buildAvailabilityPayload(court, bookings) {
  const slots = buildCourtSlots(court);
  const bookedSet = new Set(bookings.map((booking) => booking.startMinutes));

  return {
    date: bookings[0]?.bookingDate || null,
    openTime: court.openTime,
    closeTime: court.closeTime,
    slotMinutes: court.slotMinutes,
    slots: slots.map((slot) => ({
      ...slot,
      available: !bookedSet.has(slot.startMinutes),
    })),
  };
}

async function getAvailability(req, res) {
  try {
    const { id } = req.params;
    const date = String(req.query.date || todayDateKey()).trim();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID sân không hợp lệ' });
    }
    if (!isValidDateKey(date)) {
      return res.status(400).json({ error: 'Ngày xem lịch không hợp lệ' });
    }

    const court = await Court.findById(id);
    if (!court) {
      return res.status(404).json({ error: 'Không tìm thấy sân' });
    }

    const bookings = await CourtBooking.find({
      courtId: id,
      bookingDate: date,
      status: 'booked',
    }).select('bookingDate startMinutes endMinutes startTime endTime');

    const hours = getCourtHours(court);
    const slots = buildCourtSlots(hours).map((slot) => ({
      ...slot,
      available: !bookings.some((booking) => booking.startMinutes === slot.startMinutes),
    }));

    return res.json({
      date,
      openTime: hours.openTime,
      closeTime: hours.closeTime,
      slotMinutes: hours.slotMinutes,
      slots,
    });
  } catch (error) {
    console.error('❌ GET /api/courts/:id/availability', error);
    return res.status(500).json({ error: 'Không lấy được lich trong cua san' });
  }
}

async function createBooking(req, res) {
  try {
    const { id } = req.params;
    const { userId, bookingDate, startTime, contactName, contactPhone, note } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID sân không hợp lệ' });
    }
    if (!isValidDateKey(bookingDate)) {
      return res.status(400).json({ error: 'Ngày đặt sân không hợp lệ' });
    }

    const userResult = await resolveUser(userId);
    if (!userResult.user) {
      return res.status(userResult.status).json({ error: userResult.error });
    }

    const court = await Court.findById(id).populate('ownerId', 'name username avatar phone role');
    if (!court) {
      return res.status(404).json({ error: 'Không tìm thấy sân' });
    }
    if (court.visibilityStatus === 'hidden') {
      return res.status(400).json({ error: 'Sân này hiện đang tạm ẩn' });
    }

    const hours = getCourtHours(court);
    const slots = buildCourtSlots(hours);
    const chosenSlot = slots.find((slot) => slot.startTime === String(startTime || '').trim());
    if (!chosenSlot) {
      return res.status(400).json({ error: 'Khung giờ bạn chọn không hợp lệ' });
    }

    const existingBooking = await CourtBooking.findOne({
      courtId: id,
      bookingDate,
      startMinutes: chosenSlot.startMinutes,
      status: 'booked',
    });
    if (existingBooking) {
      return res.status(409).json({ error: 'Khung giờ này vừa được người khác đặt' });
    }

    const booking = await CourtBooking.create({
      courtId: id,
      ownerId: court.ownerId._id || court.ownerId,
      userId,
      bookingDate,
      startTime: chosenSlot.startTime,
      endTime: chosenSlot.endTime,
      startMinutes: chosenSlot.startMinutes,
      endMinutes: chosenSlot.endMinutes,
      durationMinutes: hours.slotMinutes,
      priceSnapshot: Number(court.pricePerHour || 0),
      contactName: String(contactName || userResult.user.name || userResult.user.username || '').trim(),
      contactPhone: String(contactPhone || userResult.user.phone || '').trim(),
      note: String(note || '').trim(),
      status: 'booked',
    });

    await booking.populate('userId', 'name username phone avatar');

    return res.status(201).json({
      booking: bookingJsonWithUser(booking),
      court: courtJsonWithOwner(court),
    });
  } catch (error) {
    console.error('❌ POST /api/courts/:id/bookings', error);

    if (error?.code === 11000) {
      return res.status(409).json({ error: 'Khung giờ này vừa được người khác đặt' });
    }

    return res.status(500).json({ error: 'Không thể đặt sân lúc này' });
  }
}

async function listCourtBookings(req, res) {
  try {
    const { id } = req.params;
    const ownerId = req.query.ownerId;
    const date = String(req.query.date || todayDateKey()).trim();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID sân không hợp lệ' });
    }
    if (!isValidDateKey(date)) {
      return res.status(400).json({ error: 'Ngày xem lịch không hợp lệ' });
    }

    const ownerResult = await resolveOwnerActor(ownerId);
    if (!ownerResult.user) {
      return res.status(ownerResult.status).json({ error: ownerResult.error });
    }

    const court = await Court.findById(id).populate('ownerId', 'name username avatar phone role');
    if (!court) {
      return res.status(404).json({ error: 'Không tìm thấy sân' });
    }

    const isAdmin = ownerResult.user.role === 'admin';
    if (!isAdmin && String(court.ownerId._id || court.ownerId) !== String(ownerResult.user._id)) {
      return res.status(403).json({ error: 'Bạn không có quyền xem lịch đặt của sân này' });
    }

    const bookings = await CourtBooking.find({ courtId: id, bookingDate: date, status: 'booked' })
      .sort({ startMinutes: 1 })
      .populate('userId', 'name username phone avatar');

    const availability = buildAvailabilityPayload(court, bookings.map((booking) => booking.toObject()));
    availability.date = date;

    return res.json({
      court: courtJsonWithOwner(court),
      date,
      availability,
      bookings: bookings.map((booking) => bookingJsonWithUser(booking)),
    });
  } catch (error) {
    console.error('❌ GET /api/courts/:id/bookings', error);
    return res.status(500).json({ error: 'Không lấy được lich dat cua san' });
  }
}

async function cancelBooking(req, res) {
  try {
    const { id } = req.params;
    const actorId = req.body?.actorId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID booking không hợp lệ' });
    }

    const actorResult = await resolveUser(actorId);
    if (!actorResult.user) {
      return res.status(actorResult.status).json({ error: actorResult.error });
    }

    const booking = await CourtBooking.findById(id).populate('userId', 'name username phone avatar');
    if (!booking) {
      return res.status(404).json({ error: 'Không tìm thấy booking' });
    }

    const actor = actorResult.user;
    const isOwner = String(booking.ownerId) === String(actor._id) || actor.role === 'admin';
    const isBooker = String(booking.userId._id || booking.userId) === String(actor._id);

    if (!isOwner && !isBooker) {
      return res.status(403).json({ error: 'Bạn không có quyền hủy booking này' });
    }

    if (booking.status !== 'booked') {
      return res.json(bookingJsonWithUser(booking));
    }

    booking.status = isOwner && !isBooker ? 'cancelled_by_owner' : 'cancelled_by_user';
    await booking.save();
    await booking.populate('userId', 'name username phone avatar');
    return res.json(bookingJsonWithUser(booking));
  } catch (error) {
    console.error('❌ PATCH /api/court-bookings/:id/cancel', error);
    return res.status(500).json({ error: 'Không hủy được booking' });
  }
}

module.exports = {
  cancelBooking,
  createBooking,
  getAvailability,
  listCourtBookings,
};
