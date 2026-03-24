const mongoose = require("mongoose");
const { encrypt, decrypt } = require("../utils/encryption");

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
    // Stored as encrypted ciphertext: "<iv>:<authTag>:<ciphertext>" (hex)
    text: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    // Allow virtuals to be included when converting to JSON/Object
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes for performance ────────────────────────────────────────────────
// Compound index: fast query of messages between two users ordered by time
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: 1, _id: 1 });
// Index for listing all conversations involving a user
messageSchema.index({ receiverId: 1, createdAt: -1 });

// ── Encrypt before saving ──────────────────────────────────────────────────
messageSchema.pre("save", function (next) {
  // Only encrypt if the text field was modified and is not already encrypted
  // Encrypted strings contain ":" separators (iv:authTag:ciphertext)
  // We check by counting colons — a valid encrypted string has exactly 2
  if (this.isModified("text") && this.text.split(":").length !== 3) {
    this.text = encrypt(this.text);
  }
  next();
});

// ── Helper method: decrypt the stored text ────────────────────────────────
messageSchema.methods.decryptedText = function () {
  const parts = this.text ? this.text.split(":") : [];
  if (parts.length === 3) {
    return decrypt(this.text) ?? "[Không thể giải mã]";
  }
  // Fallback: not encrypted (legacy data)
  return this.text;
};

module.exports = mongoose.model("Message", messageSchema);
