const mongoose = require('mongoose');

const venueSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    name: { type: String, required: true },
    address: { type: String, default: '' },
    sport: { type: String, default: '' },
    description: { type: String, default: '' },

    pricePerHour: { type: Number, default: 0, min: 0 },

    status: {
      type: String,
      enum: ['pending', 'active', 'rejected'],
      default: 'pending',
    },
    rejectReason: { type: String, default: '' },
  },
  { timestamps: true },
);

venueSchema.set('toJSON', {
  transform: (_document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  },
});

module.exports = mongoose.model('Venue', venueSchema);

