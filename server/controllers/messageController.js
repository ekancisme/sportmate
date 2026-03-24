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
