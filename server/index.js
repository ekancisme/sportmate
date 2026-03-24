require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { setupUploadStatic } = require("./config/upload");
const adminRoutes = require("./routes/adminRoutes");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const matchRoutes = require("./routes/matchRoutes");
const partnerRoutes = require("./routes/partnerRoutes");
const courtRoutes = require("./routes/courtRoutes");
const venueRoutes = require("./routes/venueRoutes");
const messageRoutes = require("./routes/messageRoutes");
const http = require("http");
const { Server } = require("socket.io");
const Message = require("./models/Message");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const PORT = process.env.PORT || 3000;

const MONGODB_URI = (process.env.MONGODB_URI || "").trim();
if (!MONGODB_URI) {
  console.error(
    "❌ Thiếu MONGODB_URI trong server/.env. Ví dụ: MONGODB_URI=mongodb://host:27017/sportmate",
  );
  process.exit(1);
}

app.use(cors());
app.use(express.json());

app.use((req, _res, next) => {
  const now = new Date().toISOString();
  console.log(
    `[${now}] ${req.method} ${req.url} - from ${req.ip || "unknown"}`,
  );
  next();
});

setupUploadStatic(app);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/courts", courtRoutes);
app.use("/api/partners", partnerRoutes);
app.use("/api/users", userRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/venues", venueRoutes);
app.use("/api/messages", messageRoutes);

// Socket.IO logic
io.on("connection", (socket) => {
  console.log(`User connected to socket: ${socket.id}`);

  // User joins their own personal room
  socket.on("join_room", (userId) => {
    socket.join(userId);
    console.log(`User with ID ${userId} joined their room`);
  });

  // Handle sending a message
  socket.on("send_message", async (data) => {
    try {
      const { senderId, receiverId, text } = data;
      
      // Save message to database
      const newMessage = new Message({
        senderId,
        receiverId,
        text,
      });
      await newMessage.save();

      // Emit to receiver's room
      io.to(receiverId).emit("receive_message", newMessage);
      // Emit back to sender's room to confirm sending
      io.to(senderId).emit("receive_message", newMessage);
      
    } catch (err) {
      console.error("Socket send_message error:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Đã kết nối MongoDB (MONGODB_URI từ .env)");
  } catch (err) {
    console.error("❌ Không kết nối được MongoDB:", err?.message || err);
    process.exit(1);
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server: http://0.0.0.0:${PORT}`);
    console.log(`💬 Socket.IO is ready for connections`);
  });
}

start();
