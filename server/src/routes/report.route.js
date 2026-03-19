const express = require('express');
const {
	getStudentPerformance,
	getExamStatistics,
	getSubjectStudentsReport,
	getStudentSubjectHistory,
	getStudentOverall,
} = require('../controllers/report.controller');
const { verifyToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken, authorizeRoles('admin'));
router.get('/student-performance', getStudentPerformance);
router.get('/exam-statistics', getExamStatistics);
router.get('/subject-students', getSubjectStudentsReport);
router.get('/student/:userId/subject-history', getStudentSubjectHistory);
router.get('/student/:userId/overall', getStudentOverall);

module.exports = router;
