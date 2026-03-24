const mongoose = require('mongoose');

const { getSportLabel, normalizeSportKey } = require('../config/courtSports');

function courtOwnerIdString(doc) {
  if (!doc.ownerId) return undefined;
  const owner = doc.ownerId;
  if (owner && typeof owner === 'object' && !(owner instanceof mongoose.Types.ObjectId)) {
    return owner._id ? owner._id.toString() : String(owner.id || '');
  }
  return owner.toString();
}

function courtJsonWithOwner(doc) {
  const j = doc.toJSON();
  const ownerIdStr = courtOwnerIdString(doc);
  const sportKey = normalizeSportKey(j.sportKey || j.sport) || 'football';
  const images = Array.isArray(j.images)
    ? j.images.filter((item) => typeof item === 'string' && item.trim())
    : [];
  const normalizedImages = images.length
    ? images
    : j.imageUrl && String(j.imageUrl).trim()
      ? [String(j.imageUrl).trim()]
      : [];

  let owner = null;
  if (doc.populated('ownerId') && doc.ownerId) {
    const o = doc.ownerId.toJSON();
    owner = {
      id: o.id,
      name: o.name || o.username || 'Chủ sân',
      username: o.username,
      avatar: o.avatar,
      phone: o.phone,
      role: o.role,
    };
  }

  delete j.ownerId;
  return {
    ...j,
    ownerId: ownerIdStr,
    owner,
    sportKey,
    sportLabel: getSportLabel(sportKey),
    images: normalizedImages,
    imageUrl: normalizedImages[0] || '',
    visibilityStatus: j.visibilityStatus || 'active',
    openTime: j.openTime || '06:00',
    closeTime: j.closeTime || '22:00',
    slotMinutes: Number(j.slotMinutes) || 60,
  };
}

module.exports = {
  courtJsonWithOwner,
  courtOwnerIdString,
};
