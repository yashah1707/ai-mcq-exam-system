const express = require('express');
const { createUser, bulkCreateUsers, getUsers, updateUserRole, updateUserDetails, toggleUserStatus, sendUserPasswordLink, deleteUser } = require('../controllers/user.controller');
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const { registerValidation } = require('../middleware/validators/auth.validator');
const { bulkCreateUsersValidation } = require('../middleware/validators/user.validator');
const { adminEmailActionRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// Admin-only user management
router.use(verifyToken, authorizeRoles('admin'));
router.post('/', registerValidation, createUser);
router.post('/bulk', bulkCreateUsersValidation, bulkCreateUsers);
router.get('/', getUsers);
router.post('/:id/send-password-link', adminEmailActionRateLimiter, sendUserPasswordLink);
router.put('/:id', updateUserDetails);
router.put('/:id/role', updateUserRole);
router.put('/:id/status', toggleUserStatus);
router.delete('/:id', deleteUser);

module.exports = router;
