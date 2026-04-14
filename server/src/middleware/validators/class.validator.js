const { body, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400);
    const errorMessages = errors.array().map((error) => error.msg).join(', ');
    return next(new Error(errorMessages));
  }

  return next();
};

const bulkCreateClassesValidation = [
  body()
    .isArray({ min: 1, max: 200 })
    .withMessage('Request body must be a non-empty array of up to 200 classes'),

  body('*.name')
    .trim()
    .notEmpty()
    .withMessage('Each class must have a name'),

  body('*.year')
    .optional()
    .isInt({ min: 1, max: 4 })
    .withMessage('Each class year must be between 1 and 4'),

  body('*.course')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 2, max: 20 })
    .withMessage('Each class course must be between 2 and 20 characters'),

  body('*.capacity')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Each class capacity must be a positive integer'),

  body('*.description')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 200 })
    .withMessage('Each class description must not exceed 200 characters'),

  validate,
];

const bulkAssignStudentsToClassValidation = [
  body()
    .isArray({ min: 1, max: 500 })
    .withMessage('Request body must be a non-empty array of up to 500 student assignments'),

  body('*.enrollmentNo')
    .optional({ nullable: true })
    .custom((value) => value === undefined || value === null || typeof value === 'string')
    .withMessage('Each enrollment number must be a string'),

  body('*.labBatch')
    .optional({ nullable: true })
    .custom((value) => value === undefined || value === null || typeof value === 'string')
    .withMessage('Each lab batch name must be a string'),

  validate,
];

module.exports = {
  bulkAssignStudentsToClassValidation,
  bulkCreateClassesValidation,
};