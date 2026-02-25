const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, changePassword } = require('../controllers/profile.controller');
const { verifyToken } = require('../middleware/auth');
const { updateProfileValidation, changePasswordValidation } = require('../middleware/validators/profile.validator');

// All routes require authentication
router.use(verifyToken);

// @route   GET /api/profile
// @desc    Get current user profile
// @access  Private
router.get('/', getProfile);

// @route   PUT /api/profile
// @desc    Update user profile
// @access  Private
router.put('/', updateProfileValidation, updateProfile);

// @route   PUT /api/profile/password
// @desc    Change password
// @access  Private
router.put('/password', changePasswordValidation, changePassword);

module.exports = router;
