const express = require("express");
const router = express.Router();
const messageController = require("../controllers/messageController");
// Route to get messages between the logged-in user and another user
router.get("/:userId/:otherId", messageController.getMessages);

module.exports = router;
