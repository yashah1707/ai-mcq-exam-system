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
 * Registration validation rules
 */
const registerValidation = [
    body('name')
        .trim()
        .notEmpty().withMessage('Name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),

    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Must be a valid email address')
        .normalizeEmail(),

    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

    body('role')
        .optional()
        .isIn(['student', 'admin']).withMessage('Role must be either student or admin'),

    body('enrollmentNo')
        .notEmpty().withMessage('Enrollment number is required')
        .trim()
        .isLength({ min: 3, max: 50 }).withMessage('Enrollment number must be between 3 and 50 characters')
        .matches(/^[A-Z0-9]+$/i).withMessage('Enrollment number must contain only letters and numbers'),

    validate
];

/**
 * Login validation rules
 */
const loginValidation = [
    body('email')
        .trim()
        .notEmpty().withMessage('Enrollment number or email is required'),

    body('password')
        .notEmpty().withMessage('Password is required'),

    validate
];

/**
 * Email validation for resend verification
 */
const emailValidation = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Must be a valid email address')
        .normalizeEmail(),

    validate
];

/**
 * Password reset validation
 */
const passwordResetValidation = [
    body('token')
        .notEmpty().withMessage('Reset token is required'),

    body('newPassword')
        .notEmpty().withMessage('New password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

    validate
];

module.exports = {
    registerValidation,
    loginValidation,
    emailValidation,
    passwordResetValidation,
};
