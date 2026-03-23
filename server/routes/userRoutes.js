const express = require('express');
const { upload } = require('../config/upload');
const userController = require('../controllers/userController');

const router = express.Router();

router.post('/:id/avatar', upload.single('avatar'), userController.uploadAvatar);
router.get('/:id', userController.getUser);
router.put('/:id', userController.updateUser);

module.exports = router;
