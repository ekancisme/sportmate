const mongoose = require('mongoose');

const Venue = require('../models/Venue');

function assertValidObjectId(id, name = 'id') {
  if (!mongoose.Types.ObjectId.isValid(String(id))) {
    const err = new Error(`Sai ${name}`);
    err.statusCode = 400;
    throw err;
  }
}

async function requestVenue(req, res) {
  try {
    const {
      ownerId,
      userId,
      name,
      address,
      sport,
      description,
      pricePerHour,
    } = req.body || {};

    const owner = ownerId ?? userId;
    if (!owner) return res.status(400).json({ error: 'Thiếu ownerId (hoặc userId)' });
    assertValidObjectId(owner, 'ownerId');

    const nameTrim = String(name || '').trim();
    if (nameTrim.length < 2) return res.status(400).json({ error: 'Tên sân không hợp lệ' });

    const price = Number(pricePerHour);
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ error: 'pricePerHour không hợp lệ' });
    }

    const venue = await Venue.create({
      ownerId: new mongoose.Types.ObjectId(String(owner)),
      name: nameTrim,
      address: String(address || '').trim(),
      sport: String(sport || '').trim(),
      description: String(description || '').trim(),
      pricePerHour: price,
      status: 'pending',
      rejectReason: '',
    });

    return res.status(201).json(venue.toJSON());
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ POST /api/venues', error);
    const statusCode = error?.statusCode ?? 500;
    return res.status(statusCode).json({ error: error?.message || 'Gửi yêu cầu sân thất bại' });
  }
}

module.exports = {
  requestVenue,
};

