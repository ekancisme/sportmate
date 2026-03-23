const mongoose = require('mongoose');

const courtBookingSchema = new mongoose.Schema(
  {
    courtId: { type: mongoose.Schema.Types.ObjectId, ref: 'Court', required: true, index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    bookingDate: { type: String, required: true, trim: true, index: true },
    startTime: { type: String, required: true, trim: true },
    endTime: { type: String, required: true, trim: true },
    startMinutes: { type: Number, required: true },
    endMinutes: { type: Number, required: true },
    durationMinutes: { type: Number, required: true, default: 60 },
    priceSnapshot: { type: Number, required: true, default: 0 },
    contactName: { type: String, default: '' },
    contactPhone: { type: String, default: '' },
    note: { type: String, default: '' },
    status: {
      type: String,
      enum: ['booked', 'cancelled_by_user', 'cancelled_by_owner'],
      default: 'booked',
      index: true,
    },
  },
  { timestamps: true },
);

courtBookingSchema.index(
  { courtId: 1, bookingDate: 1, startMinutes: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'booked' },
    name: 'unique_active_booking_slot',
  },
);

courtBookingSchema.set('toJSON', {
  transform: (_document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    ['_id', '__v'].forEach((key) => delete returnedObject[key]);

    ['courtId', 'ownerId', 'userId'].forEach((key) => {
      if (!returnedObject[key]) return;
      if (typeof returnedObject[key] === 'object' && returnedObject[key]._id) {
        returnedObject[key] = returnedObject[key]._id.toString();
      } else {
        returnedObject[key] = returnedObject[key].toString();
      }
    });
  },
});

module.exports = mongoose.model('CourtBooking', courtBookingSchema);
