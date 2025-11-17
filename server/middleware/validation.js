const { body, param, query, validationResult } = require('express-validator');

// Validation result handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error('❌ Validation errors:', {
      path: req.path,
      method: req.method,
      errors: errors.array()
    });
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
  // Accept both 'role' and 'userType' for backward compatibility
  body('userType')
    .optional()
    .isIn(['candidate', 'expert', 'admin'])
    .withMessage('UserType must be either candidate, expert, or admin'),
  body('role')
    .optional()
    .isIn(['candidate', 'expert'])
    .withMessage('Role must be either candidate or expert'),
  // Custom validation to ensure at least one of role or userType is provided
  body().custom((value) => {
    if (!value.userType && !value.role) {
      throw new Error('Either userType or role must be provided');
    }
    return true;
  }),
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
    .notEmpty()
    .withMessage('Valid session ID is required')
    .isString()
    .withMessage('Session ID must be a string'),
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('comment')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Comment must be between 1 and 1000 characters'),
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

// Prisma ID validation (accepts both MongoDB ObjectId and Prisma IDs)
const validateObjectId = (paramName) => {
  return [
    param(paramName)
      .notEmpty()
      .withMessage(`${paramName} is required`)
      .isString()
      .withMessage(`${paramName} must be a string`)
      .custom((value, { req }) => {
        // Accept MongoDB ObjectId format (24 hex characters)
        if (/^[0-9a-fA-F]{24}$/.test(value)) {
          return true;
        }
        // Accept Prisma ID format (alphanumeric, typically starts with letters, length > 10)
        // Prisma IDs can be: cmhhtzlz30000n19n08cantxu, cmhrg6c7n0001n16a8o6obxyj, etc.
        if (/^[a-z0-9]+$/i.test(value) && value.length >= 10 && value.length <= 50) {
          return true;
        }
        // Log validation failure for debugging
        console.error(`❌ Invalid ${paramName} format:`, { value, length: value?.length, path: req.path });
        throw new Error(`Invalid ${paramName} format`);
      }),
    handleValidationErrors
  ];
};

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

