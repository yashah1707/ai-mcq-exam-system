const express = require('express');
const router = express.Router();
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const {
    getBatchOverview,
    getSubjectPerformance,
    getWeaknessHeatmap,
    getReadinessDistribution
} = require('../controllers/batchAnalytics.controller');

// All routes require Admin role
router.get('/overview', verifyToken, authorizeRoles('admin'), getBatchOverview);
router.get('/subject-performance', verifyToken, authorizeRoles('admin'), getSubjectPerformance);
router.get('/weakness-heatmap', verifyToken, authorizeRoles('admin'), getWeaknessHeatmap);
router.get('/readiness-distribution', verifyToken, authorizeRoles('admin'), getReadinessDistribution);

module.exports = router;
