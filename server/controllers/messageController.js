const Message = require("../models/Message");

// Get messages between two users
exports.getMessages = async (req, res) => {
  try {
    const { userId, otherId } = req.params;
    
    const messages = await Message.find({
      $or: [
        { senderId: userId, receiverId: otherId },
        { senderId: otherId, receiverId: userId },
      ],
    }).sort({ createdAt: 1 }); // Sort ascending to show earliest message first
    
    res.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ message: "Server error fetching messages" });
  }
};

// Get recent conversations for a user
exports.getRecentConversations = async (req, res) => {
  try {
    const { userId } = req.params;
    const mongoose = require("mongoose");
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [{ senderId: userObjectId }, { receiverId: userObjectId }],
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$senderId", userObjectId] },
              "$receiverId",
              "$senderId",
            ],
          },
          lastMessage: { $first: "$text" },
          lastMessageAt: { $first: "$createdAt" },
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
          lastMessage: 1,
          lastMessageAt: 1,
          "otherUser._id": 1,
          "otherUser.name": 1,
          "otherUser.avatar": 1,
        },
      },
      { $sort: { lastMessageAt: -1 } },
    ]);

    res.json(conversations);
  } catch (error) {
    console.error("Error fetching recent conversations:", error);
    res.status(500).json({ message: "Server error fetching conversations" });
  }
};
