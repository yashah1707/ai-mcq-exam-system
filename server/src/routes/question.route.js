const express = require('express');
const { createQuestion, getQuestions, getquestionById, updateQuestion, deleteQuestion, bulkCreateQuestions } = require('../controllers/question.controller');
const { uploadQuestionImage, deleteQuestionImage } = require('../controllers/upload.controller');
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const { questionImageUpload } = require('../middleware/upload');
const { createQuestionValidation, updateQuestionValidation, bulkCreateQuestionsValidation } = require('../middleware/validators/question.validator');

const router = express.Router();

// Public: get questions (student view)
router.get('/', getQuestions);
router.get('/:id', getquestionById);

// Admin-only: create, update, delete
router.use(verifyToken, authorizeRoles('admin'));
router.post('/upload-image', questionImageUpload.single('image'), uploadQuestionImage);
router.post('/delete-image', deleteQuestionImage);
router.post('/', createQuestionValidation, createQuestion);
router.post('/bulk', bulkCreateQuestionsValidation, bulkCreateQuestions);
router.put('/:id', updateQuestionValidation, updateQuestion);
router.delete('/:id', deleteQuestion);

module.exports = router;
