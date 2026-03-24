const express = require('express');

const courtBookingController = require('../controllers/courtBookingController');

const router = express.Router();

router.patch('/:id/cancel', courtBookingController.cancelBooking);

module.exports = router;
