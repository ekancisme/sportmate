const express = require('express');

const { courtUpload } = require('../config/upload');
const courtBookingController = require('../controllers/courtBookingController');
const courtController = require('../controllers/courtController');

const router = express.Router();

router.get('/', courtController.listCourts);
router.get('/mine', courtController.listMine);
router.get('/:id/availability', courtBookingController.getAvailability);
router.get('/:id/bookings', courtBookingController.listCourtBookings);
router.get('/:id', courtController.getCourt);
router.post('/', courtController.createCourt);
router.post('/:id/bookings', courtBookingController.createBooking);
router.post('/:id/images', courtUpload.array('images', 8), courtController.uploadCourtImages);
router.patch('/:id', courtController.patchCourt);
router.delete('/:id', courtController.deleteCourt);

module.exports = router;
