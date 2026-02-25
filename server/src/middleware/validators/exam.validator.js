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
 * Create exam validation rules
 */
const createExamValidation = [
    body('title')
        .trim()
        .notEmpty().withMessage('Exam title is required')
        .isLength({ min: 5, max: 200 }).withMessage('Title must be between 5 and 200 characters'),

    body('description')
        .optional()
        .trim()
        .isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters'),

    body('duration')
        .notEmpty().withMessage('Duration is required')
        .isInt({ min: 1, max: 300 }).withMessage('Duration must be between 1 and 300 minutes'),

    body('totalMarks')
        .notEmpty().withMessage('Total marks is required')
        .isInt({ min: 1 }).withMessage('Total marks must be a positive integer'),

    body('passingMarks')
        .notEmpty().withMessage('Passing marks is required')
        .isInt({ min: 0 }).withMessage('Passing marks must be a non-negative integer')
        .custom((value, { req }) => {
            if (value > req.body.totalMarks) {
                throw new Error('Passing marks cannot exceed total marks');
            }
            return true;
        }),

    body('questions')
        .isArray({ min: 1 }).withMessage('At least one question must be assigned to the exam'),

    body('startDate')
        .notEmpty().withMessage('Start date is required')
        .isISO8601().withMessage('Start date must be a valid date'),

    body('endDate')
        .notEmpty().withMessage('End date is required')
        .isISO8601().withMessage('End date must be a valid date')
        .custom((value, { req }) => {
            if (new Date(value) <= new Date(req.body.startDate)) {
                throw new Error('End date must be after start date');
            }
            return true;
        }),

    body('isActive')
        .optional()
        .isBoolean().withMessage('isActive must be a boolean'),

    validate
];

/**
 * Update exam validation rules
 */
const updateExamValidation = [
    body('title')
        .optional()
        .trim()
        .isLength({ min: 5, max: 200 }).withMessage('Title must be between 5 and 200 characters'),

    body('description')
        .optional()
        .trim()
        .isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters'),

    body('duration')
        .optional()
        .isInt({ min: 1, max: 300 }).withMessage('Duration must be between 1 and 300 minutes'),

    body('totalMarks')
        .optional()
        .isInt({ min: 1 }).withMessage('Total marks must be a positive integer'),

    body('passingMarks')
        .optional()
        .isInt({ min: 0 }).withMessage('Passing marks must be a non-negative integer'),

    body('questions')
        .optional()
        .isArray({ min: 1 }).withMessage('At least one question must be assigned to the exam'),

    body('startDate')
        .optional()
        .isISO8601().withMessage('Start date must be a valid date'),

    body('endDate')
        .optional()
        .isISO8601().withMessage('End date must be a valid date'),

    body('isActive')
        .optional()
        .isBoolean().withMessage('isActive must be a boolean'),

    validate
];

/**
 * Start exam validation
 */
const startExamValidation = [
    body('examId')
        .notEmpty().withMessage('Exam ID is required')
        .isMongoId().withMessage('Exam ID must be a valid MongoDB ID'),

    validate
];

/**
 * Save answer validation
 */
const saveAnswerValidation = [
    body('questionId')
        .notEmpty().withMessage('Question ID is required')
        .isMongoId().withMessage('Question ID must be a valid MongoDB ID'),

    body('selectedOption')
        .isInt({ min: 0, max: 3 }).withMessage('Selected option must be between 0 and 3')
        .optional({ nullable: true }),

    validate
];

module.exports = {
    createExamValidation,
    updateExamValidation,
    startExamValidation,
    saveAnswerValidation,
};
