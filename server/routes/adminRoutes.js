const express = require('express');

const adminController = require('../controllers/adminController');

const router = express.Router();

router.get('/stats', adminController.getStats);
router.get('/users', adminController.listUsers);
router.patch('/users/:id', adminController.updateUserRole);
router.patch('/users/:id/ban', adminController.updateUserBan);

router.get('/venues', adminController.listVenues);
router.get('/venues/pending', adminController.listPendingVenues);
router.post('/venues', adminController.createVenue);
router.patch('/venues/:id', adminController.updateVenue);
router.patch('/venues/:id/approve', adminController.approveVenue);
router.patch('/venues/:id/reject', adminController.rejectVenue);

router.patch('/matches/:id', adminController.patchAdminMatch);

module.exports = router;

