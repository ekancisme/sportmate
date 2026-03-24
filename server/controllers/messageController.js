const mongoose = require("mongoose");
const Message = require("../models/Message");

/**
 * Serialize a Message document to a safe plain object for API/socket responses.
 * - Decrypts the `text` field
 * - Converts ObjectId fields to strings
 */
function serializeMessage(msg) {
  return {
    _id: msg._id.toString(),
    senderId: msg.senderId.toString(),
    receiverId: msg.receiverId.toString(),
    text: msg.decryptedText(),
    createdAt: msg.createdAt instanceof Date
      ? msg.createdAt.toISOString()
      : msg.createdAt,
    updatedAt: msg.updatedAt instanceof Date
      ? msg.updatedAt.toISOString()
      : msg.updatedAt,
  };
}

// ─── Get messages between two users ──────────────────────────────────────────
exports.getMessages = async (req, res) => {
  try {
    const { userId, otherId } = req.params;

    const messages = await Message.find({
      $or: [
        { senderId: userId, receiverId: otherId },
        { senderId: otherId, receiverId: userId },
      ],
    })
      // Sort by createdAt ascending, with _id as tiebreaker (ObjectId is monotonically increasing)
      // This guarantees deterministic ordering even when two messages share the same millisecond
      .sort({ createdAt: 1, _id: 1 });

    res.json(messages.map(serializeMessage));
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ message: "Server error fetching messages" });
  }
};

// ─── Get recent conversations for a user ──────────────────────────────────────
exports.getRecentConversations = async (req, res) => {
  try {
    const { userId } = req.params;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [{ senderId: userObjectId }, { receiverId: userObjectId }],
        },
      },
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$senderId", userObjectId] },
              "$receiverId",
              "$senderId",
            ],
          },
          lastEncryptedText: { $first: "$text" },
          lastMessageAt: { $first: "$createdAt" },
          lastMessageId: { $first: "$_id" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "otherUser",
        },
      },
      { $unwind: "$otherUser" },
      {
        $project: {
          _id: 1,
          lastEncryptedText: 1,
          lastMessageAt: 1,
          lastMessageId: 1,
          "otherUser._id": 1,
          "otherUser.name": 1,
          "otherUser.avatar": 1,
        },
      },
      { $sort: { lastMessageAt: -1 } },
    ]);

    // Decrypt lastMessage for each conversation
    const { decrypt } = require("../utils/encryption");
    const result = conversations.map((conv) => {
      let lastMessage = "";
      try {
        const parts = (conv.lastEncryptedText || "").split(":");
        lastMessage =
          parts.length === 3
            ? decrypt(conv.lastEncryptedText) ?? "..."
            : conv.lastEncryptedText ?? "";
      } catch {
        lastMessage = "...";
      }
      return {
        _id: conv._id.toString(),
        lastMessage,
        lastMessageAt: conv.lastMessageAt,
        otherUser: {
          _id: conv.otherUser._id.toString(),
          name: conv.otherUser.name,
          avatar: conv.otherUser.avatar,
        },
      };
    });

    res.json(result);
  } catch (error) {
    console.error("Error fetching recent conversations:", error);
    res.status(500).json({ message: "Server error fetching conversations" });
  }
};

module.exports.serializeMessage = serializeMessage;
