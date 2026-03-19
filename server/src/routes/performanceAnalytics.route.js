const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const {
    getStudentAnalytics,
    getWeakTopics,
    getPlacementReadiness,
    getAIInsights,
    getSubjectProficiency,
    getStudentReportOverall,
    getStudentReportSubjectHistory,
} = require('../controllers/performanceAnalytics.controller');

router.get('/student/:userId', verifyToken, getStudentAnalytics);
router.get('/student/:userId/weak-topics', verifyToken, getWeakTopics);
router.get('/student/:userId/readiness', verifyToken, getPlacementReadiness);
router.get('/student/:userId/ai-insights', verifyToken, getAIInsights);
router.get('/student/:userId/subject-proficiency', verifyToken, getSubjectProficiency);
router.get('/student/:userId/report/overall', verifyToken, getStudentReportOverall);
router.get('/student/:userId/report/subject-history', verifyToken, getStudentReportSubjectHistory);

module.exports = router;
