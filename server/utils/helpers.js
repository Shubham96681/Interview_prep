const jwt = require('jsonwebtoken');

/**
 * Generate a JWT token
 * @param {Object} payload - The payload to encode
 * @param {string} secret - The JWT secret
 * @param {string} expiresIn - Token expiration time
 * @returns {string} JWT token
 */
const generateToken = (payload, secret, expiresIn = '7d') => {
  return jwt.sign(payload, secret, { expiresIn });
};

/**
 * Verify a JWT token
 * @param {string} token - The token to verify
 * @param {string} secret - The JWT secret
 * @returns {Object} Decoded token payload
 */
const verifyToken = (token, secret) => {
  return jwt.verify(token, secret);
};

/**
 * Format pagination response
 * @param {Array} data - The data array
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items
 * @returns {Object} Formatted pagination response
 */
const formatPagination = (data, page, limit, total) => {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1
    }
  };
};

/**
 * Calculate average rating from reviews
 * @param {Array} reviews - Array of review objects
 * @returns {number} Average rating
 */
const calculateAverageRating = (reviews) => {
  if (!reviews || reviews.length === 0) return 0;
  const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
};

/**
 * Generate a random string
 * @param {number} length - Length of the string
 * @returns {string} Random string
 */
const generateRandomString = (length = 10) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Format date to readable string
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Check if date is in the future
 * @param {Date} date - Date to check
 * @returns {boolean} True if date is in the future
 */
const isFutureDate = (date) => {
  return new Date(date) > new Date();
};

/**
 * Calculate time difference in minutes
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {number} Difference in minutes
 */
const getTimeDifferenceInMinutes = (startDate, endDate) => {
  return Math.abs(new Date(endDate) - new Date(startDate)) / (1000 * 60);
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if email is valid
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Sanitize string input
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/[<>]/g, '');
};

/**
 * Generate meeting link (placeholder for actual video service integration)
 * @param {string} sessionId - Session ID
 * @returns {string} Meeting link
 */
const generateMeetingLink = (sessionId) => {
  // In a real application, this would integrate with services like Zoom, Google Meet, etc.
  return `https://meet.example.com/${sessionId}`;
};

/**
 * Check if user has permission to access resource
 * @param {string} userId - User ID
 * @param {string} resourceUserId - Resource owner's user ID
 * @param {string} userRole - User's role
 * @param {string} requiredRole - Required role for access
 * @returns {boolean} True if user has permission
 */
const hasPermission = (userId, resourceUserId, userRole, requiredRole = null) => {
  // User can access their own resources
  if (userId === resourceUserId) return true;
  
  // Check role-based permissions
  if (requiredRole && userRole !== requiredRole) return false;
  
  // Admin users can access everything (if you implement admin role)
  if (userRole === 'admin') return true;
  
  return false;
};

/**
 * Format error response
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {Object} details - Additional error details
 * @returns {Object} Formatted error response
 */
const formatErrorResponse = (message, statusCode = 500, details = null) => {
  const response = {
    success: false,
    message,
    statusCode
  };
  
  if (details) {
    response.details = details;
  }
  
  return response;
};

/**
 * Format success response
 * @param {string} message - Success message
 * @param {Object} data - Response data
 * @param {number} statusCode - HTTP status code
 * @returns {Object} Formatted success response
 */
const formatSuccessResponse = (message, data = null, statusCode = 200) => {
  const response = {
    success: true,
    message,
    statusCode
  };
  
  if (data) {
    response.data = data;
  }
  
  return response;
};

module.exports = {
  generateToken,
  verifyToken,
  formatPagination,
  calculateAverageRating,
  generateRandomString,
  formatDate,
  isFutureDate,
  getTimeDifferenceInMinutes,
  isValidEmail,
  sanitizeString,
  generateMeetingLink,
  hasPermission,
  formatErrorResponse,
  formatSuccessResponse
};

