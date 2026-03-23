const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema(
  {
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sport: { type: String, required: true },
    title: { type: String, required: true },
    location: { type: String, required: true },
    /** yyyy-mm-dd */
    date: { type: String, required: true },
    time: { type: String, default: '' },
    maxPlayers: { type: Number, required: true, min: 1 },
    currentPlayers: { type: Number, default: 0, min: 0 },
    participantIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
    status: {
      type: String,
      enum: ['active', 'finished', 'cancelled'],
      default: 'active',
    },
    winners: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
    cancelReason: { type: String, default: '' },
    minSkillLevel: { type: String, default: 'Tất Cả' },
    description: { type: String, default: '' },
    rules: { type: String, default: '' },
  },
  { timestamps: true },
);

matchSchema.set('toJSON', {
  transform: (_document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    if (returnedObject.hostId) {
      const hid = returnedObject.hostId;
      if (hid && typeof hid === 'object' && !(hid instanceof mongoose.Types.ObjectId)) {
        returnedObject.hostId = hid;
      } else {
        returnedObject.hostId = returnedObject.hostId.toString();
      }
    }
    delete returnedObject._id;
    delete returnedObject.__v;
  },
});

module.exports = mongoose.model('Match', matchSchema);
