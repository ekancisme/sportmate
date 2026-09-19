const express = require('express');

const venueController = require('../controllers/venueController');

const router = express.Router();

// Người dùng gửi yêu cầu đăng ký sân để app collab/cho thuê
router.post('/', venueController.requestVenue);

module.exports = router;

