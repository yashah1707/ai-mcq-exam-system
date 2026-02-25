const express = require('express');
const { getStudentPerformance, getExamStatistics } = require('../controllers/report.controller');
const { verifyToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken, authorizeRoles('admin'));
router.get('/student-performance', getStudentPerformance);
router.get('/exam-statistics', getExamStatistics);

module.exports = router;
