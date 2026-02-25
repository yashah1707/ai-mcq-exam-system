const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const {
    getStudentAnalytics,
    getWeakTopics,
    getPlacementReadiness,
    getAIInsights
} = require('../controllers/performanceAnalytics.controller');

router.get('/student/:userId', verifyToken, getStudentAnalytics);
router.get('/student/:userId/weak-topics', verifyToken, getWeakTopics);
router.get('/student/:userId/readiness', verifyToken, getPlacementReadiness);
router.get('/student/:userId/ai-insights', verifyToken, getAIInsights);

module.exports = router;
