const express = require('express');
const { startExam, saveAnswer, submitExam, getAttempt, getAttemptHistory } = require('../controllers/examAttempt.controller');
const { verifyToken } = require('../middleware/auth');
const { startExamValidation, saveAnswerValidation } = require('../middleware/validators/exam.validator');

const router = express.Router();

router.use(verifyToken);
router.post('/start', startExamValidation, startExam);
router.put('/:attemptId/answer', saveAnswerValidation, saveAnswer);
router.post('/:attemptId/submit', submitExam);
router.get('/:attemptId', getAttempt);
router.get('/history/list', getAttemptHistory);

module.exports = router;
