const { body, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400);
    const errorMessages = errors.array().map((error) => error.msg).join(', ');
    return next(new Error(errorMessages));
  }
  next();
};

const bulkCreateUsersValidation = [
  body('users')
    .isArray({ min: 1 }).withMessage('Users must be a non-empty array'),

  body('temporaryPassword')
    .trim()
    .notEmpty().withMessage('Temporary password is required for bulk import')
    .isLength({ min: 6 }).withMessage('Temporary password must be at least 6 characters long'),

  body('sendInvite')
    .optional()
    .isBoolean().withMessage('Send invite must be true or false'),

  body('users.*.firstName')
    .trim()
    .notEmpty().withMessage('Each user must include a first name')
    .isLength({ min: 2, max: 50 }).withMessage('Each first name must be between 2 and 50 characters'),

  body('users.*.lastName')
    .trim()
    .notEmpty().withMessage('Each user must include a last name')
    .isLength({ min: 2, max: 50 }).withMessage('Each last name must be between 2 and 50 characters'),

  body('users.*.email')
    .trim()
    .notEmpty().withMessage('Each user must include an email')
    .isEmail().withMessage('Each email must be valid')
    .normalizeEmail(),

  body('users.*.role')
    .optional()
    .isIn(['student', 'teacher', 'admin']).withMessage('Each role must be student, teacher, or admin'),

  body('users.*.employeeId')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('Each employee ID must be between 2 and 50 characters')
    .matches(/^[A-Z0-9-]+$/i).withMessage('Each employee ID must contain only letters, numbers, and hyphens'),

  body('users.*.adminId')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 3, max: 50 }).withMessage('Each admin ID must be between 3 and 50 characters')
    .matches(/^[A-Z0-9-]+$/i).withMessage('Each admin ID must contain only letters, numbers, and hyphens'),

  body('users.*.department')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Each department must be between 2 and 100 characters'),

  body('users.*.subjects')
    .optional()
    .isArray().withMessage('Each subjects value must be an array'),

  body('users.*.subjects.*')
    .optional()
    .isString().withMessage('Each subject must be valid'),

  body(['users.*.batch', 'users.*.class'])
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 1, max: 100 }).withMessage('Each class must be between 1 and 100 characters'),

  body('users.*.assignedBatches')
    .optional()
    .isArray().withMessage('Each assignedBatches value must be an array'),

  body('users.*.assignedBatches.*')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 1, max: 100 }).withMessage('Each assigned class must be between 1 and 100 characters'),

  body('users.*.assignedLabBatches')
    .optional()
    .isArray().withMessage('Each assignedLabBatches value must be an array'),

  body('users.*.assignedLabBatches.*.className')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 1, max: 100 }).withMessage('Each assigned lab batch class must be between 1 and 100 characters'),

  body('users.*.assignedLabBatches.*.labBatchName')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 1, max: 100 }).withMessage('Each assigned lab batch name must be between 1 and 100 characters'),

  body('users.*.enrollmentNo')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 3, max: 50 }).withMessage('Each enrollment number must be between 3 and 50 characters')
    .matches(/^[A-Z0-9]+$/i).withMessage('Each enrollment number must contain only letters and numbers'),

  body().custom((_, { req }) => {
    const invalidTeacherEmployeeIdRow = (req.body.users || []).find((user) => user?.role === 'teacher' && !String(user.employeeId || '').trim());
    if (invalidTeacherEmployeeIdRow) {
      throw new Error('Each teacher row must include an employee ID');
    }
    return true;
  }),

  body().custom((_, { req }) => {
    const invalidAdminRow = (req.body.users || []).find((user) => user?.role === 'admin' && !String(user.adminId || '').trim());
    if (invalidAdminRow) {
      throw new Error('Each admin row must include an admin ID');
    }
    return true;
  }),

  validate,
];

module.exports = {
  bulkCreateUsersValidation,
};