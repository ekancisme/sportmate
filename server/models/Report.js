const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true },
    reporterHostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reportedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved'],
      default: 'pending',
    },
    warningSentAt: { type: Date, default: null },
    warningNote: { type: String, default: '' },
    resolvedAt: { type: Date, default: null },
    resolvedAction: {
      type: String,
      enum: ['', 'warned', 'banned'],
      default: '',
    },
  },
  { timestamps: true },
);

reportSchema.set('toJSON', {
  transform: (_document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  },
});

module.exports = mongoose.model('Report', reportSchema);
