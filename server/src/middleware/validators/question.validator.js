const { body, validationResult } = require('express-validator');

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
        .isArray({ min: 4, max: 4 }).withMessage('Must provide exactly 4 options')
        .custom((options) => {
            if (options.some(opt => !opt || opt.trim().length === 0)) {
                throw new Error('All options must be non-empty');
            }
            return true;
        }),

    body('correctAnswer')
        .notEmpty().withMessage('Correct answer is required')
        .isInt({ min: 0, max: 3 }).withMessage('Correct answer must be between 0 and 3'),

    body('category')
        .notEmpty().withMessage('Category is required')
        .isIn(['Aptitude', 'Logical', 'Technical']).withMessage('Category must be Aptitude, Logical, or Technical'),

    body('difficulty')
        .notEmpty().withMessage('Difficulty is required')
        .isIn(['Easy', 'Medium', 'Hard']).withMessage('Difficulty must be Easy, Medium, or Hard'),

    body('marks')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Marks must be between 1 and 100'),

    body('negativeMarks')
        .optional()
        .isFloat({ min: 0, max: 100 }).withMessage('Negative marks must be between 0 and 100'),

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
        .isArray({ min: 4, max: 4 }).withMessage('Must provide exactly 4 options')
        .custom((options) => {
            if (options && options.some(opt => !opt || opt.trim().length === 0)) {
                throw new Error('All options must be non-empty');
            }
            return true;
        }),

    body('correctAnswer')
        .optional()
        .isInt({ min: 0, max: 3 }).withMessage('Correct answer must be between 0 and 3'),

    body('category')
        .optional()
        .isIn(['Aptitude', 'Logical', 'Technical']).withMessage('Category must be Aptitude, Logical, or Technical'),

    body('difficulty')
        .optional()
        .isIn(['Easy', 'Medium', 'Hard']).withMessage('Difficulty must be Easy, Medium, or Hard'),

    body('marks')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Marks must be between 1 and 100'),

    body('negativeMarks')
        .optional()
        .isFloat({ min: 0, max: 100 }).withMessage('Negative marks must be between 0 and 100'),

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
        .isArray({ min: 4, max: 4 }).withMessage('Each question must have exactly 4 options'),

    body('*.correctAnswer')
        .notEmpty().withMessage('Each question must have a correct answer')
        .isInt({ min: 0, max: 3 }).withMessage('Correct answer must be between 0 and 3'),

    body('*.category')
        .notEmpty().withMessage('Each question must have a category')
        .isIn(['Aptitude', 'Logical', 'Technical']).withMessage('Category must be Aptitude, Logical, or Technical'),

    body('*.difficulty')
        .notEmpty().withMessage('Each question must have a difficulty')
        .isIn(['Easy', 'Medium', 'Hard']).withMessage('Difficulty must be Easy, Medium, or Hard'),

    validate
];

module.exports = {
    createQuestionValidation,
    updateQuestionValidation,
    bulkCreateQuestionsValidation,
};
