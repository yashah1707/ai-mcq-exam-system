const express = require('express');
const { getUsers, updateUserRole, toggleUserStatus } = require('../controllers/user.controller');
const { verifyToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Admin-only user management
router.use(verifyToken, authorizeRoles('admin'));
router.get('/', getUsers);
router.put('/:id/role', updateUserRole);
router.put('/:id/status', toggleUserStatus);

module.exports = router;
