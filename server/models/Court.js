const mongoose = require('mongoose');

const { SPORT_OPTIONS } = require('../config/courtSports');

const sportKeys = SPORT_OPTIONS.map((item) => item.key);

const courtSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    sportKey: { type: String, enum: sportKeys, required: true, trim: true },
    sport: { type: String, default: '' },
    address: { type: String, required: true, trim: true },
    pricePerHour: { type: Number, default: 0, min: 0 },
    description: { type: String, default: '' },
    amenities: { type: [String], default: [] },
    images: { type: [String], default: [] },
    imageUrl: { type: String, default: '' },
    contactPhone: { type: String, default: '' },
    visibilityStatus: { type: String, enum: ['active', 'hidden'], default: 'active' },
    openTime: { type: String, default: '06:00' },
    closeTime: { type: String, default: '22:00' },
    slotMinutes: { type: Number, default: 60, min: 30 },
  },
  { timestamps: true },
);

courtSchema.index({ ownerId: 1, createdAt: -1 });
courtSchema.index({ sportKey: 1, visibilityStatus: 1 });

courtSchema.set('toJSON', {
  transform: (_document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    if (returnedObject.ownerId) {
      const owner = returnedObject.ownerId;
      if (owner && typeof owner === 'object' && !(owner instanceof mongoose.Types.ObjectId)) {
        returnedObject.ownerId = owner;
      } else {
        returnedObject.ownerId = returnedObject.ownerId.toString();
      }
    }
    delete returnedObject._id;
    delete returnedObject.__v;
  },
});

module.exports = mongoose.model('Court', courtSchema);
