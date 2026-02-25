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
 * Update profile validation
 */
const updateProfileValidation = [
    body('firstName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters'),

    body('lastName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters'),

    body('email')
        .optional()
        .trim()
        .isEmail().withMessage('Must be a valid email address')
        .normalizeEmail(),

    validate
];

/**
 * Change password validation
 */
const changePasswordValidation = [
    body('oldPassword')
        .notEmpty().withMessage('Current password is required'),

    body('newPassword')
        .notEmpty().withMessage('New password is required')
        .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
        .matches(/[a-z]/).withMessage('New password must contain at least one lowercase letter')
        .matches(/[A-Z]/).withMessage('New password must contain at least one uppercase letter')
        .matches(/[0-9]/).withMessage('New password must contain at least one number')
        .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('New password must contain at least one special character'),

    validate
];

module.exports = {
    updateProfileValidation,
    changePasswordValidation
};
