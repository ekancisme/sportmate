const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// Index for fast query of messages between two users ordered by time
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: 1 });
// Index for listing all conversations involving a user
messageSchema.index({ receiverId: 1, createdAt: -1 });

module.exports = mongoose.model("Message", messageSchema);

