const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isBanned: { type: Boolean, default: false },
    name: { type: String },
    age: { type: Number },
    location: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
    bio: { type: String },
    email: { type: String, required: true, unique: true },
    phone: { type: String },
    avatar: { type: String },
    stats: {
      matchesPlayed: { type: Number, default: 0 },
      matchesWon: { type: Number, default: 0 },
      winRate: { type: Number, default: 0 },
      hoursActive: { type: Number, default: 0 },
      followers: { type: Number, default: 0 },
    },
    sports: [
      {
        name: { type: String, required: true },
        level: { type: String, required: true },
      },
    ],
    schedule: [
      {
        day: { type: String, required: true },
        time: { type: String },
        activity: { type: String, required: true },
      },
    ],
  },
  { timestamps: true },
);

userSchema.set('toJSON', {
  transform: (_document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
    delete returnedObject.password;
  },
});

module.exports = mongoose.model('User', userSchema);
