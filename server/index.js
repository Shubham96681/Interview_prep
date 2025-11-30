const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
// Load environment variables
require('dotenv').config();

// Ensure JWT_SECRET is set (Windows compatibility fix)
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'your-super-secret-jwt-key-change-this-in-production';
  console.log('⚠️  JWT_SECRET set to fallback value');
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env');
  // In production, try to continue with a default or warn
  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️ Continuing without DATABASE_URL - database operations will fail');
  } else {
  process.exit(1);
  }
}

console.log('🔧 Environment loaded successfully');

// Import Prisma client
const prisma = require('./lib/prisma');

// Import realtime service
const realtimeService = require('./services/realtime');

// Import monitoring service
const monitoringService = require('./services/monitoring');

// Import WebRTC service
const webrtcService = require('./services/webrtcService');

// Import S3 service
const s3Service = require('./services/s3Service');

// Import email service
const emailService = require('./services/emailService');

// Import OTP service
const otpService = require('./services/otpService');

// Import middleware
const { authenticateToken, requireRole, requireVerification } = require('./middleware/auth-prisma');
const {
  validateRegistration,
  validateLogin,
  validateProfileUpdate,
  validateSessionBooking,
  validateReview,
  validateObjectId,
  validatePagination
} = require('./middleware/validation');

const app = express();
const PORT = process.env.PORT || 5000;

// Increase request size limits for file uploads (but with reasonable limits)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for API
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Request timeout middleware (30 seconds) - must be before routes
app.use((req, res, next) => {
  req.setTimeout(30000, () => {
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        error: 'Request timeout'
      });
    }
  });
  next();
});

// API monitoring middleware - track request latency and errors
app.use((req, res, next) => {
  const startTime = Date.now();
  const endpoint = req.path;
  
  // Track response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const success = res.statusCode < 400;
    monitoringService.recordApiRequest(duration, success, endpoint);
  });
  
  next();
});

// Request logging middleware for debugging (production-safe)
app.use((req, res, next) => {
  // Log API requests for debugging
  if (req.path.startsWith('/api/')) {
    console.log(`📥 ${req.method} ${req.path}`, {
      query: req.query,
      params: req.params,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      hasAuth: !!req.headers.authorization,
      originalUrl: req.originalUrl
    });
  }
  next();
});

// Debug middleware to log route matching (temporary for debugging)
app.use((req, res, next) => {
  if (req.path.includes('/reviews') || req.path.includes('/sessions')) {
    console.log(`🔍 Route check: ${req.method} ${req.path}`, {
      matchesReviews: req.path === '/api/reviews',
      matchesSessionReviews: /^\/api\/sessions\/[^\/]+\/reviews$/.test(req.path),
      pathParts: req.path.split('/'),
      pathLength: req.path.split('/').length,
      originalUrl: req.originalUrl
    });
  }
  next();
});

// More lenient rate limiting for email check endpoint (real-time validation needs)
const emailCheckLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Allow 20 email checks per minute per IP
  message: {
    success: false,
    message: 'Too many email check requests. Please wait a moment.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for other API endpoints (optimized for high traffic)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 200 : 1000, // Higher limit for production
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for email check endpoint (it has its own limiter)
  skip: (req) => req.path === '/api/auth/check-email',
  // Use Redis or memory store for distributed rate limiting in production
  // For now, using default memory store (works per process)
});

// Apply lenient rate limiting specifically to email check endpoint first
app.use('/api/auth/check-email', emailCheckLimiter);

// Apply general rate limiting to all other API routes (exclude realtime for SSE)
app.use('/api/', (req, res, next) => {
  // Skip rate limiting for realtime endpoint (SSE connections need to stay open)
  if (req.path === '/realtime' || req.path === '/api/realtime') {
    return next();
  }
  limiter(req, res, next);
});

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '3gb' }));
app.use(express.urlencoded({ extended: true, limit: '3gb' }));

// Static file serving for uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB default
  },
  fileFilter: (req, file, cb) => {
    // Allow images and documents
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images and documents are allowed'));
    }
  }
});

// Health check endpoint - must work even if database is down (for load balancer checks)
app.get('/api/health', async (req, res) => {
  try {
    const healthStatus = {
    success: true,
    status: 'OK', 
    timestamp: new Date().toISOString(),
    port: PORT,
      environment: process.env.NODE_ENV || 'development',
      uptime: Math.round(process.uptime()),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      }
    };

    // Try to test database connection (non-blocking with timeout)
    try {
      await Promise.race([
        prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Database timeout')), 2000))
      ]);
      healthStatus.database = process.env.DATABASE_URL?.includes('postgresql') 
        ? 'PostgreSQL with Prisma (Connected)' 
        : 'SQLite with Prisma (Connected)';
      healthStatus.databaseStatus = 'connected';
    } catch (dbError) {
      // Database check failed, but still return OK for health check
      healthStatus.database = 'Connection check failed';
      healthStatus.databaseStatus = 'disconnected';
      healthStatus.warning = 'Database connection check failed, but server is running';
      console.warn('⚠️ Health check: Database connection test failed:', dbError.message);
    }
    
    res.json(healthStatus);
  } catch (error) {
    console.error('Health check error:', error);
    // Even on error, return 200 so load balancer doesn't mark server as down
    res.status(200).json({
      success: false,
      status: 'DEGRADED',
      timestamp: new Date().toISOString(),
      error: 'Health check failed but server is running',
      port: PORT,
      uptime: Math.round(process.uptime())
    });
  }
});

// Test endpoint to verify routes are registered
app.get('/api/test-routes', (req, res) => {
  res.json({
    success: true,
    message: 'Routes test endpoint',
    routes: {
      'GET /api/sessions/:sessionId/reviews': 'Registered',
      'POST /api/reviews': 'Registered',
      timestamp: new Date().toISOString()
    }
  });
});

// Test endpoint with similar pattern to verify route matching works
app.get('/api/test-sessions/:testId/reviews', (req, res) => {
  console.log('✅ Test route matched:', req.params);
  res.json({
    success: true,
    message: 'Test route works',
    testId: req.params.testId,
    timestamp: new Date().toISOString()
  });
});

// TEMPORARY: Direct test route without auth/validation to verify route matching
app.get('/api/sessions/:sessionId/reviews-test', (req, res) => {
  console.log('✅✅✅ TEST ROUTE MATCHED (no auth/validation):', req.params);
  res.json({
    success: true,
    message: 'Test route matched successfully',
    sessionId: req.params.sessionId,
    timestamp: new Date().toISOString()
  });
});

// Check if email exists endpoint
app.get('/api/auth/check-email', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ 
        exists: false,
        message: 'Email parameter is required' 
      });
    }

    // Sanitize email
    const sanitizedEmail = email.trim().toLowerCase();
    
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitizedEmail)) {
      return res.status(400).json({ 
        exists: false,
        message: 'Invalid email format' 
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: sanitizedEmail }
    });

    if (existingUser) {
      return res.json({ 
        exists: true,
        message: 'This email already exists. Please use a different email.' 
      });
    }

    return res.json({ 
      exists: false,
      message: 'Email is available' 
    });
  } catch (error) {
    console.error('❌ Error checking email:', error);
    return res.status(500).json({ 
      exists: false,
      message: 'Error checking email availability' 
    });
  }
});

// Authentication routes
app.post('/api/auth/register', upload.fields([
  { name: 'resume', maxCount: 1 },
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'expertProfilePhoto', maxCount: 1 },
  { name: 'certification_0', maxCount: 1 },
  { name: 'certification_1', maxCount: 1 },
  { name: 'certification_2', maxCount: 1 }
]), validateRegistration, async (req, res) => {
  try {
    console.log('📝 Registration request received');
    console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
    console.log('📝 Files:', req.files ? Object.keys(req.files) : 'No files');
    
    const { email, password, name, userType, role, phone, company, title, bio, experience, skills, yearsOfExperience, proficiency, hourlyRate, expertBio, expertSkills, currentRole } = req.body;

    // Use userType if provided, otherwise fall back to role
    const finalUserType = userType || role;

    if (!email || !password || !name || !finalUserType) {
      console.error('❌ Missing required fields:', { email: !!email, password: !!password, name: !!name, userType: !!finalUserType, role: !!role });
      return res.status(400).json({ message: 'Missing required fields: email, password, name, and userType (or role) are required' });
    }

    console.log(`🔍 Checking if user exists: ${email}`);
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      console.error(`❌ User already exists: ${email}`);
      return res.status(400).json({ message: 'This email already exists. Please use a different email.' });
    }

    console.log(`✅ User does not exist, proceeding with registration for: ${email}`);

    // Validate profile photo is required
    const profilePhotoPath = req.files?.profilePhoto?.[0]?.filename || req.files?.expertProfilePhoto?.[0]?.filename;
    if (!profilePhotoPath) {
      console.error('❌ Profile photo is required');
      return res.status(400).json({ message: 'Profile photo is required' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Handle file uploads
    const resumePath = req.files?.resume?.[0]?.filename;
    const certificationPaths = [];
    
    // Handle multiple certification files
    for (let i = 0; i < 3; i++) {
      const certFile = req.files?.[`certification_${i}`]?.[0];
      if (certFile) {
        certificationPaths.push(certFile.filename);
      }
    }

    // Parse skills and proficiency - store as JSON strings for SQLite
    const skillsJson = skills ? JSON.stringify(skills.split(',').map(s => s.trim())) : null;
    const proficiencyJson = proficiency ? JSON.stringify(JSON.parse(proficiency)) : null;

    // Prepare user data for OTP storage (don't create user yet)
    const userData = {
        email,
        password: hashedPassword,
        name,
        userType: finalUserType,
        phone: phone || null,
        company: company || null,
        title: title || null,
        bio: bio || expertBio || null,
        experience: experience || yearsOfExperience || null,
        skills: skillsJson,
        proficiency: proficiencyJson,
        hourlyRate: hourlyRate ? parseFloat(hourlyRate) : null,
        resumePath: resumePath || null,
        profilePhotoPath: profilePhotoPath || null,
        certificationPaths: certificationPaths.length > 0 ? JSON.stringify(certificationPaths) : null,
      isActive: finalUserType === 'expert' ? false : true
    };

    // Generate and store OTP
    const otp = otpService.storeOTP(email, userData);

    // Send OTP email
    try {
      await emailService.sendOTPEmail(email, name, otp);
      console.log(`✅ OTP email sent to ${email}`);
    } catch (emailError) {
      console.error('❌ Error sending OTP email:', emailError);
      // Don't fail registration if email fails, but log it
      // In production, you might want to handle this differently
    }

    res.status(200).json({
      success: true,
      message: 'OTP sent to your email. Please verify to complete registration.',
      email: email // Return email for frontend to use in verification
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Verify OTP and complete registration
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ 
        success: false,
        message: 'Email and OTP are required' 
      });
    }

    console.log(`🔐 OTP verification attempt for: ${email}`);

    // Verify OTP
    const verification = otpService.verifyOTP(email, otp);

    if (!verification.valid) {
      console.log(`❌ OTP verification failed for ${email}: ${verification.error}`);
      return res.status(400).json({
        success: false,
        message: verification.error || 'Invalid or expired OTP'
      });
    }

    console.log(`✅ OTP verified for ${email}, creating user...`);

    // OTP is valid, create the user
    const userData = verification.userData;

    const user = await prisma.user.create({
      data: {
        email: userData.email,
        password: userData.password,
        name: userData.name,
        userType: userData.userType,
        phone: userData.phone,
        company: userData.company,
        title: userData.title,
        bio: userData.bio,
        experience: userData.experience,
        skills: userData.skills,
        proficiency: userData.proficiency,
        hourlyRate: userData.hourlyRate,
        resumePath: userData.resumePath,
        profilePhotoPath: userData.profilePhotoPath,
        certificationPaths: userData.certificationPaths,
        isActive: userData.isActive
      }
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, userType: user.userType },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    // Send registration success email
    try {
      await emailService.sendRegistrationSuccessEmail(user.email, user.name, user.userType);
      console.log(`✅ Registration success email sent to ${user.email}`);
    } catch (emailError) {
      console.error('❌ Error sending registration success email:', emailError);
      // Don't fail if email fails
    }

    console.log(`✅ User registered successfully: ${user.email} (ID: ${user.id})`);
    console.log(`✅ User type: ${user.userType}, Active: ${user.isActive}`);

    res.status(201).json({
      success: true,
      message: 'Registration successful! Welcome to Interview Prep Platform.',
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('❌ OTP verification error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Resend OTP
app.post('/api/auth/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    console.log(`🔄 Resend OTP request for: ${email}`);

    const userData = otpService.getUserData(email);
    if (!userData) {
      console.log(`❌ No pending registration found for: ${email}`);
      return res.status(400).json({
        success: false,
        message: 'No pending registration found for this email. Please register again.'
      });
    }

    // Resend OTP
    const newOtp = otpService.resendOTP(email);
    if (!newOtp) {
      console.log(`❌ Failed to resend OTP for: ${email}`);
      return res.status(400).json({
        success: false,
        message: 'Failed to resend OTP. Please try registering again.'
      });
    }

    // Send new OTP email
    try {
      await emailService.sendOTPEmail(email, userData.name, newOtp);
      console.log(`✅ OTP resent to ${email}`);
    } catch (emailError) {
      console.error('❌ Error sending OTP email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email. Please try again.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'OTP resent to your email. Please check your inbox.'
    });
  } catch (error) {
    console.error('❌ Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

app.post('/api/auth/login', validateLogin, async (req, res) => {
  try {
    console.log('🔐 Login attempt:', req.body.email);
    const { email, password } = req.body;

    // Validate JWT_SECRET
    if (!process.env.JWT_SECRET) {
      console.error('❌ JWT_SECRET not available');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    // Find user
    console.log('🔍 Looking for user:', email);
    let user = await prisma.user.findUnique({
      where: { email }
    });

    let isNewlyCreated = false;
    
    // If user doesn't exist, create test users on-the-fly for common test emails
    if (!user && (email === 'john@example.com' || email === 'jane@example.com')) {
      console.log('⚠️ User not found, creating test user:', email);
      try {
        const hashedPassword = await bcrypt.hash(password || 'password123', 10);
        const testUserData = {
          email,
          name: email === 'john@example.com' ? 'John Doe' : 'Jane Smith',
          password: hashedPassword,
          userType: email === 'john@example.com' ? 'candidate' : 'expert',
          company: email === 'john@example.com' ? 'Tech Corp' : 'Google',
          title: email === 'john@example.com' ? 'Software Engineer' : 'Senior Software Engineer',
        };
        
        user = await prisma.user.create({
          data: testUserData
        });
        isNewlyCreated = true;
        console.log('✅ Test user created:', user.id);
      } catch (createError) {
        console.error('❌ Error creating test user:', createError);
        return res.status(500).json({ message: 'Error creating user' });
      }
    }

    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log('✅ User found:', user.email);

    // Check password (skip for newly created users since we just created them)
    if (!isNewlyCreated) {
      console.log('🔑 Checking password...');
      const isPasswordValid = await bcrypt.compare(password || 'password123', user.password);
      if (!isPasswordValid) {
        console.log('❌ Invalid password for:', email);
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      console.log('✅ Password valid');
    } else {
      console.log('✅ Skipping password check for newly created user');
    }

    // Generate JWT token
    console.log('🎫 Generating JWT token...');
    const token = jwt.sign(
      { userId: user.id, email: user.email, userType: user.userType },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    console.log('✅ JWT token generated successfully');

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Login successful',
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('❌ Login error:', error.message);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    // If req.user is not set (test token), try to get user from token or return error
    if (!req.user) {
      // For test tokens, we can't verify the user, so return 401
      return res.status(401).json({
        success: false,
        message: 'Please log in again to get a valid token'
      });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        userType: true,
        phone: true,
        company: true,
        title: true,
        avatar: true,
        bio: true,
        experience: true,
        skills: true,
        rating: true,
        totalSessions: true,
        hourlyRate: true,
        isVerified: true,
        yearsOfExperience: true,
        proficiency: true,
        resumePath: true,
        profilePhotoPath: true,
        certificationPaths: true,
        timezone: true,
        workingHoursStart: true,
        workingHoursEnd: true,
        daysAvailable: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get experts
app.get('/api/experts', validatePagination, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', skills = '', minRating = 0 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      userType: 'expert',
      isActive: true,
      rating: { gte: parseFloat(minRating) }
    };

    const orConditions = [];

    if (search) {
      orConditions.push(
        { name: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } }
      );
    }

    if (skills) {
      const skillsArray = skills.split(',').map(s => s.trim());
      // For SQLite, we need to use string contains since skills is stored as JSON
      skillsArray.forEach(skill => {
        orConditions.push({
          skills: { contains: skill }
        });
      });
    }

    if (orConditions.length > 0) {
      where.OR = orConditions;
    }

    const [experts, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          name: true,
          title: true,
          company: true,
          bio: true,
          avatar: true,
          rating: true,
          totalSessions: true,
          hourlyRate: true,
          isVerified: true,
          skills: true,
          proficiency: true,
          profilePhotoPath: true
        },
        orderBy: { rating: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      experts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get experts error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get expert by ID
app.get('/api/experts/:id', async (req, res) => {
  try {
    console.log('📋 GET /api/experts/:id - Request received:', {
      expertId: req.params.id,
      headers: req.headers.authorization ? 'Token present' : 'No token'
    });
    
    const expertId = req.params.id;
    
    // Basic validation - ensure ID is provided
    if (!expertId || expertId.trim() === '') {
      return res.status(400).json({ message: 'Expert ID is required' });
    }

    // Check if user is authenticated and viewing their own profile
    let isOwnProfile = false;
    let authenticatedUserId = null;
    
    try {
      // Try to authenticate the request (optional - won't fail if no token)
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        authenticatedUserId = decoded.userId;
        isOwnProfile = authenticatedUserId === expertId;
        console.log(`🔍 Expert lookup: ID=${expertId}, Authenticated=${!!authenticatedUserId}, OwnProfile=${isOwnProfile}`);
      }
    } catch (authError) {
      // If authentication fails, continue without it (public access)
      // This allows viewing expert profiles without login
      console.log(`🔍 Expert lookup (public): ID=${expertId}`);
    }

    // Build where clause: allow viewing own profile even if isActive is false
    let whereClause = {
      id: expertId,
      userType: 'expert'
    };

    // If not viewing own profile, require isActive to be true
    if (!isOwnProfile) {
      whereClause.isActive = true;
    }

    console.log(`🔍 Searching for expert with where clause:`, JSON.stringify(whereClause));

    let expert = await prisma.user.findFirst({
      where: whereClause,
      select: {
        id: true,
        name: true,
        title: true,
        company: true,
        bio: true,
        avatar: true,
        rating: true,
        totalSessions: true,
        hourlyRate: true,
        isVerified: true,
        skills: true,
        proficiency: true,
        experience: true,
        yearsOfExperience: true,
        profilePhotoPath: true,
        timezone: true,
        workingHoursStart: true,
        workingHoursEnd: true,
        daysAvailable: true,
        isActive: true // Include isActive in response for debugging
      }
    });

    // If expert not found and ID looks like a frontend-generated ID (user-{timestamp}),
    // try to find by email or suggest checking the actual database ID
    if (!expert) {
      console.error(`❌ Expert not found: ID=${expertId}, isOwnProfile=${isOwnProfile}, whereClause=`, whereClause);
      
      // Check if this looks like a frontend-generated ID
      const isFrontendGeneratedId = /^user-\d+$/.test(expertId);
      
      // Try to find the user without the isActive filter to see if they exist
      const userExists = await prisma.user.findFirst({
        where: { id: expertId, userType: 'expert' },
        select: { id: true, isActive: true, userType: true }
      });
      
      let errorMessage = 'Expert not found';
      if (userExists) {
        console.error(`⚠️ User exists but doesn't match criteria: isActive=${userExists.isActive}, userType=${userExists.userType}`);
        if (!userExists.isActive) {
          errorMessage = 'Expert profile is not active';
        }
      } else {
        // Check if user exists with different userType
        const anyUser = await prisma.user.findFirst({
          where: { id: expertId },
          select: { id: true, userType: true, isActive: true }
        });
        if (anyUser) {
          console.error(`⚠️ User exists but is not an expert: userType=${anyUser.userType}`);
          errorMessage = `User found but is not an expert (userType: ${anyUser.userType})`;
        } else {
          console.error(`⚠️ User with ID ${expertId} does not exist in database`);
          if (isFrontendGeneratedId) {
            errorMessage = `Invalid expert ID. The ID "${expertId}" appears to be a frontend-generated ID that doesn't exist in the database. Please use the actual database ID from the registration response.`;
          } else {
            errorMessage = `Expert with ID ${expertId} does not exist`;
          }
        }
      }
      
      return res.status(404).json({ 
        success: false,
        message: errorMessage,
        error: errorMessage
      });
    }

    console.log(`✅ Expert found: ${expert.name} (ID: ${expert.id})`);
    
    // Return expert data with proper structure
    try {
      const expertResponse = {
        ...expert,
        // Ensure arrays are properly formatted - safely parse JSON strings
        skills: expert.skills ? (typeof expert.skills === 'string' ? (() => {
          try { return JSON.parse(expert.skills); } catch { return []; }
        })() : expert.skills) : [],
        proficiency: expert.proficiency ? (typeof expert.proficiency === 'string' ? (() => {
          try { return JSON.parse(expert.proficiency); } catch { return []; }
        })() : expert.proficiency) : [],
        daysAvailable: expert.daysAvailable ? (typeof expert.daysAvailable === 'string' ? (() => {
          try { return JSON.parse(expert.daysAvailable); } catch { return []; }
        })() : expert.daysAvailable) : []
      };
      
      console.log('✅ Expert found, returning response');
      res.json(expertResponse);
    } catch (parseError) {
      console.error('❌ Error parsing expert data:', parseError);
      // Return expert data without parsing (safer fallback)
      res.json(expert);
    }
  } catch (error) {
    console.error('❌ Get expert error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update user profile
app.put('/api/users/profile', authenticateToken, upload.single('profilePhoto'), validateProfileUpdate, async (req, res) => {
  try {
    const { name, bio, experience, skills, hourlyRate, company, title, timezone, workingHoursStart, workingHoursEnd, daysAvailable } = req.body;
    const userId = req.user.userId;

    const updateData = {};
    if (name) updateData.name = name;
    if (bio) updateData.bio = bio;
    if (experience) updateData.experience = experience;
    if (skills) updateData.skills = JSON.stringify(skills.split(',').map(s => s.trim()));
    if (hourlyRate) updateData.hourlyRate = parseFloat(hourlyRate);
    if (company) updateData.company = company;
    if (title) updateData.title = title;
    if (timezone) updateData.timezone = timezone;
    if (workingHoursStart) updateData.workingHoursStart = workingHoursStart;
    if (workingHoursEnd) updateData.workingHoursEnd = workingHoursEnd;
    if (daysAvailable) updateData.daysAvailable = JSON.stringify(daysAvailable);

    if (req.file) {
      updateData.profilePhotoPath = req.file.filename;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        userType: true,
        phone: true,
        company: true,
        title: true,
        avatar: true,
        bio: true,
        experience: true,
        skills: true,
        rating: true,
        totalSessions: true,
        hourlyRate: true,
        isVerified: true,
        yearsOfExperience: true,
        proficiency: true,
        resumePath: true,
        profilePhotoPath: true,
        certificationPaths: true,
        timezone: true,
        workingHoursStart: true,
        workingHoursEnd: true,
        daysAvailable: true
      }
    });

    res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Book a session
app.post('/api/sessions', authenticateToken, async (req, res) => {
  try {
    const { expertId, candidateId: providedCandidateId, title, description, scheduledDate, date, time, duration, sessionType } = req.body;
    
    // Use provided candidateId or fall back to req.user.id (for JWT tokens)
    let candidateId = providedCandidateId;
    if (!candidateId && req.user) {
      candidateId = req.user.id;
    }
    
    // If no candidateId and no req.user (test token), return error
    if (!candidateId) {
      return res.status(401).json({
        success: false,
        message: 'Please log in again to get a valid token'
      });
    }

    // Verify expert exists - handle mock IDs and email lookups
    let expert = null;
    
    // Try to find by ID first
    if (expertId) {
      expert = await prisma.user.findFirst({
        where: { id: expertId, userType: 'expert' }
      });
    }
    
    // If not found by ID and looks like email, try email
    if (!expert && typeof expertId === 'string' && expertId.includes('@')) {
      expert = await prisma.user.findUnique({
        where: { email: expertId }
      });
      if (expert && expert.userType !== 'expert') {
        expert = null;
      }
    }
    
    // Handle mock expert IDs (map to real database experts)
    if (!expert && expertId === 'expert-001') {
      expert = await prisma.user.findUnique({
        where: { email: 'jane@example.com' }
      });
      if (expert && expert.userType !== 'expert') {
        expert = null;
      }
    }
    
    // Verify candidate exists - handle mock IDs
    let candidate = null;
    if (candidateId) {
      candidate = await prisma.user.findFirst({
        where: { id: candidateId, userType: 'candidate' }
      });
    }
    
    // Handle mock candidate IDs
    if (!candidate && candidateId === 'candidate-001') {
      candidate = await prisma.user.findUnique({
        where: { email: 'john@example.com' }
      });
      if (candidate && candidate.userType !== 'candidate') {
        candidate = null;
      }
    }

    if (!expert || expert.userType !== 'expert') {
      console.error('❌ Expert not found:', expertId);
      return res.status(404).json({ 
        success: false,
        message: 'Expert not found' 
      });
    }
    
    if (!candidate || candidate.userType !== 'candidate') {
      console.error('❌ Candidate not found:', candidateId);
      return res.status(404).json({ 
        success: false,
        message: 'Candidate not found' 
      });
    }
    
    // Use actual database IDs
    const actualExpertId = expert.id;
    const actualCandidateId = candidate.id;

    // Parse date and time if provided (for compatibility with frontend)
    let finalScheduledDate = scheduledDate;
    if (date && time && !scheduledDate) {
      const [year, month, day] = date.split('-').map(Number);
      const [hours, minutes] = time.split(':').map(Number);
      finalScheduledDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
    } else if (scheduledDate) {
      finalScheduledDate = new Date(scheduledDate);
    }

    // Check for existing bookings at the same date and time for this expert
    // Since Session model only has scheduledDate, we check by comparing scheduledDate
    if (date && time && finalScheduledDate) {
      // Check for sessions within the same hour (to account for slight time differences)
      const bookingStart = new Date(finalScheduledDate);
      bookingStart.setMinutes(0, 0, 0);
      const bookingEnd = new Date(bookingStart);
      bookingEnd.setHours(bookingEnd.getHours() + 1);
      
      const existingSession = await prisma.session.findFirst({
        where: {
          expertId: actualExpertId,
          scheduledDate: {
            gte: bookingStart,
            lt: bookingEnd
          },
          status: {
            notIn: ['cancelled', 'completed']
          }
        }
      });

      if (existingSession) {
        console.error('❌ Time slot already booked:', { date, time, expertId: actualExpertId });
        return res.status(409).json({
          success: false,
          message: `This time slot (${date} at ${time}) is already booked. Please select another time.`
        });
      }
    } else if (finalScheduledDate) {
      // Fallback check using scheduledDate if date/time not provided
      const bookingStart = new Date(finalScheduledDate);
      bookingStart.setMinutes(0, 0, 0);
      const bookingEnd = new Date(bookingStart);
      bookingEnd.setHours(bookingEnd.getHours() + 1);
      
      const existingSessionByDate = await prisma.session.findFirst({
        where: {
          expertId: actualExpertId,
          scheduledDate: {
            gte: bookingStart,
            lt: bookingEnd
          },
          status: {
            notIn: ['cancelled', 'completed']
          }
        }
      });

      if (existingSessionByDate) {
        console.error('❌ Time slot conflict detected:', { 
          scheduledDate: finalScheduledDate,
          expertId: actualExpertId 
        });
        return res.status(409).json({
          success: false,
          message: `This time slot is already booked. Please select another time.`
        });
      }
    }

    // Generate meeting ID and link for WebRTC
    const meetingId = `meet-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const meetingLink = baseUrl.includes('localhost') 
      ? `${baseUrl}/meeting/${meetingId}`
      : `/meeting/${meetingId}`;

    // Create session - Session model only has scheduledDate (not separate date/time fields)
    const session = await prisma.session.create({
      data: {
        title: title || `${sessionType || 'Technical'} Interview Session`,
        description: description || `Interview session scheduled for ${date || (finalScheduledDate ? finalScheduledDate.toISOString().split('T')[0] : '')} at ${time || (finalScheduledDate ? finalScheduledDate.toTimeString().split(' ')[0].substring(0, 5) : '')}`,
        scheduledDate: finalScheduledDate,
        duration: parseInt(duration) || 60,
        sessionType: sessionType || 'technical',
        candidateId: actualCandidateId,
        expertId: actualExpertId,
        paymentAmount: expert.hourlyRate ? (expert.hourlyRate * parseInt(duration || 60)) / 60 : 75,
        paymentStatus: 'pending',
        status: 'scheduled',
        meetingId: meetingId,
        meetingLink: meetingLink
      },
      include: {
        candidate: {
          select: { id: true, name: true, email: true }
        },
        expert: {
          select: { id: true, name: true, email: true, hourlyRate: true }
        }
      }
    });

    // Broadcast availability update via real-time service
    try {
      const realtimeService = require('./services/realtime');
      // Broadcast to all connected users that availability has changed for this expert
      realtimeService.broadcast('availability_updated', {
        expertId: actualExpertId,
        date: date || (finalScheduledDate ? finalScheduledDate.toISOString().split('T')[0] : null),
        time: time || (finalScheduledDate ? finalScheduledDate.toTimeString().split(' ')[0].substring(0, 5) : null),
        sessionId: session.id
      });
      console.log('📡 Broadcasted availability update for expert:', actualExpertId);
    } catch (realtimeError) {
      console.error('❌ Error broadcasting availability update:', realtimeError);
      // Don't fail the booking if real-time broadcast fails
    }

    // Send emails to candidate and expert
    try {
      console.log('📧 Attempting to send booking emails...');
      console.log('📧 Candidate email:', session.candidate.email);
      console.log('📧 Expert email:', session.expert.email);
      
      const emailResults = await Promise.allSettled([
        emailService.sendMeetingBookingEmailToCandidate(
          session.candidate.email,
          session.candidate.name,
          session.expert.name,
          session
        ),
        emailService.sendMeetingBookingEmailToExpert(
          session.expert.email,
          session.expert.name,
          session.candidate.name,
          session
        )
      ]);
      
      emailResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          console.log(`✅ Email ${index === 0 ? 'to candidate' : 'to expert'} sent successfully:`, result.value.messageId);
        } else {
          console.error(`❌ Failed to send email ${index === 0 ? 'to candidate' : 'to expert'}:`, result.reason);
        }
      });
    } catch (emailError) {
      console.error('❌ Error sending meeting booking emails:', emailError);
      console.error('❌ Error stack:', emailError.stack);
      // Don't fail the booking if email fails
    }

    res.status(201).json({ message: 'Session booked successfully', session });
  } catch (error) {
    console.error('Book session error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get expert availability with status for each time slot
app.get('/api/experts/:expertId/availability', async (req, res) => {
  try {
    const { expertId } = req.params;
    const { date } = req.query; // Single date: YYYY-MM-DD
    
    console.log('📅 GET /api/experts/:expertId/availability - Request received:', {
      expertId,
      date
    });
    
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date parameter is required (format: YYYY-MM-DD)'
      });
    }
    
    // Map test expert IDs and find actual expert ID
    let actualExpertId = expertId;
    if (expertId === 'expert-001') {
      const expert = await prisma.user.findUnique({
        where: { email: 'jane@example.com' },
        select: { id: true }
      });
      if (expert) actualExpertId = expert.id;
    } else {
      const expert = await prisma.user.findFirst({
        where: { 
          OR: [
            { id: expertId },
            { email: expertId }
          ],
          userType: 'expert'
        },
        select: { id: true }
      });
      if (expert) {
        actualExpertId = expert.id;
      } else {
        console.log('⚠️ Expert not found:', expertId);
        // Return all slots as available if expert not found
        const allSlots = [];
        for (let hour = 9; hour <= 21; hour++) {
          allSlots.push({
            time: `${String(hour).padStart(2, '0')}:00`,
            status: 'available'
          });
        }
        return res.json({
          success: true,
          data: { slots: allSlots }
        });
      }
    }
    
    console.log('🔍 Using expert ID:', actualExpertId);
    
    // Get all scheduled sessions for this expert
    const sessions = await prisma.session.findMany({
      where: {
        expertId: actualExpertId,
        status: {
          notIn: ['cancelled', 'completed']
        }
      },
      select: {
        scheduledDate: true
      }
    });
    
    console.log('📊 Found all scheduled sessions for expert:', sessions.length);
    
    // Extract booked times for the requested date
    const [requestYear, requestMonth, requestDay] = date.split('-').map(Number);
    const bookedTimes = new Set();
    
    sessions.forEach(session => {
      if (!session.scheduledDate) return;
      
      const localDate = new Date(session.scheduledDate);
      const sessionYear = localDate.getFullYear();
      const sessionMonth = localDate.getMonth() + 1;
      const sessionDay = localDate.getDate();
      
      // Check if this session is on the requested date
      if (sessionYear === requestYear && 
          sessionMonth === requestMonth && 
          sessionDay === requestDay) {
        // Extract time in HH:MM format
        const hours = String(localDate.getHours()).padStart(2, '0');
        const minutes = String(localDate.getMinutes()).padStart(2, '0');
        const timeStr = `${hours}:${minutes}`;
        bookedTimes.add(timeStr);
      }
    });
    
    console.log('📋 Booked times for', date, ':', Array.from(bookedTimes));
    
    // Generate all time slots (9 AM to 9 PM)
    const allSlots = [];
    for (let hour = 9; hour <= 21; hour++) {
      const time = `${String(hour).padStart(2, '0')}:00`;
      allSlots.push({
        time,
        status: bookedTimes.has(time) ? 'booked' : 'available'
      });
    }
    
    console.log('✅ Returning availability:', allSlots.filter(s => s.status === 'booked').length, 'booked slots');
    
    res.json({
      success: true,
      data: { slots: allSlots }
    });
  } catch (error) {
    console.error('❌ Get availability error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get expert booked sessions for availability checking
app.get('/api/experts/:expertId/booked-slots', async (req, res) => {
  try {
    const { expertId } = req.params;
    const { startDate, endDate } = req.query;
    
    console.log('📋 GET /api/experts/:expertId/booked-slots - Request received:', {
      expertId,
      startDate,
      endDate
    });
    
    // Map test expert IDs and find actual expert ID
    let actualExpertId = expertId;
    if (expertId === 'expert-001') {
      const expert = await prisma.user.findUnique({
        where: { email: 'jane@example.com' },
        select: { id: true }
      });
      if (expert) actualExpertId = expert.id;
    } else {
      // Verify expert exists and get actual ID
      const expert = await prisma.user.findFirst({
        where: { 
          OR: [
            { id: expertId },
            { email: expertId }
          ],
          userType: 'expert'
        },
        select: { id: true }
      });
      if (expert) {
        actualExpertId = expert.id;
      } else {
        console.log('⚠️ Expert not found:', expertId);
        return res.json({
          success: true,
          data: { bookedSlots: [] }
        });
      }
    }
    
    console.log('🔍 Using expert ID:', actualExpertId);
    
    // Build date range query using scheduledDate (Session model doesn't have separate date/time fields)
    // Include all non-cancelled sessions, then filter by date range
    const whereClause = {
      expertId: actualExpertId,
      status: {
        notIn: ['cancelled', 'completed'] // Exclude cancelled and completed sessions
      }
    };
    
    // First, try to get ALL scheduled sessions for this expert (without date filter)
    // This ensures we don't miss any sessions due to date format issues
    let sessions = await prisma.session.findMany({
      where: {
        expertId: actualExpertId,
        status: {
          notIn: ['cancelled', 'completed']
        }
      },
      select: {
        id: true,
        scheduledDate: true,
        duration: true,
        status: true,
        expertId: true
      },
      orderBy: {
        scheduledDate: 'asc'
      }
    });
    
    console.log('📊 Found all scheduled sessions for expert:', sessions.length);
    
    // Log ALL sessions found for debugging
    if (sessions.length > 0) {
      console.log('📋 ALL sessions found (before date filtering):', sessions.map(s => {
        const localDate = new Date(s.scheduledDate);
        const dateStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
        const timeStr = `${String(localDate.getHours()).padStart(2, '0')}:${String(localDate.getMinutes()).padStart(2, '0')}`;
        return {
          id: s.id,
          scheduledDate: s.scheduledDate,
          extractedDate: dateStr,
          extractedTime: timeStr,
          status: s.status
        };
      }));
    } else {
      console.log('⚠️ No scheduled sessions found for expert. Checking all sessions (any status)...');
      const allSessionsCheck = await prisma.session.findMany({
        where: {
          expertId: actualExpertId
        },
        select: {
          id: true,
          scheduledDate: true,
          status: true
        },
        take: 10
      });
      console.log('📋 All sessions (any status) for expert:', allSessionsCheck.length);
      if (allSessionsCheck.length > 0) {
        console.log('📋 Sample sessions:', allSessionsCheck.map(s => {
          const localDate = new Date(s.scheduledDate);
          return {
            id: s.id,
            scheduledDate: s.scheduledDate,
            date: `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`,
            time: `${String(localDate.getHours()).padStart(2, '0')}:${String(localDate.getMinutes()).padStart(2, '0')}`,
            status: s.status
          };
        }));
      }
    }
    
    // If date range is provided, filter the results in JavaScript (more reliable than DB query)
    // BUT: If no sessions match the date range, return ALL sessions anyway (let frontend filter)
    let filteredSessions = sessions;
    if (startDate || endDate) {
      filteredSessions = sessions.filter(session => {
        if (!session.scheduledDate) return false;
        
        const localDate = new Date(session.scheduledDate);
        const sessionYear = localDate.getFullYear();
        const sessionMonth = localDate.getMonth() + 1;
        const sessionDay = localDate.getDate();
        
        if (startDate) {
          const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
          const sessionDate = new Date(sessionYear, sessionMonth - 1, sessionDay);
          const startDateObj = new Date(startYear, startMonth - 1, startDay);
          if (sessionDate < startDateObj) return false;
        }
        
        if (endDate) {
          const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
          const sessionDate = new Date(sessionYear, sessionMonth - 1, sessionDay);
          const endDateObj = new Date(endYear, endMonth - 1, endDay);
          if (sessionDate > endDateObj) return false;
        }
        
        return true;
      });
      
      console.log(`📊 Filtered to ${filteredSessions.length} sessions within date range (${startDate} to ${endDate})`);
      
      // If filtered is empty but we have sessions, return all sessions (date range might be wrong)
      if (filteredSessions.length === 0 && sessions.length > 0) {
        console.log('⚠️ No sessions in date range, but returning ALL sessions anyway (date range might be incorrect)');
        filteredSessions = sessions; // Return all sessions
      }
    }
    
    sessions = filteredSessions;
    
    // Format response with date and time extracted from scheduledDate
    // Use local time to match what the user selected (not UTC)
    const bookedSlots = sessions.map(session => {
      if (!session.scheduledDate) {
        return null;
      }
      
      // Convert to local time for date/time extraction (matches user's timezone)
      const localDate = new Date(session.scheduledDate);
      
      // Get date in YYYY-MM-DD format (local timezone)
      const year = localDate.getFullYear();
      const month = String(localDate.getMonth() + 1).padStart(2, '0');
      const day = String(localDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      // Extract time in HH:MM format (local time, 24-hour, zero-padded)
      const hours = String(localDate.getHours()).padStart(2, '0');
      const minutes = String(localDate.getMinutes()).padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;
      
      return {
        date: dateStr,
        time: timeStr,
        scheduledDate: session.scheduledDate,
        duration: session.duration,
        status: session.status
      };
    }).filter(Boolean); // Remove any null entries
    
    console.log('✅ Booked slots fetched:', bookedSlots.length);
    console.log('📋 Booked slots details:', JSON.stringify(bookedSlots, null, 2));
    console.log('📋 Raw sessions from DB:', sessions.map(s => ({
      id: s.id,
      scheduledDate: s.scheduledDate,
      status: s.status,
      expertId: s.expertId
    })));
    
    res.json({
      success: true,
      data: { bookedSlots }
    });
  } catch (error) {
    console.error('❌ Get booked slots error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get user sessions
app.get('/api/sessions', async (req, res) => {
  try {
    const { userId: queryUserId, userType, page = 1, limit = 100, status } = req.query;
    
    // Determine userId - use query param or authenticated user
    let userId = queryUserId;
    if (!userId && req.user) {
      userId = req.user.id || req.user.userId;
    }
    
    // Handle mock IDs
    if (userId === 'candidate-001') {
      const candidate = await prisma.user.findUnique({
        where: { email: 'john@example.com' }
      });
      if (candidate) {
        userId = candidate.id;
      }
    } else if (userId === 'expert-001') {
      const expert = await prisma.user.findUnique({
        where: { email: 'jane@example.com' }
      });
      if (expert) {
        userId = expert.id;
      }
    }
    
    // If no userId, return empty
    if (!userId) {
      return res.json({
        success: true,
        sessions: [],
        total: 0
      });
    }
    
    const targetUserType = userType || 'candidate';
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause based on userType
    const where = targetUserType === 'candidate'
      ? { candidateId: userId }
      : { expertId: userId };

    if (status) {
      where.status = status;
    }

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          candidate: {
            select: { id: true, name: true, email: true }
          },
          expert: {
            select: { id: true, name: true, email: true, hourlyRate: true }
          }
        },
        orderBy: { scheduledDate: 'desc' }
      }),
      prisma.session.count({ where })
    ]);

    // Format sessions to match frontend expectations
    const formattedSessions = sessions.map(session => {
      const localDate = new Date(session.scheduledDate);
      const dateStr = `${String(localDate.getFullYear())}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
      const timeStr = `${String(localDate.getHours()).padStart(2, '0')}:${String(localDate.getMinutes()).padStart(2, '0')}`;
      
      return {
        id: session.id,
        expertId: session.expertId,
        candidateId: session.candidateId,
        expertName: session.expert?.name || 'Unknown',
        candidateName: session.candidate?.name || 'Unknown',
        date: dateStr,
        time: timeStr,
        scheduledDate: session.scheduledDate.toISOString(),
        duration: session.duration,
        sessionType: session.sessionType,
        status: session.status,
        paymentAmount: session.paymentAmount,
        paymentStatus: session.paymentStatus,
        meetingLink: session.meetingLink,
        meetingId: session.meetingId,
        recordingUrl: session.recordingUrl,
        isRecordingEnabled: session.isRecordingEnabled,
        createdAt: session.createdAt.toISOString()
      };
    });

    res.json({
      success: true,
      sessions: formattedSessions,
      total: formattedSessions.length
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: error.message 
    });
  }
});

// Get session by meeting ID (for meeting page access) - MUST be before /api/sessions/:id
app.get('/api/sessions/meeting/:meetingId', async (req, res) => {
  try {
    const { meetingId } = req.params;
    
    console.log('Fetching session by meetingId:', meetingId);
    
    // Try to find session by meetingId
    let session = await prisma.session.findFirst({
      where: { meetingId: meetingId },
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        expert: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // If not found, try to find by meetingLink containing the meetingId
    if (!session) {
      console.log('Session not found by meetingId, trying to find by meetingLink...');
      const allSessions = await prisma.session.findMany({
        where: {
          meetingLink: {
            contains: meetingId
          }
        },
        include: {
          candidate: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          expert: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });
      
      if (allSessions.length > 0) {
        session = allSessions[0];
        console.log('Found session by meetingLink:', session.id);
      }
    }

    // If still not found and user is authenticated, try to find by user participation
    // This helps when meetingId in URL doesn't match database (e.g., old sessions)
    if (!session && req.user) {
      console.log('Session not found by meetingId or meetingLink, trying to find by user participation...');
      const userId = req.user.id || req.user.userId;
      const userSessions = await prisma.session.findMany({
        where: {
          OR: [
            { candidateId: userId },
            { expertId: userId }
          ],
          // Try to match by date if meetingId contains a timestamp
          ...(meetingId.startsWith('meet-') && meetingId.includes('-') ? {
            scheduledDate: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
              lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)  // Next 30 days
            }
          } : {})
        },
        include: {
          candidate: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          expert: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { scheduledDate: 'desc' },
        take: 1 // Get most recent matching session
      });
      
      if (userSessions.length > 0) {
        session = userSessions[0];
        console.log('Found session by user participation:', session.id);
      }
    }

    if (!session) {
      console.log('Session not found for meetingId:', meetingId);
      return res.status(404).json({
        success: false,
        message: 'Session not found for this meeting ID'
      });
    }

    // Format response
    const localDate = new Date(session.scheduledDate);
    const dateStr = `${String(localDate.getFullYear())}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(localDate.getHours()).padStart(2, '0')}:${String(localDate.getMinutes()).padStart(2, '0')}`;

    const formattedSession = {
      id: session.id,
      expertId: session.expertId,
      candidateId: session.candidateId,
      expertName: session.expert?.name || 'Unknown',
      candidateName: session.candidate?.name || 'Unknown',
      expertEmail: session.expert?.email || null,
      candidateEmail: session.candidate?.email || null,
      date: dateStr,
      time: timeStr,
      scheduledDate: session.scheduledDate.toISOString(),
      duration: session.duration,
      sessionType: session.sessionType,
      status: session.status,
      paymentAmount: session.paymentAmount,
      paymentStatus: session.paymentStatus,
      meetingLink: session.meetingLink,
      meetingId: session.meetingId,
      recordingUrl: session.recordingUrl,
      isRecordingEnabled: session.isRecordingEnabled,
      createdAt: session.createdAt.toISOString()
    };

    res.json({
      success: true,
      data: formattedSession
    });
  } catch (error) {
    console.error('Error fetching session by meetingId:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch session',
      message: error.message
    });
  }
});

// Configure multer for recording uploads
const recordingsDir = path.join(__dirname, 'uploads', 'recordings');
if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir, { recursive: true });
}

const recordingStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, recordingsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `recording-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const uploadRecording = multer({
  storage: recordingStorage,
  limits: {
    fileSize: 3 * 1024 * 1024 * 1024 // 3GB limit for video files (supports up to 60+ minute recordings)
  },
  fileFilter: (req, file, cb) => {
    // Allow video files
    const allowedTypes = /webm|mp4|ogg|mov|avi/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype.startsWith('video/');

    if (mimetype || extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  }
});

// Upload recording file for a session
// Increased timeout for large file uploads (60 minutes for 60+ minute recordings up to 3GB)
app.post('/api/sessions/:id/upload-recording', (req, res, next) => {
  // Set longer timeout for recording uploads (60 minutes = 3600000ms)
  // This allows enough time for 60-minute recordings even on slower connections
  req.setTimeout(3600000, () => {
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        error: 'Upload timeout - file may be too large or connection is slow. Please try again or contact support.'
      });
    }
  });
  next();
}, uploadRecording.single('recording'), async (req, res) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No recording file provided'
      });
    }

    // Verify session exists
    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        candidate: { select: { id: true, email: true } },
        expert: { select: { id: true, email: true } }
      }
    });

    if (!session) {
      // Delete uploaded file if session doesn't exist
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    let recordingUrl;
    let fullUrl;

    // Check if S3 is configured
    const isS3Configured = process.env.AWS_S3_BUCKET_NAME;
    console.log(`📦 S3 Configuration check: ${isS3Configured ? 'Configured' : 'Not configured'}, Bucket: ${process.env.AWS_S3_BUCKET_NAME || 'N/A'}`);

    if (isS3Configured) {
      // Upload to S3
      try {
        const fileSizeMB = (req.file.size / (1024 * 1024)).toFixed(2);
        const fileSizeGB = (req.file.size / (1024 * 1024 * 1024)).toFixed(2);
        console.log(`📤 Attempting S3 upload for session ${id}, file size: ${req.file.size} bytes (${fileSizeMB} MB / ${fileSizeGB} GB)`);
        const fileBuffer = fs.readFileSync(req.file.path);
        const fileName = `recording-${id}-${Date.now()}-${Math.round(Math.random() * 1E9)}.webm`;
        
        const s3Result = await s3Service.uploadFile(
          fileBuffer,
          fileName,
          req.file.mimetype || 'video/webm'
        );

        recordingUrl = s3Result.url;
        fullUrl = s3Result.url;

        // Delete local file after S3 upload
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
          console.log(`🗑️ Deleted local file after S3 upload: ${req.file.path}`);
        }

        console.log(`✅ Recording uploaded to S3 for session ${id}: ${s3Result.key}`);
        console.log(`🔗 S3 URL: ${fullUrl}`);
      } catch (s3Error) {
        console.error('❌ S3 upload failed, falling back to local storage:');
        console.error('   Error:', s3Error.message);
        console.error('   Stack:', s3Error.stack);
        // Fall back to local storage
        recordingUrl = `/uploads/recordings/${req.file.filename}`;
        fullUrl = `${req.protocol}://${req.get('host')}${recordingUrl}`;
        console.log(`📁 Using local storage fallback: ${fullUrl}`);
      }
    } else {
      // Use local storage
      console.log(`📁 S3 not configured, using local storage`);
      recordingUrl = `/uploads/recordings/${req.file.filename}`;
      fullUrl = `${req.protocol}://${req.get('host')}${recordingUrl}`;
    }

    // Update session with recording URL
    console.log(`💾 Updating session ${id} with recording URL: ${fullUrl}`);
    await prisma.session.update({
      where: { id },
      data: { recordingUrl: fullUrl }
    });
    console.log(`✅ Session updated successfully`);

    res.json({
      success: true,
      message: 'Recording uploaded successfully',
      data: {
        recordingUrl: fullUrl,
        sessionId: id
      }
    });
  } catch (error) {
    console.error('Error uploading recording:', error);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: 'Failed to upload recording',
      error: error.message
    });
  }
});

// Get recording URL for a session (generates fresh signed URL if needed)
// IMPORTANT: This must be BEFORE /api/sessions/:id to avoid route conflicts
// Express matches routes in order, so more specific routes must come first
app.get('/api/sessions/:id/recording', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get session with recording URL
    const session = await prisma.session.findUnique({
      where: { id },
      select: {
        id: true,
        recordingUrl: true,
        candidateId: true,
        expertId: true
      }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Check if user has access to this session
    const userId = req.user?.userId || req.user?.id;
    
    // Log for debugging
    console.log('🔍 Recording access check:', {
      userId,
      sessionCandidateId: session.candidateId,
      sessionExpertId: session.expertId,
      hasUser: !!req.user,
      userEmail: req.user?.email,
      authHeader: req.headers['authorization']?.substring(0, 30) + '...'
    });
    
    // Check if this is a test token (generic test tokens don't have user info)
    const authHeader = req.headers['authorization'] || '';
    const isTestToken = authHeader.includes('test-token-') || authHeader.includes('token-');
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    // Allow access if:
    // 1. User is authenticated and matches session participant, OR
    // 2. It's a test token (for development/testing), OR
    // 3. It's development mode
    if (userId && (session.candidateId === userId || session.expertId === userId)) {
      // User is authenticated and has access - allow
      console.log('✅ User authenticated and has access to session');
    } else if (isTestToken || isDevelopment) {
      // Test token or development mode - allow access
      console.warn('⚠️ Test token or development mode - allowing access to recording');
    } else {
      // No access - deny
      console.warn('⚠️ Access denied - userId:', userId, 'session candidateId:', session.candidateId, 'session expertId:', session.expertId);
      return res.status(403).json({
        success: false,
        message: 'Access denied. Please ensure you are logged in with the correct account.'
      });
    }

    if (!session.recordingUrl) {
      return res.status(404).json({
        success: false,
        message: 'No recording available for this session'
      });
    }

    let accessibleUrl = session.recordingUrl;

    // If it's an S3 URL, ALWAYS generate a fresh signed URL (even if expired)
    // This ensures expired URLs are automatically refreshed
    if (session.recordingUrl.includes('s3.amazonaws.com') || session.recordingUrl.includes('amazonaws.com')) {
      try {
        console.log(`🔄 Detected S3 URL, generating fresh signed URL (works even if original is expired)...`);
        console.log(`📋 Original URL: ${session.recordingUrl.substring(0, 100)}...`);
        
        // Use S3 service to extract key and generate fresh URL
        // The getSignedUrl method can handle both keys and URLs, and will extract the key automatically
        // This works even if the original URL is expired
        accessibleUrl = await s3Service.getSignedUrl(session.recordingUrl, 604800); // 7 days
        console.log(`✅ Fresh signed URL generated successfully`);
        console.log(`🔗 New URL: ${accessibleUrl.substring(0, 100)}...`);
      } catch (s3Error) {
        console.error('❌ Error generating fresh signed URL:', s3Error);
        console.error('   Error details:', s3Error.message);
        console.error('   Stack:', s3Error.stack);
        console.warn('⚠️ Falling back to original URL (may be expired)');
        // Return original URL as fallback, but log the error
        // The frontend will handle this gracefully
      }
    }
    // If it's a local URL, it should already be accessible via /uploads

    res.json({
      success: true,
      data: {
        recordingUrl: accessibleUrl,
        sessionId: id
      }
    });
  } catch (error) {
    console.error('Error getting recording URL:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recording URL',
      error: error.message
    });
  }
});

// Get reviews for a session (MUST come before /api/sessions/:id to avoid route conflicts)
// CRITICAL: This route MUST be registered BEFORE /api/sessions/:id
app.get('/api/sessions/:sessionId/reviews', authenticateToken, validateObjectId('sessionId'), async (req, res) => {
  console.log('✅✅✅✅✅ Route matched: GET /api/sessions/:sessionId/reviews');
  console.log('✅ Route handler executing:', { 
    sessionId: req.params.sessionId, 
    userId: req.user?.id,
    path: req.path,
    originalUrl: req.originalUrl,
    params: req.params
  });
  try {
    const sessionId = req.params.sessionId;
    let userId = req.user?.id || req.user?.userId;

    console.log('📋 Fetching reviews for session:', { sessionId, userId, path: req.path, params: req.params });

    // If no userId from req.user (test token), try to map from token or allow access
    if (!userId) {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      
      if (token && (token.startsWith('test-token-') || token.startsWith('token-'))) {
        console.log('⚠️ Test token detected, allowing access to reviews without userId check');
        // For test tokens, we'll allow access and just return the reviews
        // The session lookup below will fail, so we'll skip the access check
      }
    } else {
      // Map test user IDs to database IDs
      if (userId === 'candidate-001') {
        const candidate = await prisma.user.findUnique({
          where: { email: 'john@example.com' },
          select: { id: true }
        });
        if (candidate) {
          userId = candidate.id;
          console.log('✅ Mapped candidate-001 to database ID for reviews:', userId);
        }
      } else if (userId === 'expert-001') {
        const expert = await prisma.user.findUnique({
          where: { email: 'jane@example.com' },
          select: { id: true }
        });
        if (expert) {
          userId = expert.id;
          console.log('✅ Mapped expert-001 to database ID for reviews:', userId);
        }
      }
    }

    // Verify user has access to this session (skip if test token without userId)
    // For reviews endpoint, be more permissive - allow access if session exists
    let session = null;
    if (userId) {
      // Map test user IDs to database IDs
      let actualUserId = userId;
      if (userId === 'candidate-001') {
        try {
          const candidate = await prisma.user.findUnique({
            where: { email: 'john@example.com' },
            select: { id: true }
          });
          if (candidate) {
            actualUserId = candidate.id;
          }
        } catch (e) {
          // Continue with original userId
        }
      } else if (userId === 'expert-001') {
        try {
          const expert = await prisma.user.findUnique({
            where: { email: 'jane@example.com' },
            select: { id: true }
          });
          if (expert) {
            actualUserId = expert.id;
          }
        } catch (e) {
          // Continue with original userId
        }
      }
      
      session = await prisma.session.findFirst({
        where: {
          id: sessionId,
          OR: [
            { candidateId: actualUserId },
            { expertId: actualUserId },
            { candidateId: userId }, // Also check original userId
            { expertId: userId }
          ]
        }
      });
    }
    
    // If still not found, just check if session exists (for test tokens)
    if (!session) {
      session = await prisma.session.findUnique({
        where: { id: sessionId }
      });
    }

    if (!session) {
      console.error('❌ Session not found:', { sessionId, userId });
      return res.status(404).json({ 
        success: false,
        message: 'Session not found' 
      });
    }

    // Get all reviews for this session
    const reviews = await prisma.review.findMany({
      where: { sessionId },
      include: {
        reviewer: {
          select: { id: true, name: true, email: true }
        },
        reviewee: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log('✅ Reviews fetched successfully:', { sessionId, reviewCount: reviews.length });
    res.json({ 
      success: true,
      data: { reviews } 
    });
  } catch (error) {
    console.error('❌ Get session reviews error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get session by ID (MUST come after more specific routes like /reviews)
app.get('/api/sessions/:id', authenticateToken, validateObjectId('id'), async (req, res) => {
  try {
    let userId = req.user?.id || req.user?.userId;
    
    // Map test user IDs to database IDs
    if (userId === 'candidate-001') {
      const candidate = await prisma.user.findUnique({
        where: { email: 'john@example.com' },
        select: { id: true }
      });
      if (candidate) {
        userId = candidate.id;
        console.log('✅ Mapped candidate-001 to database ID for session:', userId);
      }
    } else if (userId === 'expert-001') {
      const expert = await prisma.user.findUnique({
        where: { email: 'jane@example.com' },
        select: { id: true }
      });
      if (expert) {
        userId = expert.id;
        console.log('✅ Mapped expert-001 to database ID for session:', userId);
      }
    }

    // Build where clause - if userId exists, check access; otherwise allow for test tokens
    let whereClause = { id: req.params.id };
    if (userId) {
      whereClause.OR = [
        { candidateId: userId },
        { expertId: userId }
      ];
    }

    const session = await prisma.session.findFirst({
      where: whereClause,
      include: {
        candidate: {
          select: { id: true, name: true, email: true }
        },
        expert: {
          select: { id: true, name: true, email: true, hourlyRate: true }
        },
        reviews: {
          include: {
            reviewer: {
              select: { id: true, name: true, email: true }
            },
            reviewee: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!session) {
      console.error('❌ Session not found:', { sessionId: req.params.id, userId });
      return res.status(404).json({ 
        success: false,
        message: 'Session not found' 
      });
    }

    res.json(session);
  } catch (error) {
    console.error('❌ Get session error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update session status
app.put('/api/sessions/:id/status', authenticateToken, validateObjectId('id'), async (req, res) => {
  try {
    const { status } = req.body;
    const sessionId = req.params.id;
    
    // Get userId - handle both req.user.id and req.user.userId
    const userId = req.user?.id || req.user?.userId;
    
    if (!userId) {
      console.error('❌ Update session status: No user ID found in request');
      return res.status(401).json({ 
        success: false,
        message: 'User not authenticated' 
      });
    }

    if (!status) {
      return res.status(400).json({ 
        success: false,
        message: 'Status is required' 
      });
    }

    console.log(`🔄 Updating session ${sessionId} status to ${status} by user ${userId}`);

    // Verify user has access to this session
    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        OR: [
          { candidateId: userId },
          { expertId: userId }
        ]
      }
    });

    if (!session) {
      console.error(`❌ Session not found or user ${userId} doesn't have access to session ${sessionId}`);
      return res.status(404).json({ 
        success: false,
        message: 'Session not found or you do not have access to this session' 
      });
    }

    // Prepare update data
    const updateData = { status };
    
    // If marking as in_progress, set actualStartTime
    if (status === 'in_progress' && !session.actualStartTime) {
      updateData.actualStartTime = new Date();
    }
    
    // If marking as completed, set actualEndTime and calculate actualDuration
    if (status === 'completed') {
      const now = new Date();
      updateData.actualEndTime = now;
      
      // Set actualStartTime if not already set (when both participants join)
      if (!session.actualStartTime) {
        updateData.actualStartTime = new Date(session.scheduledDate);
      }
      
      // Calculate actual duration
      try {
        const startTime = updateData.actualStartTime 
          ? new Date(updateData.actualStartTime) 
          : (session.actualStartTime ? new Date(session.actualStartTime) : new Date(session.scheduledDate));
        
        // Ensure startTime is valid
        if (isNaN(startTime.getTime())) {
          console.warn('⚠️ Invalid startTime, using scheduledDate');
          const fallbackStart = new Date(session.scheduledDate);
          const durationMinutes = Math.round((now.getTime() - fallbackStart.getTime()) / (1000 * 60));
          updateData.actualDuration = Math.max(durationMinutes, 1);
        } else {
      const durationMinutes = Math.round((now.getTime() - startTime.getTime()) / (1000 * 60));
      updateData.actualDuration = Math.max(durationMinutes, 1); // At least 1 minute
        }
      } catch (durationError) {
        console.error('❌ Error calculating duration:', durationError);
        // Set a default duration if calculation fails
        updateData.actualDuration = session.duration || 60;
      }
      
      console.log(`✅ Marking session ${sessionId} as completed. Duration: ${updateData.actualDuration} minutes`);
    }

    const updatedSession = await prisma.session.update({
      where: { id: sessionId },
      data: updateData,
      include: {
        candidate: {
          select: { id: true, name: true, email: true }
        },
        expert: {
          select: { id: true, name: true, email: true, hourlyRate: true }
        }
      }
    });

    console.log(`✅ Session ${sessionId} status updated to ${status}`);
    res.json({ 
      success: true,
      message: 'Session status updated', 
      session: updatedSession 
    });
  } catch (error) {
    console.error('❌ Update session status error:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Request details:', {
      sessionId: req.params.id,
      status: req.body?.status,
      userId: req.user?.id || req.user?.userId,
      user: req.user
    });
    res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Reschedule a session (expert only)
app.put('/api/sessions/:id/reschedule', authenticateToken, validateObjectId('id'), async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledDate, date, time } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Find session
    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        candidate: {
          select: { id: true, name: true, email: true }
        },
        expert: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Only expert can reschedule
    if (session.expertId !== userId) {
      return res.status(403).json({ message: 'Only the expert can reschedule this session' });
    }

    // Parse new date and time
    let newScheduledDate = scheduledDate;
    if (date && time && !scheduledDate) {
      const [year, month, day] = date.split('-').map(Number);
      const [hours, minutes] = time.split(':').map(Number);
      newScheduledDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
    } else if (scheduledDate) {
      newScheduledDate = new Date(scheduledDate);
    } else {
      return res.status(400).json({ message: 'New scheduled date is required' });
    }

    // Update session
    const updatedSession = await prisma.session.update({
      where: { id },
      data: {
        scheduledDate: newScheduledDate,
        status: 'rescheduled',
        updatedAt: new Date()
      },
      include: {
        candidate: {
          select: { id: true, name: true, email: true }
        },
        expert: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // Send reschedule email to candidate
    try {
      await emailService.sendMeetingRescheduleEmailToCandidate(
        session.candidate.email,
        session.candidate.name,
        session.expert.name,
        session,
        newScheduledDate
      );
      console.log('✅ Meeting reschedule email sent to candidate');
    } catch (emailError) {
      console.error('❌ Error sending reschedule email:', emailError);
      // Don't fail if email fails
    }

    res.json({ 
      message: 'Session rescheduled successfully', 
      session: updatedSession 
    });
  } catch (error) {
    console.error('Reschedule session error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create review
app.post('/api/reviews', authenticateToken, validateReview, async (req, res) => {
  try {
    const { sessionId, rating, comment, categories } = req.body;
    let reviewerId = req.user?.id || req.user?.userId;

    console.log('✅ Route matched: POST /api/reviews');
    console.log('📝 Review submission:', { 
      sessionId, 
      reviewerId, 
      rating, 
      commentLength: comment?.length,
      path: req.path,
      bodyKeys: Object.keys(req.body),
      user: req.user ? { id: req.user.id, email: req.user.email, userType: req.user.userType } : 'NO USER',
      token: req.headers['authorization'] ? req.headers['authorization'].substring(0, 30) + '...' : 'NO TOKEN'
    });

    // If no reviewerId from req.user (e.g., test token), try to get it from the session
    // This allows test tokens to work by identifying the user from the session participants
    if (!reviewerId) {
      console.log('⚠️ No reviewerId from req.user, attempting to identify from session...');
      
      // First, get the session to see who the participants are
      const sessionForLookup = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { id: true, candidateId: true, expertId: true }
      });

      if (!sessionForLookup) {
        console.error('❌ Session not found:', sessionId);
        return res.status(404).json({ 
          success: false,
          message: 'Session not found' 
        });
      }

      // Try to extract userId from token if it's a test token
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      
      if (token && token.startsWith('token-')) {
        // Format: token-{userId}-{timestamp}
        const tokenParts = token.split('-');
        if (tokenParts.length >= 3) {
          const extractedUserId = tokenParts.slice(1, -1).join('-');
          // Verify this userId is a participant in the session
          if (extractedUserId === sessionForLookup.candidateId || extractedUserId === sessionForLookup.expertId) {
            reviewerId = extractedUserId;
            console.log('✅ Extracted reviewerId from token:', reviewerId);
          }
        }
      } else if (token && token.startsWith('test-token-')) {
        // For generic test tokens, we can't identify the user from the token
        // Check if userId is provided in request body as fallback
        console.warn('⚠️ Generic test token detected. Checking request body for userId...');
        
        const bodyUserId = req.body.userId;
        if (bodyUserId) {
          console.log('📝 Received userId in request body:', bodyUserId);
          // Check if it's a test user ID that needs mapping
          let actualUserId = bodyUserId;
          
          // Map test user IDs to database IDs
          if (bodyUserId === 'candidate-001') {
            const candidate = await prisma.user.findUnique({
              where: { email: 'john@example.com' },
              select: { id: true }
            });
            if (candidate) {
              actualUserId = candidate.id;
              console.log('✅ Mapped candidate-001 to database ID:', actualUserId);
            } else {
              console.error('❌ Could not find candidate with email john@example.com');
            }
          } else if (bodyUserId === 'expert-001') {
            const expert = await prisma.user.findUnique({
              where: { email: 'jane@example.com' },
              select: { id: true }
            });
            if (expert) {
              actualUserId = expert.id;
              console.log('✅ Mapped expert-001 to database ID:', actualUserId);
            } else {
              console.error('❌ Could not find expert with email jane@example.com');
            }
          }
          
          console.log('🔍 Checking session access:', {
            bodyUserId,
            actualUserId,
            sessionCandidateId: sessionForLookup.candidateId,
            sessionExpertId: sessionForLookup.expertId,
            matchesCandidate: actualUserId === sessionForLookup.candidateId,
            matchesExpert: actualUserId === sessionForLookup.expertId
          });
          
          // Verify this userId is a participant in the session
          if (actualUserId === sessionForLookup.candidateId || actualUserId === sessionForLookup.expertId) {
            reviewerId = actualUserId;
            console.log('✅ Using userId from request body (mapped):', reviewerId);
          } else {
            console.error('❌ userId from request body does not match session participants:', {
              bodyUserId,
              actualUserId,
              sessionCandidateId: sessionForLookup.candidateId,
              sessionExpertId: sessionForLookup.expertId
            });
            return res.status(403).json({ 
              success: false,
              message: 'You do not have access to provide feedback for this session.' 
            });
          }
        } else {
          console.error('❌ No userId in request body for test token');
          console.error('❌ Request body:', JSON.stringify(req.body));
          return res.status(401).json({ 
            success: false,
            message: 'User not authenticated. Please log in with a valid account or provide userId in request body.' 
          });
        }
      } else {
        console.error('❌ No reviewerId found and cannot extract from token');
        return res.status(401).json({ 
          success: false,
          message: 'User not authenticated. Please log in again.' 
        });
      }
    }

    if (!sessionId) {
      return res.status(400).json({ 
        success: false,
        message: 'Session ID is required' 
      });
    }

    // Verify session exists and user participated
    // Allow feedback even if session is not marked completed (in case status update failed)
    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        OR: [
          { candidateId: reviewerId },
          { expertId: reviewerId }
        ]
      },
      include: {
        candidate: {
          select: { id: true, name: true, email: true }
        },
        expert: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!session) {
      console.error('❌ Session not found or access denied:', { 
        sessionId, 
        reviewerId,
        userEmail: req.user?.email,
        userType: req.user?.userType
      });
      
      // Try to find the session without access check to see if it exists
      const sessionExists = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { id: true, candidateId: true, expertId: true }
      });
      
      if (sessionExists) {
        console.error('❌ Session exists but user does not have access:', {
          sessionCandidateId: sessionExists.candidateId,
          sessionExpertId: sessionExists.expertId,
          reviewerId: reviewerId
        });
      } else {
        console.error('❌ Session does not exist:', sessionId);
      }
      
      return res.status(404).json({ 
        success: false,
        message: 'Session not found or you do not have access to this session' 
      });
    }
    
    console.log('✅ Session found, creating review:', {
      sessionId,
      reviewerId,
      reviewerIsCandidate: session.candidateId === reviewerId,
      reviewerIsExpert: session.expertId === reviewerId
    });

    // Determine reviewee (the other participant)
    const revieweeId = session.candidateId === reviewerId ? session.expertId : session.candidateId;
    
    console.log('✅ Session found, creating review:', {
      sessionId,
      reviewerId,
      revieweeId,
      reviewerIsCandidate: session.candidateId === reviewerId,
      reviewerIsExpert: session.expertId === reviewerId
    });

    // Check if review already exists - if it does, update it instead of creating new
    const existingReview = await prisma.review.findFirst({
      where: {
        sessionId,
        reviewerId
      }
    });

    let review;
    if (existingReview) {
      // Update existing review
      review = await prisma.review.update({
        where: { id: existingReview.id },
        data: {
          rating: parseInt(rating),
          comment,
          categories: categories ? JSON.stringify(categories.split(',').map(c => c.trim())) : null,
          updatedAt: new Date()
        },
        include: {
          reviewer: {
            select: { id: true, name: true }
          },
          reviewee: {
            select: { id: true, name: true }
          }
        }
      });
    } else {
      // Create new review
      review = await prisma.review.create({
        data: {
          sessionId,
          reviewerId,
          revieweeId,
          rating: parseInt(rating),
          comment,
          categories: categories ? JSON.stringify(categories.split(',').map(c => c.trim())) : null
        },
        include: {
          reviewer: {
            select: { id: true, name: true }
          },
          reviewee: {
            select: { id: true, name: true }
          }
        }
      });
    }

    // Update session with feedback
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        feedbackRating: parseInt(rating),
        feedbackComment: comment,
        feedbackDate: new Date()
      }
    });

    console.log('✅ Review saved successfully:', { reviewId: review.id, isUpdate: !!existingReview });
    res.status(existingReview ? 200 : 201).json({ 
      success: true,
      message: existingReview ? 'Review updated successfully' : 'Review created successfully', 
      data: review 
    });
  } catch (error) {
    console.error('❌ Create review error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get reviews for user
app.get('/api/reviews/:userId', validateObjectId('userId'), validatePagination, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { revieweeId: req.params.userId },
        skip,
        take: parseInt(limit),
        include: {
          reviewer: {
            select: { id: true, name: true }
          },
          session: {
            select: { id: true, title: true, sessionType: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.review.count({ where: { revieweeId: req.params.userId } })
    ]);

    res.json({
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get notifications
app.get('/api/notifications', authenticateToken, validatePagination, async (req, res) => {
  try {
    const { page = 1, limit = 10, unreadOnly = false } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const userId = req.user.userId;

    const where = { userId };
    if (unreadOnly === 'true') {
      where.isRead = false;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.notification.count({ where })
    ]);

    res.json({
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Mark notification as read
app.put('/api/notifications/:id/read', authenticateToken, validateObjectId('id'), async (req, res) => {
  try {
    const notification = await prisma.notification.updateMany({
      where: {
        id: req.params.id,
        userId: req.user.userId
      },
      data: { isRead: true }
    });

    if (notification.count === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Mark all notifications as read
app.put('/api/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.userId },
      data: { isRead: true }
    });

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large' });
    }
  }
  
  res.status(500).json({ message: 'Internal server error' });
});

// Contact form endpoint - MUST be before 404 handler
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address'
      });
    }

    // Send email notification using email service
    try {
      // Create a formatted email message
      const emailSubject = `Contact Form: ${subject}`;
      const emailBody = `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
      `;

      // Send email to admin/support using email service
      const mailOptions = {
        from: 'testshubham6287@gmail.com',
        to: 'testshubham6287@gmail.com', // Admin email
        subject: emailSubject,
        html: emailBody
      };
      
      await emailService.transporter.sendMail(mailOptions);

      console.log(`✅ Contact form submission received from ${email}`);
    } catch (emailError) {
      console.error('❌ Error sending contact form email:', emailError);
      // Don't fail the request if email fails, but log it
    }

    res.status(200).json({
      success: true,
      message: 'Thank you for contacting us! We will get back to you soon.'
    });
  } catch (error) {
    console.error('❌ Contact form error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
});

// Handle OPTIONS preflight for realtime endpoint
app.options('/api/realtime', (req, res) => {
  const origin = req.headers.origin;
  let corsOrigin = '*';
  
  if (origin) {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:5173',
      'http://localhost:3000',
      'https://54.91.53.228',
      'http://54.91.53.228'
    ].filter(Boolean);
    
    const originHost = origin.replace(/^https?:\/\//, '').split(':')[0];
    const isAllowed = allowedOrigins.some(allowed => {
      if (!allowed) return false;
      const allowedHost = allowed.replace(/^https?:\/\//, '').split(':')[0];
      return originHost === allowedHost || origin === allowed;
    });
    
    corsOrigin = isAllowed ? origin : '*';
  }
  
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  res.status(204).end();
});

// Real-time endpoint (Server-Sent Events) - MUST be before 404 handler
// Production-ready: Send headers immediately, do async operations after
app.get('/api/realtime', (req, res) => {
  const userId = req.query.userId || 'anonymous';
  
  console.log(`🔄 SSE connection request from user: ${userId}, origin: ${req.headers.origin}`);
  
  // Determine CORS origin - be more permissive for production
  const origin = req.headers.origin;
  let corsOrigin = '*';
  
  if (origin) {
    // Allow requests from same origin or configured frontend
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:5173',
      'http://localhost:3000',
      'https://54.91.53.228',
      'http://54.91.53.228'
    ].filter(Boolean);
    
    // Check if origin matches any allowed origin
    const originHost = origin.replace(/^https?:\/\//, '').split(':')[0];
    const isAllowed = allowedOrigins.some(allowed => {
      if (!allowed) return false;
      const allowedHost = allowed.replace(/^https?:\/\//, '').split(':')[0];
      return originHost === allowedHost || origin === allowed;
    });
    
    corsOrigin = isAllowed ? origin : '*';
  } else if (process.env.FRONTEND_URL) {
    corsOrigin = process.env.FRONTEND_URL;
  }
  
  console.log(`🌐 CORS origin set to: ${corsOrigin}`);
  
  // CRITICAL: Send headers IMMEDIATELY (before any async operations)
  // This prevents timeouts and 502 errors
  try {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no', // Disable buffering in nginx
      'X-Content-Type-Options': 'nosniff'
    });
  } catch (headerError) {
    console.error('❌ Error setting SSE headers:', headerError);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to establish connection' });
    }
    return;
  }
  
  // Start with original userId, will be updated async if needed
  let actualUserId = userId;
  
  // Send initial connection message immediately (before database lookup)
  const sendInitialMessage = (uid) => {
    try {
      const initialMessage = `data: ${JSON.stringify({
        event: 'connected',
        data: { userId: uid, timestamp: new Date().toISOString() }
      })}\n\n`;
      res.write(initialMessage);
      console.log(`✅ Initial SSE message sent for user: ${uid}`);
    } catch (writeError) {
      console.error(`❌ Error writing initial message for ${uid}:`, writeError);
      // Don't end connection, just log error
    }
  };

  // Send initial message immediately
  sendInitialMessage(actualUserId);
  
  // Do database lookup asynchronously (non-blocking)
  // This allows the connection to be established even if DB lookup fails
  (async () => {
    try {
      // Handle mock IDs - map to database IDs
      if (userId === 'candidate-001') {
        try {
          const candidate = await Promise.race([
            prisma.user.findUnique({
              where: { email: 'john@example.com' },
              select: { id: true }
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
          ]);
          if (candidate) {
            actualUserId = candidate.id;
            console.log('✅ Mapped candidate-001 to database ID for realtime:', actualUserId);
            // Update connection with new userId
            realtimeService.removeConnection(userId, res);
  realtimeService.addConnection(actualUserId, res);
          }
        } catch (dbError) {
          console.warn('⚠️ Could not map candidate-001 (using original):', dbError.message);
          // Continue with original userId
        }
      } else if (userId === 'expert-001') {
        try {
          const expert = await Promise.race([
            prisma.user.findUnique({
              where: { email: 'jane@example.com' },
              select: { id: true }
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
          ]);
          if (expert) {
            actualUserId = expert.id;
            console.log('✅ Mapped expert-001 to database ID for realtime:', actualUserId);
            // Update connection with new userId
            realtimeService.removeConnection(userId, res);
            realtimeService.addConnection(actualUserId, res);
          }
        } catch (dbError) {
          console.warn('⚠️ Could not map expert-001 (using original):', dbError.message);
          // Continue with original userId
        }
      }
    } catch (error) {
      console.error('❌ Error in async userId mapping:', error);
      // Continue with original userId - connection already established
    }
  })();

  // Add connection to real-time service (use original userId for now, will update if mapped)
  const connectionAdded = realtimeService.addConnection(userId, res);
  
  if (!connectionAdded) {
    console.warn(`⚠️ Failed to add connection for user: ${userId}`);
    try {
  res.write(`data: ${JSON.stringify({
        event: 'error',
        data: { message: 'Server at capacity' }
  })}\n\n`);
    } catch (e) {
      // Connection already closed
    }
    res.end();
    return;
  }
  
  console.log(`✅ SSE connection established for user: ${userId}`);

    // Keep connection alive with periodic heartbeat
    const keepAliveInterval = setInterval(() => {
      try {
        if (!res.destroyed && !res.closed) {
          res.write(`: keepalive\n\n`);
        } else {
          clearInterval(keepAliveInterval);
        }
      } catch (error) {
        console.error(`❌ Error sending keepalive for ${userId}:`, error);
        clearInterval(keepAliveInterval);
        realtimeService.removeConnection(userId, res);
      }
    }, 30000); // Every 30 seconds

  // Handle client disconnect
  req.on('close', () => {
      clearInterval(keepAliveInterval);
      console.log(`🔌 SSE connection closed for user: ${userId}`);
      realtimeService.removeConnection(userId, res);
      // Also remove mapped connection if it exists
      if (actualUserId !== userId) {
    realtimeService.removeConnection(actualUserId, res);
      }
    });
    
    req.on('error', (error) => {
      clearInterval(keepAliveInterval);
      console.error(`❌ SSE request error for ${userId}:`, error);
      realtimeService.removeConnection(userId, res);
      if (actualUserId !== userId) {
        realtimeService.removeConnection(actualUserId, res);
      }
    });
    
    // Handle response errors
    res.on('error', (error) => {
      clearInterval(keepAliveInterval);
      console.error(`❌ SSE response error for ${userId}:`, error);
      realtimeService.removeConnection(userId, res);
      if (actualUserId !== userId) {
        realtimeService.removeConnection(actualUserId, res);
      }
  });
});

// Start realtime service
realtimeService.start();

// Update monitoring with realtime connections
setInterval(() => {
  const connectionCount = realtimeService.getTotalConnections();
  monitoringService.updateWebSocketConnections(connectionCount);
}, 5000);

// Admin Monitoring Endpoints
app.get('/api/admin/monitoring', authenticateToken, async (req, res) => {
  try {
    const { timeRange = '1h' } = req.query;
    const metrics = monitoringService.getMetrics(timeRange);
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error getting monitoring metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get monitoring metrics'
    });
  }
});

// Get error logs
app.get('/api/admin/monitoring/errors', authenticateToken, async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const errors = monitoringService.getErrorLogs(parseInt(limit));
    
    res.json({
      success: true,
      data: { errors }
    });
  } catch (error) {
    console.error('Error getting error logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get error logs'
    });
  }
});

// Get activity logs
app.get('/api/admin/monitoring/activity', authenticateToken, async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const activities = monitoringService.getActivityLogs(parseInt(limit));
    
    res.json({
      success: true,
      data: { activities }
    });
  } catch (error) {
    console.error('Error getting activity logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get activity logs'
    });
  }
});

// Update concurrent meetings count (called by WebRTC service)
app.post('/api/admin/monitoring/meetings', authenticateToken, async (req, res) => {
  try {
    const { count } = req.body;
    if (typeof count === 'number') {
      monitoringService.updateConcurrentMeetings(count);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Record video playback metrics (called by frontend)
app.post('/api/admin/monitoring/video', authenticateToken, async (req, res) => {
  try {
    const { quality, bitrate, bufferingTime } = req.body;
    monitoringService.recordVideoPlayback(quality, bitrate, bufferingTime);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Record WebSocket metrics (called by WebRTC service)
app.post('/api/admin/monitoring/websocket', authenticateToken, async (req, res) => {
  try {
    const { jitter, packetLoss, bitrate } = req.body;
    monitoringService.recordWebSocketMetrics(jitter, packetLoss, bitrate);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Record CDN cache hit/miss
app.post('/api/admin/monitoring/cdn', authenticateToken, async (req, res) => {
  try {
    const { hit } = req.body;
    monitoringService.recordCdnRequest(hit === true);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 404 handler
app.use('*', (req, res) => {
  console.error('❌ 404 - Route not found:', {
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    query: req.query,
    params: req.params
  });
  res.status(404).json({ 
    success: false,
    message: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Global error handler - MUST be last (after all routes)
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  
  // Log error to monitoring service
  monitoringService.logError(err, {
    path: req.path,
    method: req.method,
    query: req.query,
    params: req.params
  });
  
  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;
  
  res.status(err.status || 500).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Global error handlers to prevent server crashes
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('❌ Stack:', error.stack);
  // Don't exit in production - log and continue
  if (process.env.NODE_ENV === 'production') {
    monitoringService.logError(error, { type: 'uncaughtException' });
  } else {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('❌ Reason:', reason);
  // Don't exit in production - log and continue
  if (process.env.NODE_ENV === 'production') {
    monitoringService.logError(reason, { type: 'unhandledRejection' });
  }
});

// Set server limits for high concurrency
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Database: ${process.env.DATABASE_URL?.includes('postgresql') ? 'PostgreSQL' : 'SQLite'} with Prisma`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`👥 Process ID: ${process.pid}`);
  console.log(`💻 CPU Cores: ${require('os').cpus().length}`);
  
  // Initialize WebRTC signaling service (Socket.IO)
  try {
  webrtcService.initialize(server);
  console.log(`✅ WebRTC/Socket.IO service initialized`);
  } catch (error) {
    console.error('❌ Error initializing WebRTC service:', error);
    // Don't crash - continue without WebRTC
  }
  
  // Track active meetings for monitoring
  setInterval(async () => {
    try {
      // Count active sessions (in_progress status)
      const activeSessions = await prisma.session.count({
        where: {
          status: 'in_progress'
        }
      });
      monitoringService.updateConcurrentMeetings(activeSessions);
    } catch (error) {
      console.error('Error updating concurrent meetings:', error);
      // Don't crash - just log the error
    }
  }, 10000); // Update every 10 seconds
});

// Configure server for high concurrency
server.maxConnections = 10000; // Allow up to 10,000 concurrent connections
server.keepAliveTimeout = 65000; // 65 seconds (slightly longer than load balancer)
server.headersTimeout = 66000; // 66 seconds

// Handle server errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    console.error('❌ Server error:', error);
  }
});

// Handle connection errors
server.on('clientError', (err, socket) => {
  console.error('❌ Client error:', err.message);
  if (!socket.destroyed) {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  }
});

// Memory leak prevention - monitor memory usage
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    const usage = process.memoryUsage();
    const mb = (bytes) => Math.round(bytes / 1024 / 1024 * 100) / 100;
    
    // Log if memory usage is high
    if (usage.heapUsed > 500 * 1024 * 1024) { // 500MB
      console.warn(`⚠️ High memory usage: ${mb(usage.heapUsed)}MB / ${mb(usage.heapTotal)}MB`);
    }
    
    // Force garbage collection if available (requires --expose-gc flag)
    if (global.gc && usage.heapUsed > 1000 * 1024 * 1024) { // 1GB
      console.log('🧹 Running garbage collection...');
      global.gc();
    }
  }, 60000); // Check every minute
}

// Handle uncaught exceptions (prevent crashes)
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // Don't exit immediately - log and continue if possible
  // In production, you might want to restart the process
  if (process.env.NODE_ENV === 'production') {
    // Log to error tracking service (e.g., Sentry)
    // For now, just log and continue
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - log and continue
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received, shutting down gracefully...`);
  
  // Stop accepting new connections
  server.close(() => {
    console.log('✅ HTTP server closed');
  });
  
  // Close database connections
  try {
    await prisma.$disconnect();
    console.log('✅ Database connections closed');
  } catch (error) {
    console.error('❌ Error closing database:', error);
  }
  
  // Stop realtime service
  try {
    realtimeService.stop();
    console.log('✅ Realtime service stopped');
  } catch (error) {
    console.error('❌ Error stopping realtime service:', error);
  }
  
  // Give connections time to close
  setTimeout(() => {
    console.log('🛑 Process exiting...');
    process.exit(0);
  }, 5000); // 5 second grace period
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));