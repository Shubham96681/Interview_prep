const { body, param, query, validationResult } = require('express-validator');

// Validation result handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// User registration validation
const validateRegistration = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  body('role')
    .isIn(['candidate', 'expert'])
    .withMessage('Role must be either candidate or expert'),
  handleValidationErrors
];

// User login validation
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

// Profile update validation
const validateProfileUpdate = [
  body('profile.bio')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Bio must be less than 500 characters'),
  body('profile.experience')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Experience must be less than 200 characters'),
  body('profile.skills')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Cannot have more than 20 skills'),
  body('profile.hourlyRate')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Hourly rate must be a positive number'),
  handleValidationErrors
];

// Session booking validation
const validateSessionBooking = [
  body('expertId')
    .isMongoId()
    .withMessage('Valid expert ID is required'),
  body('title')
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Title must be between 5 and 100 characters'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters'),
  body('scheduledDate')
    .isISO8601()
    .withMessage('Valid scheduled date is required')
    .custom((value) => {
      const scheduledDate = new Date(value);
      const now = new Date();
      if (scheduledDate <= now) {
        throw new Error('Scheduled date must be in the future');
      }
      return true;
    }),
  body('duration')
    .isInt({ min: 15, max: 480 })
    .withMessage('Duration must be between 15 and 480 minutes'),
  body('sessionType')
    .isIn(['mock-interview', 'resume-review', 'career-guidance', 'skill-assessment', 'other'])
    .withMessage('Invalid session type'),
  handleValidationErrors
];

// Review validation
const validateReview = [
  body('sessionId')
    .isMongoId()
    .withMessage('Valid session ID is required'),
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('comment')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Comment must be between 10 and 1000 characters'),
  body('categories.professionalism')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Professionalism rating must be between 1 and 5'),
  body('categories.communication')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Communication rating must be between 1 and 5'),
  body('categories.expertise')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Expertise rating must be between 1 and 5'),
  body('categories.punctuality')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Punctuality rating must be between 1 and 5'),
  body('categories.helpfulness')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Helpfulness rating must be between 1 and 5'),
  handleValidationErrors
];

// MongoDB ObjectId validation
const validateObjectId = (paramName) => [
  param(paramName)
    .isMongoId()
    .withMessage(`Valid ${paramName} is required`),
  handleValidationErrors
];

// Pagination validation
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateRegistration,
  validateLogin,
  validateProfileUpdate,
  validateSessionBooking,
  validateReview,
  validateObjectId,
  validatePagination
};

