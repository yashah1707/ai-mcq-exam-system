const { body, validationResult } = require('express-validator');

const validateOptionsArray = (options) => {
    if (!Array.isArray(options) || options.length < 2) {
        throw new Error('Provide at least 2 options');
    }

    if (options.some(option => typeof option !== 'string' || option.trim().length === 0)) {
        throw new Error('All options must be non-empty');
    }

    return true;
};

const validateCorrectAnswerIndex = (correctAnswer, options) => {
    if (!Array.isArray(options) || !options.length) {
        return true;
    }

    const numericAnswer = Number(correctAnswer);
    if (!Number.isInteger(numericAnswer) || numericAnswer < 0 || numericAnswer >= options.length) {
        throw new Error(`Correct answer must be between 0 and ${options.length - 1}`);
    }

    return true;
};

/**
 * Middleware to check validation results
 */
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        const errorMessages = errors.array().map(err => err.msg).join(', ');
        return next(new Error(errorMessages));
    }
    next();
};

/**
 * Create question validation rules
 */
const createQuestionValidation = [
    body('questionText')
        .trim()
        .notEmpty().withMessage('Question text is required')
        .isLength({ min: 10, max: 1000 }).withMessage('Question text must be between 10 and 1000 characters'),

    body('options')
        .custom(validateOptionsArray),

    body('correctAnswer')
        .notEmpty().withMessage('Correct answer is required')
        .isInt({ min: 0 }).withMessage('Correct answer must be a non-negative integer')
        .custom((value, { req }) => validateCorrectAnswerIndex(value, req.body.options)),

    body('category')
        .notEmpty().withMessage('Category is required')
        .isIn(['Aptitude', 'Logical', 'Technical']).withMessage('Category must be Aptitude, Logical, or Technical'),

    body('difficulty')
        .notEmpty().withMessage('Difficulty is required')
        .isIn(['Easy', 'Medium', 'Hard']).withMessage('Difficulty must be Easy, Medium, or Hard'),

    body('subject')
        .trim()
        .notEmpty().withMessage('Subject is required'),

    body('topic')
        .trim()
        .notEmpty().withMessage('Topic is required')
        .isLength({ min: 2, max: 100 }).withMessage('Topic must be between 2 and 100 characters'),

    body('year')
        .optional()
        .isInt({ min: 1, max: 4 }).withMessage('Year must be between 1 and 4'),

    body('course')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ min: 2, max: 20 }).withMessage('Course must be between 2 and 20 characters'),

    body('marks')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Marks must be between 1 and 100'),

    body('negativeMarks')
        .optional()
        .isFloat({ min: 0, max: 100 }).withMessage('Negative marks must be between 0 and 100'),

    body('questionImageUrl')
        .optional({ values: 'falsy' })
        .trim()
        .isURL().withMessage('Question image must be a valid URL'),

    body('questionImagePublicId')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ max: 200 }).withMessage('Question image identifier is too long'),

    body('explanation')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Explanation must not exceed 500 characters'),

    validate
];

/**
 * Update question validation rules
 */
const updateQuestionValidation = [
    body('questionText')
        .optional()
        .trim()
        .isLength({ min: 10, max: 1000 }).withMessage('Question text must be between 10 and 1000 characters'),

    body('options')
        .optional()
        .custom(validateOptionsArray),

    body('correctAnswer')
        .optional()
        .isInt({ min: 0 }).withMessage('Correct answer must be a non-negative integer')
        .custom((value, { req }) => validateCorrectAnswerIndex(value, req.body.options)),

    body('category')
        .optional()
        .isIn(['Aptitude', 'Logical', 'Technical']).withMessage('Category must be Aptitude, Logical, or Technical'),

    body('difficulty')
        .optional()
        .isIn(['Easy', 'Medium', 'Hard']).withMessage('Difficulty must be Easy, Medium, or Hard'),

    body('subject')
        .optional()
        .trim()
        .notEmpty().withMessage('Subject is required'),

    body('topic')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 }).withMessage('Topic must be between 2 and 100 characters'),

    body('year')
        .optional()
        .isInt({ min: 1, max: 4 }).withMessage('Year must be between 1 and 4'),

    body('course')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ min: 2, max: 20 }).withMessage('Course must be between 2 and 20 characters'),

    body('marks')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Marks must be between 1 and 100'),

    body('negativeMarks')
        .optional()
        .isFloat({ min: 0, max: 100 }).withMessage('Negative marks must be between 0 and 100'),

    body('questionImageUrl')
        .optional({ values: 'falsy' })
        .trim()
        .isURL().withMessage('Question image must be a valid URL'),

    body('questionImagePublicId')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ max: 200 }).withMessage('Question image identifier is too long'),

    body('explanation')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Explanation must not exceed 500 characters'),

    validate
];

/**
 * Bulk create questions validation
 */
const bulkCreateQuestionsValidation = [
    body()
        .isArray({ min: 1 }).withMessage('Request body must be a non-empty array of questions'),

    body('*.questionText')
        .trim()
        .notEmpty().withMessage('Each question must have question text')
        .isLength({ min: 10, max: 1000 }).withMessage('Question text must be between 10 and 1000 characters'),

    body('*.options')
        .custom(validateOptionsArray),

    body('*.correctAnswer')
        .notEmpty().withMessage('Each question must have a correct answer')
        .isInt({ min: 0 }).withMessage('Correct answer must be a non-negative integer'),

    body('*.category')
        .notEmpty().withMessage('Each question must have a category')
        .isIn(['Aptitude', 'Logical', 'Technical']).withMessage('Category must be Aptitude, Logical, or Technical'),

    body('*.difficulty')
        .notEmpty().withMessage('Each question must have a difficulty')
        .isIn(['Easy', 'Medium', 'Hard']).withMessage('Difficulty must be Easy, Medium, or Hard'),

    body('*.subject')
        .trim()
        .notEmpty().withMessage('Each question must have a subject'),

    body('*.topic')
        .trim()
        .notEmpty().withMessage('Each question must have a topic')
        .isLength({ min: 2, max: 100 }).withMessage('Topic must be between 2 and 100 characters'),

    body('*.year')
        .optional()
        .isInt({ min: 1, max: 4 }).withMessage('Year must be between 1 and 4'),

    body('*.course')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ min: 2, max: 20 }).withMessage('Course must be between 2 and 20 characters'),

    body()
        .custom((questions) => {
            questions.forEach((question, index) => {
                try {
                    validateCorrectAnswerIndex(question.correctAnswer, question.options);
                } catch (error) {
                    throw new Error(`Question ${index + 1}: ${error.message}`);
                }

                if (question.marks !== undefined && (!Number.isInteger(Number(question.marks)) || Number(question.marks) < 1 || Number(question.marks) > 100)) {
                    throw new Error(`Question ${index + 1}: marks must be between 1 and 100`);
                }

                if (question.questionImageUrl !== undefined && question.questionImageUrl !== '' && !/^https?:\/\//i.test(String(question.questionImageUrl))) {
                    throw new Error(`Question ${index + 1}: question image must be a valid URL`);
                }
            });

            return true;
        }),

    validate
];

module.exports = {
    createQuestionValidation,
    updateQuestionValidation,
    bulkCreateQuestionsValidation,
};
