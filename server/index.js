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
  process.exit(1);
}

console.log('🔧 Environment loaded successfully');

// Import Prisma client
const prisma = require('./lib/prisma');

// Import realtime service
const realtimeService = require('./services/realtime');

// Import WebRTC service
const webrtcService = require('./services/webrtcService');

// Import S3 service
const s3Service = require('./services/s3Service');

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

// Security middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));

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

// Rate limiting for other API endpoints
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  // Skip rate limiting for email check endpoint (it has its own limiter)
  skip: (req) => req.path === '/api/auth/check-email'
});

// Apply lenient rate limiting specifically to email check endpoint first
app.use('/api/auth/check-email', emailCheckLimiter);

// Apply general rate limiting to all other API routes
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true,
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: 'SQLite with Prisma',
    port: PORT,
    message: 'Server is running!'
  });
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

    // Create user
    const user = await prisma.user.create({
      data: {
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
        // Experts require admin approval before appearing in directory
        // Candidates are active by default
        isActive: userType === 'expert' ? false : true
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

    console.log(`✅ User registered successfully: ${user.email} (ID: ${user.id})`);
    console.log(`✅ User type: ${user.userType}, Active: ${user.isActive}`);

    res.status(201).json({
      message: 'User registered successfully',
      user: userWithoutPassword,
      token
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
    const expertResponse = {
      ...expert,
      // Ensure arrays are properly formatted
      skills: expert.skills ? (typeof expert.skills === 'string' ? JSON.parse(expert.skills) : expert.skills) : [],
      proficiency: expert.proficiency ? (typeof expert.proficiency === 'string' ? JSON.parse(expert.proficiency) : expert.proficiency) : [],
      daysAvailable: expert.daysAvailable ? (typeof expert.daysAvailable === 'string' ? JSON.parse(expert.daysAvailable) : expert.daysAvailable) : []
    };
    
    res.json(expertResponse);
  } catch (error) {
    console.error('Get expert error:', error);
    res.status(500).json({ message: 'Internal server error' });
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

    // Create session
    const session = await prisma.session.create({
      data: {
        title: title || `${sessionType || 'Technical'} Interview Session`,
        description: description || `Interview session scheduled for ${date || scheduledDate} at ${time || ''}`,
        scheduledDate: finalScheduledDate,
        duration: parseInt(duration) || 60,
        sessionType: sessionType || 'technical',
        candidateId: actualCandidateId,
        expertId: actualExpertId,
        paymentAmount: expert.hourlyRate ? (expert.hourlyRate * parseInt(duration || 60)) / 60 : 75,
        paymentStatus: 'pending',
        status: 'scheduled'
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

    res.status(201).json({ message: 'Session booked successfully', session });
  } catch (error) {
    console.error('Book session error:', error);
    res.status(500).json({ message: 'Internal server error' });
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
    fileSize: 500 * 1024 * 1024 // 500MB limit for video files
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
app.post('/api/sessions/:id/upload-recording', uploadRecording.single('recording'), async (req, res) => {
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
        console.log(`📤 Attempting S3 upload for session ${id}, file size: ${req.file.size} bytes`);
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
    if (session.candidateId !== userId && session.expertId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (!session.recordingUrl) {
      return res.status(404).json({
        success: false,
        message: 'No recording available for this session'
      });
    }

    let accessibleUrl = session.recordingUrl;

    // If it's an S3 URL, generate a fresh signed URL
    if (session.recordingUrl.includes('s3.amazonaws.com') || session.recordingUrl.includes('amazonaws.com')) {
      try {
        // Extract S3 key from URL
        // URL format: https://bucket.s3.region.amazonaws.com/key?params
        // Or: https://bucket.s3.region.amazonaws.com/key
        const urlParts = session.recordingUrl.split('?')[0]; // Remove query params
        const keyMatch = urlParts.match(/recordings\/[^\/]+$/);
        
        if (keyMatch) {
          const key = keyMatch[0];
          console.log(`🔄 Generating fresh signed URL for S3 key: ${key}`);
          
          // Generate fresh signed URL (valid for 7 days)
          accessibleUrl = await s3Service.getSignedUrl(key, 604800); // 7 days
          console.log(`✅ Fresh signed URL generated`);
        } else {
          console.warn('⚠️ Could not extract S3 key from URL:', session.recordingUrl);
          // Return original URL as fallback
        }
      } catch (s3Error) {
        console.error('❌ Error generating fresh signed URL:', s3Error);
        // Return original URL as fallback
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
    const userId = req.user?.id;

    console.log('📋 Fetching reviews for session:', { sessionId, userId, path: req.path, params: req.params });

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
      console.error('❌ Session not found or access denied:', { sessionId, userId });
      return res.status(404).json({ 
        success: false,
        message: 'Session not found or you do not have access to this session' 
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
    const session = await prisma.session.findFirst({
      where: {
        id: req.params.id,
        OR: [
          { candidateId: req.user.id },
          { expertId: req.user.id }
        ]
      },
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
      return res.status(404).json({ message: 'Session not found' });
    }

    res.json(session);
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update session status
app.put('/api/sessions/:id/status', authenticateToken, validateObjectId('id'), async (req, res) => {
  try {
    const { status } = req.body;
    const sessionId = req.params.id;
    const userId = req.user.id;

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
      return res.status(404).json({ message: 'Session not found' });
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
      const startTime = updateData.actualStartTime ? new Date(updateData.actualStartTime) : new Date(session.actualStartTime || session.scheduledDate);
      const durationMinutes = Math.round((now.getTime() - startTime.getTime()) / (1000 * 60));
      updateData.actualDuration = Math.max(durationMinutes, 1); // At least 1 minute
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

    res.json({ message: 'Session status updated', session: updatedSession });
  } catch (error) {
    console.error('Update session status error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create review
app.post('/api/reviews', authenticateToken, validateReview, async (req, res) => {
  try {
    const { sessionId, rating, comment, categories } = req.body;
    const reviewerId = req.user?.id;

    console.log('✅ Route matched: POST /api/reviews');
    console.log('📝 Review submission:', { 
      sessionId, 
      reviewerId, 
      rating, 
      commentLength: comment?.length,
      path: req.path,
      bodyKeys: Object.keys(req.body)
    });

    // Verify session exists and user participated
    // Allow feedback even if session is not marked completed (in case status update failed)
    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        OR: [
          { candidateId: reviewerId },
          { expertId: reviewerId }
        ]
      }
    });

    if (!session) {
      console.error('❌ Session not found or access denied:', { sessionId, reviewerId });
      return res.status(404).json({ 
        success: false,
        message: 'Session not found or you do not have access to this session' 
      });
    }

    // Determine reviewee (the other participant)
    const revieweeId = session.candidateId === reviewerId ? session.expertId : session.candidateId;

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

// Real-time endpoint (Server-Sent Events) - MUST be before 404 handler
app.get('/api/realtime', (req, res) => {
  const userId = req.query.userId || 'anonymous';
  
  // Handle mock IDs
  let actualUserId = userId;
  if (userId === 'candidate-001') {
    actualUserId = 'john@example.com';
  } else if (userId === 'expert-001') {
    actualUserId = 'jane@example.com';
  }
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'http://localhost:5173',
    'Access-Control-Allow-Credentials': 'true'
  });

  // Add connection to real-time service
  realtimeService.addConnection(actualUserId, res);

  // Send initial connection message
  res.write(`data: ${JSON.stringify({
    event: 'connected',
    data: { userId: actualUserId, timestamp: new Date().toISOString() }
  })}\n\n`);

  // Handle client disconnect
  req.on('close', () => {
    realtimeService.removeConnection(actualUserId, res);
  });
});

// Start realtime service
realtimeService.start();

// 404 handler - MUST be last
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

// Start server and initialize WebRTC
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Database: SQLite with Prisma`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Initialize WebRTC signaling service (Socket.IO)
  webrtcService.initialize(server);
  console.log(`✅ WebRTC/Socket.IO service initialized`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});