const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'Access token required' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Check if user still exists and is active
    const user = await User.findById(decoded.userId).select('-password');
    if (!user || !user.isActive) {
      return res.status(401).json({ 
        success: false,
        message: 'User not found or inactive' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        message: 'Token expired' 
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ 
        success: false,
        message: 'Invalid token' 
      });
    }
    
    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Server error during authentication' 
    });
  }
};

// Middleware to check if user has specific role
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required' 
      });
    }

    const userRoles = Array.isArray(roles) ? roles : [roles];
    if (!userRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false,
        message: 'Insufficient permissions' 
      });
    }

    next();
  };
};

// Middleware to check if user is verified (for experts)
const requireVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false,
      message: 'Authentication required' 
    });
  }

  if (req.user.role === 'expert' && !req.user.profile.isVerified) {
    return res.status(403).json({ 
      success: false,
      message: 'Expert verification required' 
    });
  }

  next();
};

module.exports = {
  authenticateToken,
  requireRole,
  requireVerification
};

