const express = require('express');
const { createExam, getExams, getExamById, updateExam, deleteExam } = require('../controllers/exam.controller');
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const { createExamValidation, updateExamValidation } = require('../middleware/validators/exam.validator');

const router = express.Router();

// Public: get exams (student view)
router.get('/', getExams);
router.get('/:id', getExamById);

// Admin-only: create, update, delete
router.use(verifyToken, authorizeRoles('admin'));
router.post('/', createExamValidation, createExam);
router.put('/:id', updateExamValidation, updateExam);
router.delete('/:id', deleteExam);

module.exports = router;
