const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const {
    startAdaptiveTest,
    submitAdaptiveAnswer,
    endAdaptiveTest,
    getAttemptAnalysis
} = require('../controllers/adaptiveTest.controller');

router.post('/start', verifyToken, startAdaptiveTest);
router.post('/submit', verifyToken, submitAdaptiveAnswer);
router.post('/end', verifyToken, endAdaptiveTest);
router.get('/attempt/:attemptId', verifyToken, getAttemptAnalysis);

module.exports = router;
