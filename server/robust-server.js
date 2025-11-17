const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const config = require('./config/server');
const databaseService = require('./services/database');
const realtimeService = require('./services/realtime');
const videoService = require('./services/videoService');
const webrtcService = require('./services/webrtcService');
const s3Service = require('./services/s3Service');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticateToken } = require('./middleware/auth-prisma');
const { validateObjectId, validateReview } = require('./middleware/validation');

class RobustServer {
  constructor() {
    this.app = express();
    this.port = null;
    this.server = null;
  }

  async start() {
    try {
      console.log('🚀 Starting robust server...');
      
      // Initialize database first
      await databaseService.initialize();
      
      // Start real-time service
      realtimeService.start();
      
      // Setup middleware
      this.setupMiddleware();
      
      // Setup routes
      this.setupRoutes();
      
      // Setup real-time endpoints
      this.setupRealtime();
      
      // Find available port
      this.port = await config.getPort();
      
      // Start server (listen on all interfaces for production)
      const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
      this.server = this.app.listen(this.port, host, () => {
        console.log(`✅ Server running on http://${host}:${this.port}`);
        console.log(`✅ Health check: http://localhost:${this.port}/api/health`);
        console.log(`✅ Real-time: http://localhost:${this.port}/api/realtime`);
        console.log(`✅ CORS enabled for: ${config.cors.origin}`);
        
        // Initialize WebRTC signaling service
        webrtcService.initialize(this.server);
        
        // Update frontend configuration
        this.updateFrontendConfig();
      });

      // Handle server errors
      this.server.on('error', (err) => {
        console.error('❌ Server error:', err.message);
        if (err.code === 'EADDRINUSE') {
          console.error(`❌ Port ${this.port} is already in use`);
        }
      });

      // Graceful shutdown
      process.on('SIGINT', () => this.shutdown());
      process.on('SIGTERM', () => this.shutdown());

    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  setupMiddleware() {
    // Security headers (Helmet)
    this.app.use(helmet({
      contentSecurityPolicy: false, // Disable CSP for API (can be configured per route if needed)
      crossOriginEmbedderPolicy: false
    }));
    
    // CORS
    this.app.use(cors(config.cors));
    
    // JSON parsing with size limit (prevent DoS attacks)
    this.app.use(express.json({ limit: '10mb' }));
    
    // URL-encoded parsing for form data with size limit
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Trust proxy (required for rate limiting behind Nginx)
    // Trust only the first proxy (Nginx on localhost)
    this.app.set('trust proxy', 1);
    
    // Rate limiting for API endpoints (production-level protection)
    const apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Limit each IP to 100 requests per windowMs in production
      message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    
    // Apply rate limiting to all API routes
    this.app.use('/api/', apiLimiter);
    
    // Stricter rate limiting for auth endpoints (prevent brute force)
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: process.env.NODE_ENV === 'production' ? 5 : 50, // 5 attempts per 15 minutes in production
      message: {
        success: false,
        message: 'Too many authentication attempts, please try again later.'
      },
      skipSuccessfulRequests: true, // Don't count successful requests
    });
    
    // Apply stricter rate limiting to auth routes
    this.app.use('/api/auth/', authLimiter);
    
    // Create uploads directories if they don't exist
    const uploadsDir = path.join(__dirname, 'uploads');
    const recordingsDir = path.join(uploadsDir, 'recordings');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    if (!fs.existsSync(recordingsDir)) {
      fs.mkdirSync(recordingsDir, { recursive: true });
    }
    
    // Configure multer for file uploads with production-level security
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, uploadsDir);
      },
      filename: (req, file, cb) => {
        // Sanitize filename to prevent directory traversal attacks
        const sanitizedOriginalName = path.basename(file.originalname).replace(/[^a-zA-Z0-9.-]/g, '_');
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(sanitizedOriginalName));
      }
    });
    
    // File filter for security - only allow specific file types
    const fileFilter = (req, file, cb) => {
      const allowedMimeTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`), false);
      }
    };
    
    // Configure multer with file size limits (10MB max)
    this.maxFileSize = 10 * 1024 * 1024; // 10MB - store as instance variable for reuse
    this.upload = multer({ 
      storage: storage,
      fileFilter: fileFilter,
      limits: {
        fileSize: this.maxFileSize,
        files: 5 // Max 5 files per request
      }
    });
    
    // Serve static files from uploads directory
    this.app.use('/uploads', express.static(uploadsDir));
    
    // Request logging (production-safe)
    this.app.use((req, res, next) => {
      const isProduction = process.env.NODE_ENV === 'production';
      if (isProduction) {
        // In production, only log important requests
        if (req.path.startsWith('/api/auth/') || req.path.startsWith('/api/users/')) {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
        }
      } else {
        // In development, log all requests
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      }
      next();
    });
    
    // Global error handler for multer errors (file upload errors)
    this.app.use((error, req, res, next) => {
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File size exceeds maximum limit of 10MB'
          });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            message: 'Too many files uploaded. Maximum 5 files allowed.'
          });
        }
        return res.status(400).json({
          success: false,
          message: error.message || 'File upload error'
        });
      }
      if (error) {
        return res.status(400).json({
          success: false,
          message: error.message || 'Invalid file type or upload error'
        });
      }
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({
        success: true,
        message: 'Server is running!',
        timestamp: new Date().toISOString(),
        port: this.port,
        database: 'connected',
        realtime: realtimeService.getTotalConnections()
      });
    });

    // Check if email exists endpoint
    this.app.get('/api/auth/check-email', async (req, res) => {
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
        const isProduction = process.env.NODE_ENV === 'production';
        if (!isProduction) {
          console.error('❌ Error checking email:', error);
        }
        return res.status(500).json({ 
          exists: false,
          message: 'Error checking email availability' 
        });
      }
    });

    // Authentication endpoints
    this.app.post('/api/auth/login', async (req, res) => {
      try {
        const { email, password } = req.body;
        
        console.log('🔐 Login attempt:', { email, password: password ? '***' : 'undefined' });
        
        // For demo purposes, accept any password
        // In production, you'd verify the password hash
        let user = await databaseService.getUserByEmail(email);
        
        // If user doesn't exist, create test users on-the-fly for common test emails
        if (!user && (email === 'john@example.com' || email === 'jane@example.com')) {
          console.log('⚠️ User not found, creating test user:', email);
          try {
            const testUserData = {
              email,
              name: email === 'john@example.com' ? 'John Doe' : 'Jane Smith',
              password: 'hashed_' + Date.now(), // Placeholder hash
              userType: email === 'john@example.com' ? 'candidate' : 'expert',
              company: email === 'john@example.com' ? 'Tech Corp' : 'Google',
              title: email === 'john@example.com' ? 'Software Engineer' : 'Senior Software Engineer',
            };
            
            user = await prisma.user.create({
              data: testUserData
            });
            console.log('✅ Test user created:', user.id);
          } catch (createError) {
            console.error('❌ Error creating test user:', createError);
            // If creation fails, continue with 401
          }
        }
        
        if (!user) {
          console.log('❌ Login failed: User not found for:', email);
          return res.status(401).json({
            success: false,
            message: 'Invalid credentials',
            error: 'User not found'
          });
        }
        
        if (!password) {
          console.log('❌ Login failed: No password provided for:', email);
          return res.status(401).json({
            success: false,
            message: 'Invalid credentials',
            error: 'Password required'
          });
        }
        
        console.log('✅ Login successful for:', email);
        
        // Return full user data (excluding password)
        const { password: _, ...userWithoutPassword } = user;
        
        // Generate a simple token (not JWT for now, just a string token)
        const token = 'token-' + user.id + '-' + Date.now();
        
        res.json({
          success: true,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            userType: user.userType,
            bio: user.bio,
            experience: user.experience,
            skills: user.skills ? (typeof user.skills === 'string' ? JSON.parse(user.skills) : user.skills) : [],
            rating: user.rating,
            totalSessions: user.totalSessions,
            hourlyRate: user.hourlyRate,
            isVerified: user.isVerified,
            avatar: user.avatar,
            company: user.company,
            title: user.title
          },
          token: token
        });
      } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
          success: false,
          message: 'Internal server error',
          error: error.message
        });
      }
    });

    // Registration endpoint
    this.app.post('/api/auth/register', this.upload.fields([
      { name: 'resume', maxCount: 1 },
      { name: 'profilePhoto', maxCount: 1 },
      { name: 'expertProfilePhoto', maxCount: 1 },
      { name: 'certification_0', maxCount: 1 },
      { name: 'certification_1', maxCount: 1 },
      { name: 'certification_2', maxCount: 1 }
    ]), async (req, res) => {
      try {
        const isProduction = process.env.NODE_ENV === 'production';
        
        // Production-safe logging (don't log sensitive data)
        if (isProduction) {
          console.log('📝 Registration request received');
        } else {
          console.log('📝 Registration request received');
          console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
          console.log('📝 Files:', req.files ? Object.keys(req.files) : 'No files');
        }
        
        const { email, password, name, userType, role, phone, company, title, bio, experience, skills, yearsOfExperience, proficiency, hourlyRate, expertBio, expertSkills, currentRole } = req.body;

        // Use userType if provided, otherwise fall back to role
        const finalUserType = userType || role;

        // Production-level input validation
        if (!email || !password || !name || !finalUserType) {
          if (!isProduction) {
            console.error('❌ Missing required fields:', { email: !!email, password: !!password, name: !!name, userType: !!finalUserType, role: !!role });
          }
          return res.status(400).json({ 
            success: false,
            message: 'Missing required fields: email, password, name, and userType (or role) are required' 
          });
        }

        // Sanitize and validate email
        const sanitizedEmail = email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(sanitizedEmail) || sanitizedEmail.length > 255) {
          return res.status(400).json({ 
            success: false,
            message: 'Invalid email format' 
          });
        }

        // Production-level password validation
        if (password.length < 8) {
          return res.status(400).json({ 
            success: false,
            message: 'Password must be at least 8 characters' 
          });
        }
        
        if (password.length > 128) {
          return res.status(400).json({ 
            success: false,
            message: 'Password must be less than 128 characters' 
          });
        }

        // Validate password strength (at least one uppercase, one lowercase, one number)
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
        if (!passwordRegex.test(password)) {
          return res.status(400).json({ 
            success: false,
            message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' 
          });
        }

        // Sanitize and validate name
        const sanitizedName = name.trim();
        if (sanitizedName.length < 2 || sanitizedName.length > 100) {
          return res.status(400).json({ 
            success: false,
            message: 'Name must be between 2 and 100 characters' 
          });
        }

        // Validate userType
        if (!['candidate', 'expert', 'admin'].includes(finalUserType)) {
          return res.status(400).json({ 
            success: false,
            message: 'Invalid user type' 
          });
        }

        // Check if user already exists (use sanitized email)
        const existingUser = await prisma.user.findUnique({
          where: { email: sanitizedEmail }
        });

        if (existingUser) {
          if (!isProduction) {
            console.error(`❌ User already exists: ${sanitizedEmail}`);
          }
          return res.status(400).json({ 
            success: false,
            message: 'This email already exists. Please use a different email.' 
          });
        }

        // Hash password with production-level security (bcrypt rounds: 12 for production)
        const bcryptRounds = isProduction ? 12 : 10;
        const hashedPassword = await bcrypt.hash(password, bcryptRounds);

        // Handle file uploads with validation
        const resumePath = req.files?.resume?.[0]?.filename;
        const profilePhotoPath = req.files?.profilePhoto?.[0]?.filename || req.files?.expertProfilePhoto?.[0]?.filename;
        
        // Validate profile photo is required
        if (!profilePhotoPath) {
          if (!isProduction) {
            console.error('❌ Profile photo is required');
          }
          return res.status(400).json({ 
            success: false,
            message: 'Profile photo is required' 
          });
        }
        
        const certificationPaths = [];
        
        // Validate and handle multiple certification files
        for (let i = 0; i < 3; i++) {
          const certFile = req.files?.[`certification_${i}`]?.[0];
          if (certFile) {
            // Additional validation: check file size (already limited by multer, but double-check)
            if (certFile.size > this.maxFileSize) {
              return res.status(400).json({
                success: false,
                message: `File ${certFile.originalname} exceeds maximum size of 10MB`
              });
            }
            certificationPaths.push(certFile.filename);
          }
        }

        // Parse and sanitize skills and proficiency - store as JSON strings for SQLite
        let skillsJson = null;
        if (skills) {
          const skillsArray = typeof skills === 'string' 
            ? skills.split(',').map(s => s.trim().substring(0, 50)).filter(s => s.length > 0)
            : skills.map(s => String(s).trim().substring(0, 50)).filter(s => s.length > 0);
          // Limit to 20 skills max
          skillsJson = JSON.stringify(skillsArray.slice(0, 20));
        }
        
        let proficiencyJson = null;
        if (proficiency) {
          try {
            let proficiencyArray;
            if (typeof proficiency === 'string') {
              proficiencyArray = JSON.parse(proficiency);
            } else {
              proficiencyArray = proficiency;
            }
            // Sanitize and limit proficiency items
            proficiencyArray = Array.isArray(proficiencyArray)
              ? proficiencyArray.map(p => String(p).trim().substring(0, 100)).filter(p => p.length > 0).slice(0, 20)
              : [String(proficiency).trim().substring(0, 100)];
            proficiencyJson = JSON.stringify(proficiencyArray);
          } catch (e) {
            if (!isProduction) {
              console.warn('Failed to parse proficiency:', e);
            }
            proficiencyJson = JSON.stringify([String(proficiency).trim().substring(0, 100)]);
          }
        }
        
        // Sanitize text fields (prevent XSS and limit length)
        const sanitizeText = (text, maxLength = 1000) => {
          if (!text) return null;
          return String(text).trim().substring(0, maxLength);
        };

        // Validate and sanitize hourly rate
        let sanitizedHourlyRate = null;
        if (hourlyRate) {
          const parsedRate = parseFloat(hourlyRate);
          if (!isNaN(parsedRate) && parsedRate >= 0 && parsedRate <= 10000) {
            sanitizedHourlyRate = Math.round(parsedRate * 100) / 100; // Round to 2 decimal places
          }
        }

        // Create user with sanitized data
        const user = await prisma.user.create({
          data: {
            email: sanitizedEmail,
            password: hashedPassword,
            name: sanitizedName,
            userType: finalUserType,
            phone: phone ? sanitizeText(phone, 20) : null,
            company: company ? sanitizeText(company, 100) : null,
            title: title ? sanitizeText(title, 100) : null,
            bio: sanitizeText(bio || expertBio, 2000),
            experience: sanitizeText(experience || yearsOfExperience, 500),
            skills: skillsJson,
            proficiency: proficiencyJson,
            hourlyRate: sanitizedHourlyRate,
            resumePath: resumePath || null,
            profilePhotoPath: profilePhotoPath || null,
            certificationPaths: certificationPaths.length > 0 ? JSON.stringify(certificationPaths) : null,
            // Experts require admin approval before appearing in directory
            // Candidates are active by default
            isActive: userType === 'expert' ? false : true
          }
        });

        // Generate JWT token - require JWT_SECRET in production
        const JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET || (isProduction && JWT_SECRET === 'your-super-secret-jwt-key-change-this-in-production')) {
          console.error('❌ JWT_SECRET not properly configured');
          return res.status(500).json({
            success: false,
            message: 'Server configuration error'
          });
        }
        
        const token = jwt.sign(
          { userId: user.id, email: user.email, userType: user.userType },
          JWT_SECRET,
          { expiresIn: isProduction ? '7d' : '30d' } // Shorter expiration in production
        );

        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;

        // Production-safe logging
        if (isProduction) {
          console.log(`✅ User registered successfully: ${user.id} (${user.userType})`);
        } else {
          console.log(`✅ User registered successfully: ${user.email} (ID: ${user.id})`);
          console.log(`✅ User type: ${user.userType}, Active: ${user.isActive}`);
        }

        res.status(201).json({
          success: true,
          message: 'User registered successfully',
          user: userWithoutPassword,
          token
        });
      } catch (error) {
        const isProduction = process.env.NODE_ENV === 'production';
        
        // Handle specific error types
        if (error.code === 'P2002') {
          // Prisma unique constraint violation
          return res.status(400).json({
            success: false,
            message: 'Registration failed. Please check your information and try again.'
          });
        }
        
        // Log error details (more verbose in development)
        if (isProduction) {
          console.error('❌ Registration error:', error.message);
        } else {
          console.error('❌ Registration error:', error);
          console.error('❌ Error stack:', error.stack);
        }
        
        res.status(500).json({ 
          success: false,
          message: 'Internal server error',
          error: isProduction ? undefined : error.message
        });
      }
    });

    // Profile update endpoint (authenticated users can update their own profile)
    this.app.put('/api/users/profile', this.upload.single('profilePhoto'), async (req, res) => {
      try {
        const isProduction = process.env.NODE_ENV === 'production';
        
        if (!isProduction) {
          console.log('📝 Profile update request received');
        }
        
        // Get user ID from token
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }

        // Verify JWT token - require JWT_SECRET in production
        let userId;
        try {
          const JWT_SECRET = process.env.JWT_SECRET;
          if (!JWT_SECRET || (isProduction && JWT_SECRET === 'your-super-secret-jwt-key-change-this-in-production')) {
            console.error('❌ JWT_SECRET not properly configured');
            return res.status(500).json({
              success: false,
              message: 'Server configuration error'
            });
          }
          
          const decoded = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId;
          
          if (!isProduction) {
            console.log(`✅ Authenticated user ID: ${userId}`);
          }
        } catch (tokenError) {
          if (!isProduction) {
            console.error('❌ Token verification failed:', tokenError);
          }
          return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
          });
        }

        const { name, bio, experience, skills, hourlyRate, company, title, timezone, workingHoursStart, workingHoursEnd, daysAvailable } = req.body;

        // Sanitize helper function
        const sanitizeText = (text, maxLength = 1000) => {
          if (!text) return null;
          return String(text).trim().substring(0, maxLength);
        };

        const updateData = {};
        
        // Sanitize and validate all fields
        if (name) {
          const sanitizedName = sanitizeText(name, 100);
          if (sanitizedName && sanitizedName.length >= 2) {
            updateData.name = sanitizedName;
          }
        }
        
        if (bio) updateData.bio = sanitizeText(bio, 2000);
        if (experience) updateData.experience = sanitizeText(experience, 500);
        
        if (skills) {
          const skillsArray = typeof skills === 'string' 
            ? skills.split(',').map(s => s.trim().substring(0, 50)).filter(s => s.length > 0)
            : skills.map(s => String(s).trim().substring(0, 50)).filter(s => s.length > 0);
          updateData.skills = JSON.stringify(skillsArray.slice(0, 20));
        }
        
        if (hourlyRate) {
          const parsedRate = parseFloat(hourlyRate);
          if (!isNaN(parsedRate) && parsedRate >= 0 && parsedRate <= 10000) {
            updateData.hourlyRate = Math.round(parsedRate * 100) / 100;
          }
        }
        
        if (company) updateData.company = sanitizeText(company, 100);
        if (title) updateData.title = sanitizeText(title, 100);
        
        // Validate timezone (basic check)
        if (timezone && typeof timezone === 'string' && timezone.length <= 50) {
          updateData.timezone = timezone.trim();
        }
        
        // Validate time format (HH:MM)
        const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
        if (workingHoursStart && timeRegex.test(workingHoursStart)) {
          updateData.workingHoursStart = workingHoursStart;
        }
        if (workingHoursEnd && timeRegex.test(workingHoursEnd)) {
          updateData.workingHoursEnd = workingHoursEnd;
        }
        
        if (daysAvailable) {
          try {
            const daysArray = typeof daysAvailable === 'string' 
              ? JSON.parse(daysAvailable)
              : daysAvailable;
            if (Array.isArray(daysArray)) {
              const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
              const sanitizedDays = daysArray
                .filter(day => validDays.includes(String(day).toLowerCase()))
                .map(day => String(day).toLowerCase());
              updateData.daysAvailable = JSON.stringify(sanitizedDays);
            }
          } catch (e) {
            // Invalid JSON, skip
          }
        }

        if (req.file) {
          // Validate file size
          if (req.file.size > this.maxFileSize) {
            return res.status(400).json({
              success: false,
              message: 'File size exceeds maximum limit of 10MB'
            });
          }
          updateData.profilePhotoPath = req.file.filename;
        }

        // Only log in development
        if (!isProduction) {
          console.log(`📝 Updating profile for user: ${userId}`);
          console.log(`📝 Update data:`, JSON.stringify(updateData, null, 2));
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

        if (!isProduction) {
          console.log(`✅ Profile updated successfully for user: ${user.email}`);
        }

        res.json({ 
          success: true,
          message: 'Profile updated successfully', 
          user 
        });
      } catch (error) {
        const isProduction = process.env.NODE_ENV === 'production';
        
        // Handle specific error types
        if (error.code === 'P2025') {
          // Prisma record not found
          return res.status(404).json({
            success: false,
            message: 'User not found'
          });
        }
        
        // Log error (more verbose in development)
        if (isProduction) {
          console.error('❌ Update profile error:', error.message);
        } else {
          console.error('❌ Update profile error:', error);
          console.error('❌ Error stack:', error.stack);
        }
        
        res.status(500).json({ 
          success: false,
          message: 'Internal server error',
          error: isProduction ? undefined : error.message
        });
      }
    });

    this.app.get('/api/auth/me', async (req, res) => {
      try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return res.status(401).json({
            success: false,
            message: 'No token provided'
          });
        }

        // For demo purposes, try to get user from email stored in localStorage
        // In production, you'd verify the JWT token and get the user from it
        // For now, we'll check if there's a user email in the request body or query
        // This is a simplified version - in production use proper JWT verification
        
        // Try to get user from the most recent login (stored in a simple way)
        // For now, return 401 - the frontend will handle login
        // But we can also check if there's an email in the request
        const email = req.query.email || req.body.email;
        
        if (email) {
          const user = await databaseService.getUserByEmail(email);
          if (user) {
            const { password, ...userWithoutPassword } = user;
            return res.json({
              success: true,
              data: userWithoutPassword
            });
          }
        }

        // If no email provided, return 401
        res.status(401).json({
          success: false,
          message: 'Please login'
        });
      } catch (error) {
        console.error('Auth error:', error);
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }
    });

    // Get session by meeting ID (for meeting page access)
    this.app.get('/api/sessions/meeting/:meetingId', async (req, res) => {
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
          console.log('No session found for meetingId:', meetingId);
          // Log all meetingIds in database for debugging
          const allSessions = await prisma.session.findMany({
            select: { id: true, meetingId: true, meetingLink: true }
          });
          console.log('All sessions in database:', allSessions.map(s => ({
            id: s.id,
            meetingId: s.meetingId,
            meetingLink: s.meetingLink
          })));
          
          return res.status(404).json({
            success: false,
            message: 'Session not found for this meeting ID',
            debug: {
              requestedMeetingId: meetingId,
              availableSessions: allSessions.length
            }
          });
        }

        // Debug: Log session data to see what we have
        console.log('Session found:', {
          id: session.id,
          expertId: session.expertId,
          candidateId: session.candidateId,
          expert: session.expert ? { id: session.expert.id, name: session.expert.name } : null,
          candidate: session.candidate ? { id: session.candidate.id, name: session.candidate.name } : null,
          scheduledDate: session.scheduledDate
        });

        // Format session to match frontend expectations
        // Handle cases where scheduledDate might be null
        let dateStr = '';
        let timeStr = '';
        let scheduledDateISO = null;
        
        if (session.scheduledDate) {
          const localDate = new Date(session.scheduledDate);
          const year = localDate.getFullYear();
          const month = String(localDate.getMonth() + 1).padStart(2, '0');
          const day = String(localDate.getDate()).padStart(2, '0');
          dateStr = `${year}-${month}-${day}`;
          const hours = String(localDate.getHours()).padStart(2, '0');
          const minutes = String(localDate.getMinutes()).padStart(2, '0');
          timeStr = `${hours}:${minutes}`;
          scheduledDateISO = session.scheduledDate.toISOString();
        }

        const formattedSession = {
          id: session.id,
          expertId: session.expertId || null,
          candidateId: session.candidateId || null,
          expertName: session.expert?.name || null,
          candidateName: session.candidate?.name || null,
          expertEmail: session.expert?.email || null,
          candidateEmail: session.candidate?.email || null,
          date: dateStr || null,
          time: timeStr || null,
          scheduledDate: scheduledDateISO,
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

        console.log('Formatted session being sent:', {
          id: formattedSession.id,
          expertId: formattedSession.expertId,
          candidateId: formattedSession.candidateId,
          expertName: formattedSession.expertName,
          candidateName: formattedSession.candidateName
        });

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

    // Sessions endpoints
    this.app.get('/api/sessions', async (req, res) => {
      try {
        const { userId, userType, limit } = req.query;
        
        console.log('Fetching sessions for:', { userId, userType, limit });
        
        // If no userId provided, return empty sessions (frontend will handle it)
        if (!userId) {
          return res.json({
            success: true,
            sessions: [],
            total: 0
          });
        }
        
        const targetUserType = userType || 'candidate';
        
        const sessions = await databaseService.getSessionsForUser(userId, targetUserType);
        
        console.log('Found sessions in database:', sessions.length);
        
        // Format sessions to match frontend expectations
        const formattedSessions = sessions.map(session => {
          // Get the date in local timezone (not UTC)
          const localDate = new Date(session.scheduledDate);
          const year = localDate.getFullYear();
          const month = String(localDate.getMonth() + 1).padStart(2, '0');
          const day = String(localDate.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;
          
          // Get the time in local timezone (HH:mm format)
          const hours = String(localDate.getHours()).padStart(2, '0');
          const minutes = String(localDate.getMinutes()).padStart(2, '0');
          const timeStr = `${hours}:${minutes}`;
          
          return {
            id: session.id,
            expertId: session.expertId,
            candidateId: session.candidateId,
            expertName: session.expert.name,
            candidateName: session.candidate.name,
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
        console.error('Error fetching sessions:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch sessions',
          message: error.message
        });
      }
    });

    this.app.post('/api/sessions', async (req, res) => {
      try {
        // Log token if provided (for debugging)
        const authHeader = req.headers.authorization;
        if (authHeader) {
          const token = authHeader.replace('Bearer ', '');
          console.log('🔑 Token received:', token.substring(0, 30) + '...');
        } else {
          console.log('⚠️ No token in request headers');
        }
        
        const { expertId, candidateId, date, time, duration, sessionType } = req.body;
        
        console.log('📅 Creating session:', { expertId, candidateId, date, time, duration, sessionType });
        
        // Validate that expert and candidate exist
        let expert = null;
        let candidate = null;
        
        // Try to find by ID first
        if (expertId) {
          expert = await prisma.user.findUnique({ where: { id: expertId } });
        }
        if (candidateId) {
          candidate = await prisma.user.findUnique({ where: { id: candidateId } });
        }
        
        // If not found by ID and looks like email, try email
        if (!expert && typeof expertId === 'string' && expertId.includes('@')) {
          expert = await databaseService.getUserByEmail(expertId);
        }
        if (!candidate && typeof candidateId === 'string' && candidateId.includes('@')) {
          candidate = await databaseService.getUserByEmail(candidateId);
        }
        
        // Handle mock expert IDs (map to real database experts)
        if (!expert && expertId === 'expert-001') {
          expert = await databaseService.getUserByEmail('jane@example.com');
        }
        
        // Handle mock candidate IDs (map to real database candidates)
        if (!candidate && candidateId === 'candidate-001') {
          candidate = await databaseService.getUserByEmail('john@example.com');
        }
        
        if (!expert || expert.userType !== 'expert') {
          console.error('❌ Expert not found:', expertId, 'expert:', expert);
          return res.status(400).json({
            success: false,
            error: 'Invalid expert ID',
            message: 'Expert not found'
          });
        }
        
        // Check if expert is approved (isActive) before allowing booking
        if (!expert.isActive) {
          console.error('❌ Expert not approved:', expertId, 'expert:', expert.name);
          return res.status(403).json({
            success: false,
            error: 'Expert not approved',
            message: 'This expert profile is pending admin approval and cannot be booked yet. Please check back later.'
          });
        }
        
        if (!candidate || candidate.userType !== 'candidate') {
          console.error('❌ Candidate not found:', candidateId, 'candidate:', candidate);
          return res.status(400).json({
            success: false,
            error: 'Invalid candidate ID',
            message: 'Candidate not found'
          });
        }
        
        // Use the actual database IDs
        const actualExpertId = expert.id;
        const actualCandidateId = candidate.id;
        
        // Create session in database
        // Parse date and time as local time (not UTC)
        const [year, month, day] = date.split('-').map(Number);
        const [hours, minutes] = time.split(':').map(Number);
        const scheduledDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
        const sessionDuration = duration || 60;
        
        // Check for scheduling conflicts before creating the session
        console.log('🔍 Checking for scheduling conflicts...');
        const conflict = await databaseService.checkSchedulingConflict(
          actualExpertId,
          scheduledDate,
          sessionDuration
        );
        
        if (conflict) {
          const conflictSession = conflict.session;
          const conflictStart = new Date(conflictSession.scheduledDate);
          const conflictEnd = new Date(conflictStart.getTime() + conflictSession.duration * 60 * 1000);
          
          console.log('❌ Scheduling conflict detected:', {
            expertId: actualExpertId,
            requestedTime: scheduledDate.toISOString(),
            conflictingSession: {
              id: conflictSession.id,
              start: conflictStart.toISOString(),
              end: conflictEnd.toISOString(),
              candidate: conflictSession.candidate?.name || 'Unknown'
            }
          });
          
          return res.status(409).json({
            success: false,
            error: 'Scheduling conflict',
            message: `This time slot is already booked. The expert has a session from ${conflictStart.toLocaleString()} to ${conflictEnd.toLocaleString()}. Please choose a different time.`,
            conflict: {
              existingSessionId: conflictSession.id,
              existingStartTime: conflictStart.toISOString(),
              existingEndTime: conflictEnd.toISOString(),
              existingCandidate: conflictSession.candidate?.name || 'Unknown',
              requestedStartTime: scheduledDate.toISOString(),
              requestedEndTime: new Date(scheduledDate.getTime() + sessionDuration * 60 * 1000).toISOString()
            }
          });
        }
        
        console.log('✅ No scheduling conflicts found');
        
        // Create video meeting (Zoom or Google Meet)
        let meetingInfo;
        try {
          meetingInfo = await videoService.createMeeting({
            title: `${sessionType || 'Technical'} Interview Session`,
            description: `Interview session scheduled for ${date} at ${time}`,
            scheduledDate: scheduledDate,
            duration: duration || 60
          });
        } catch (error) {
          console.error('Error creating meeting:', error);
          // Fallback to WebRTC meeting if video service fails
          meetingInfo = {
            meetingId: `meet-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            meetingLink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/meeting/meet-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            startUrl: null,
            password: null,
            recordingUrl: null
          };
        }
        
        // Ensure meetingLink and meetingId are strings (not undefined)
        const meetingLink = meetingInfo?.meetingLink || null;
        const meetingId = meetingInfo?.meetingId || null;
        
        const sessionData = {
          title: `${sessionType || 'Technical'} Interview Session`,
          description: `Interview session scheduled for ${date} at ${time}`,
          scheduledDate: scheduledDate,
          duration: sessionDuration,
          sessionType: sessionType || 'technical',
          status: 'scheduled',
          candidateId: actualCandidateId,
          expertId: actualExpertId,
          paymentAmount: 75,
          paymentStatus: 'pending',
          meetingLink: meetingLink,
          meetingId: meetingId,
          isRecordingEnabled: true
        };

        console.log('Attempting to create session with data:', JSON.stringify(sessionData, null, 2));
        
        const newSession = await databaseService.createSession(sessionData);
        
        console.log('Session created in database:', newSession.id);
        console.log('Scheduled date stored:', newSession.scheduledDate);
        
        // Notify real-time clients
        realtimeService.notifyNewSession(candidateId, newSession);
        realtimeService.notifyNewSession(expertId, newSession);
        
        // Format response with proper date/time extraction
        const localDate = new Date(newSession.scheduledDate);
        const responseDate = `${String(localDate.getFullYear())}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
        const responseTime = `${String(localDate.getHours()).padStart(2, '0')}:${String(localDate.getMinutes()).padStart(2, '0')}`;
        
        const formattedSession = {
          id: newSession.id,
          expertId: newSession.expertId,
          candidateId: newSession.candidateId,
          expertName: newSession.expert.name,
          candidateName: newSession.candidate.name,
          date: responseDate,
          time: responseTime,
          scheduledDate: newSession.scheduledDate.toISOString(),
          duration: newSession.duration,
          sessionType: newSession.sessionType,
          status: newSession.status,
          paymentAmount: newSession.paymentAmount,
          paymentStatus: newSession.paymentStatus,
          meetingLink: newSession.meetingLink,
          meetingId: newSession.meetingId,
          recordingUrl: newSession.recordingUrl,
          isRecordingEnabled: newSession.isRecordingEnabled,
          createdAt: newSession.createdAt.toISOString()
        };
        
        res.json({
          success: true,
          data: formattedSession,
          message: 'Session created successfully'
        });
      } catch (error) {
        console.error('❌ Error creating session:', error);
        console.error('Error stack:', error.stack);
        console.error('Error details:', {
          message: error.message,
          code: error.code,
          meta: error.meta
        });
        res.status(500).json({
          success: false,
          error: 'Failed to create session',
          message: error.message || 'Unknown error occurred',
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
    });

    // Get reviews for a session (MUST come before /api/sessions/:id to avoid route conflicts)
    this.app.get('/api/sessions/:sessionId/reviews', authenticateToken, ...validateObjectId('sessionId'), async (req, res) => {
      console.log('✅✅✅ Route matched: GET /api/sessions/:sessionId/reviews');
      try {
        const sessionId = req.params.sessionId;
        const userId = req.user?.id;

        console.log('📋 Fetching reviews for session:', { sessionId, userId });

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

    // Get session by ID (MUST come after /api/sessions/:sessionId/reviews to avoid route conflicts)
    this.app.get('/api/sessions/:id', authenticateToken, ...validateObjectId('id'), async (req, res) => {
      console.log('✅ Route matched: GET /api/sessions/:id');
      try {
        const sessionId = req.params.id;
        const userId = req.user?.id;

        console.log('📋 Fetching session by ID:', { sessionId, userId });

        // Verify user has access to this session
        const session = await prisma.session.findFirst({
          where: {
            id: sessionId,
            OR: [
              { candidateId: userId },
              { expertId: userId }
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
          console.error('❌ Session not found or access denied:', { sessionId, userId });
          return res.status(404).json({
            success: false,
            message: 'Session not found or you do not have access to this session'
          });
        }

        console.log('✅ Session fetched successfully:', { sessionId });
        res.json({
          success: true,
          data: session
        });
      } catch (error) {
        console.error('❌ Get session error:', error);
        res.status(500).json({
          success: false,
          message: 'Internal server error',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    });

    // Create review
    this.app.post('/api/reviews', authenticateToken, ...validateReview, async (req, res) => {
      console.log('✅ Route matched: POST /api/reviews');
      try {
        const { sessionId, rating, comment, categories } = req.body;
        const reviewerId = req.user?.id;

        console.log('📝 Review submission:', { sessionId, reviewerId, rating, commentLength: comment?.length });

        // Verify session exists and user participated
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

    // Get expert by ID endpoint (CRITICAL: Must be before /api/experts to avoid route conflict)
    this.app.get('/api/experts/:id', async (req, res) => {
      try {
        const expertId = req.params.id;
        const isProduction = process.env.NODE_ENV === 'production';
        
        // Basic validation - ensure ID is provided
        if (!expertId || expertId.trim() === '') {
          return res.status(400).json({ 
            success: false,
            message: 'Expert ID is required' 
          });
        }

        // Check if user is authenticated and viewing their own profile
        let isOwnProfile = false;
        let authenticatedUserId = null;
        
        try {
          // Try to authenticate the request (optional - won't fail if no token)
          const authHeader = req.headers.authorization;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const JWT_SECRET = process.env.JWT_SECRET;
            if (JWT_SECRET && JWT_SECRET !== 'your-super-secret-jwt-key-change-this-in-production') {
              const decoded = jwt.verify(token, JWT_SECRET);
              authenticatedUserId = decoded.userId;
              isOwnProfile = authenticatedUserId === expertId;
              if (!isProduction) {
                console.log(`🔍 Expert lookup: ID=${expertId}, Authenticated=${!!authenticatedUserId}, OwnProfile=${isOwnProfile}`);
              }
            }
          }
        } catch (authError) {
          // If authentication fails, continue without it (public access)
          // This allows viewing expert profiles without login
          if (!isProduction) {
            console.log(`🔍 Expert lookup (public): ID=${expertId}`);
          }
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

        if (!isProduction) {
          console.log(`🔍 Searching for expert with where clause:`, JSON.stringify(whereClause));
        }

        const expert = await prisma.user.findFirst({
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
            isActive: true
          }
        });

        // If expert not found, provide detailed error information
        if (!expert) {
          if (!isProduction) {
            console.error(`❌ Expert not found: ID=${expertId}, isOwnProfile=${isOwnProfile}, whereClause=`, whereClause);
          }
          
          // Check if this looks like a frontend-generated ID
          const isFrontendGeneratedId = /^user-\d+$/.test(expertId);
          
          // Try to find the user without the isActive filter to see if they exist
          const userExists = await prisma.user.findFirst({
            where: { id: expertId, userType: 'expert' },
            select: { id: true, isActive: true, userType: true }
          });
          
          let errorMessage = 'Expert not found';
          if (userExists) {
            if (!isProduction) {
              console.error(`⚠️ User exists but doesn't match criteria: isActive=${userExists.isActive}, userType=${userExists.userType}`);
            }
            if (!userExists.isActive && !isOwnProfile) {
              errorMessage = 'Expert profile is not active';
            }
          } else {
            // Check if user exists with different userType
            const anyUser = await prisma.user.findFirst({
              where: { id: expertId },
              select: { id: true, userType: true, isActive: true }
            });
            if (anyUser) {
              if (!isProduction) {
                console.error(`⚠️ User exists but is not an expert: userType=${anyUser.userType}`);
              }
              errorMessage = `User found but is not an expert (userType: ${anyUser.userType})`;
            } else {
              if (!isProduction) {
                console.error(`⚠️ User with ID ${expertId} does not exist in database`);
              }
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

        if (!isProduction) {
          console.log(`✅ Expert found: ${expert.name} (ID: ${expert.id})`);
        }
        
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
        const isProduction = process.env.NODE_ENV === 'production';
        if (isProduction) {
          console.error('❌ Get expert error:', error.message);
        } else {
          console.error('❌ Get expert error:', error);
          console.error('❌ Error stack:', error.stack);
        }
        res.status(500).json({ 
          success: false,
          message: 'Internal server error',
          error: isProduction ? undefined : error.message
        });
      }
    });

    // Experts endpoint (list all experts)
    this.app.get('/api/experts', async (req, res) => {
      try {
        const { page = 1, limit = 10, search = '', skills = '', minRating = 0 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = {
          userType: 'expert',
          isActive: true
        };
        
        // Only filter by rating if minRating is provided and > 0
        // This ensures new experts (with null or 0 rating) are included by default
        const minRatingValue = parseFloat(minRating);
        if (minRatingValue > 0) {
          // When filtering by rating, include both rated experts and null ratings
          // SQLite handles null comparisons differently, so we use OR
          where.OR = [
            { rating: { gte: minRatingValue } },
            { rating: null }
          ];
        }
        // If minRating is 0 or not provided, don't filter by rating (include all)

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

        // Merge OR conditions properly
        if (orConditions.length > 0) {
          if (where.OR && minRatingValue > 0) {
            // We have both rating OR and search/skills OR - need to combine with AND
            where.AND = [
              { OR: where.OR }, // Rating conditions
              { OR: orConditions } // Search/skills conditions
            ];
            delete where.OR;
          } else {
            // Only search/skills OR conditions
            where.OR = orConditions;
          }
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
        success: true,
          data: {
            experts,
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total,
              pages: Math.ceil(total / parseInt(limit))
            }
          }
        });
      } catch (error) {
        const isProduction = process.env.NODE_ENV === 'production';
        if (isProduction) {
          console.error('❌ Get experts error:', error.message);
        } else {
          console.error('❌ Get experts error:', error);
        }
        res.status(500).json({ 
          success: false,
          message: 'Internal server error',
          error: isProduction ? undefined : error.message
        });
      }
    });

    // Admin endpoints - Simple admin check (in production, use proper JWT auth)
    const checkAdmin = async (req, res, next) => {
      try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        const email = req.query.email || req.body.email;
        
        if (email) {
          const user = await databaseService.getUserByEmail(email);
          if (user && user.userType === 'admin') {
            req.adminUser = user;
            return next();
          }
        }
        
        res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: 'Error checking admin access'
        });
      }
    };

    // Get all sessions (admin only)
    this.app.get('/api/admin/sessions', checkAdmin, async (req, res) => {
      try {
        const sessions = await prisma.session.findMany({
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
            },
            reviews: true
          },
          orderBy: {
            scheduledDate: 'desc'
          }
        });

        const formattedSessions = sessions.map(session => {
          const localDate = new Date(session.scheduledDate);
          const year = localDate.getFullYear();
          const month = String(localDate.getMonth() + 1).padStart(2, '0');
          const day = String(localDate.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;
          const hours = String(localDate.getHours()).padStart(2, '0');
          const minutes = String(localDate.getMinutes()).padStart(2, '0');
          const timeStr = `${hours}:${minutes}`;

          return {
            id: session.id,
            expertId: session.expertId,
            candidateId: session.candidateId,
            expertName: session.expert.name,
            candidateName: session.candidate.name,
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
            feedbackRating: session.feedbackRating,
            feedbackComment: session.feedbackComment,
            additionalParticipants: session.additionalParticipants ? JSON.parse(session.additionalParticipants) : [],
            reviews: session.reviews,
            createdAt: session.createdAt.toISOString()
          };
        });

        res.json({
          success: true,
          sessions: formattedSessions,
          total: formattedSessions.length
        });
      } catch (error) {
        console.error('Error fetching all sessions:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch sessions',
          message: error.message
        });
      }
    });

    // Update session (admin only)
    this.app.put('/api/admin/sessions/:id', checkAdmin, async (req, res) => {
      try {
        const { id } = req.params;
        const updateData = req.body;

        // Parse date/time if provided
        if (updateData.date && updateData.time) {
          const [year, month, day] = updateData.date.split('-').map(Number);
          const [hours, minutes] = updateData.time.split(':').map(Number);
          updateData.scheduledDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
          delete updateData.date;
          delete updateData.time;
        }

        // Handle additional participants
        if (updateData.additionalParticipants && Array.isArray(updateData.additionalParticipants)) {
          updateData.additionalParticipants = JSON.stringify(updateData.additionalParticipants);
        }

        const updatedSession = await prisma.session.update({
          where: { id },
          data: updateData,
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

        res.json({
          success: true,
          data: updatedSession,
          message: 'Session updated successfully'
        });
      } catch (error) {
        console.error('Error updating session:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to update session',
          message: error.message
        });
      }
    });

    // Delete session (admin only)
    this.app.delete('/api/admin/sessions/:id', checkAdmin, async (req, res) => {
      try {
        const { id } = req.params;
        await prisma.session.delete({
          where: { id }
        });

        res.json({
          success: true,
          message: 'Session deleted successfully'
        });
      } catch (error) {
        console.error('Error deleting session:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to delete session',
          message: error.message
        });
      }
    });

    // Get all users (admin only)
    this.app.get('/api/admin/users', checkAdmin, async (req, res) => {
      try {
        const users = await prisma.user.findMany({
          select: {
            id: true,
            email: true,
            name: true,
            userType: true,
            phone: true,
            company: true,
            title: true,
            avatar: true,
            isActive: true,
            rating: true,
            totalSessions: true,
            hourlyRate: true,
            isVerified: true,
            createdAt: true,
            updatedAt: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        });

        res.json({
          success: true,
          users,
          total: users.length
        });
      } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch users',
          message: error.message
        });
      }
    });

    // Update user (admin only)
    this.app.put('/api/admin/users/:id', checkAdmin, async (req, res) => {
      try {
        const { id } = req.params;
        const updateData = req.body;

        // Handle JSON fields
        if (updateData.skills && Array.isArray(updateData.skills)) {
          updateData.skills = JSON.stringify(updateData.skills);
        }
        if (updateData.daysAvailable && Array.isArray(updateData.daysAvailable)) {
          updateData.daysAvailable = JSON.stringify(updateData.daysAvailable);
        }

        const updatedUser = await prisma.user.update({
          where: { id },
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
            isActive: true,
            rating: true,
            totalSessions: true,
            hourlyRate: true,
            isVerified: true,
            createdAt: true,
            updatedAt: true
          }
        });

        res.json({
          success: true,
          data: updatedUser,
          message: 'User updated successfully'
        });
      } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to update user',
          message: error.message
        });
      }
    });

    // Get all reviews/feedback (admin only)
    this.app.get('/api/admin/reviews', checkAdmin, async (req, res) => {
      try {
        const reviews = await prisma.review.findMany({
          include: {
            session: {
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
            },
            reviewer: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            reviewee: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        });

        res.json({
          success: true,
          reviews,
          total: reviews.length
        });
      } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch reviews',
          message: error.message
        });
      }
    });

    // Add participants to session (admin only)
    this.app.put('/api/admin/sessions/:id/participants', checkAdmin, async (req, res) => {
      try {
        const { id } = req.params;
        const { participantIds } = req.body; // Array of user IDs

        if (!Array.isArray(participantIds)) {
          return res.status(400).json({
            success: false,
            message: 'participantIds must be an array'
          });
        }

        // Validate that all participant IDs exist
        const participants = await prisma.user.findMany({
          where: {
            id: {
              in: participantIds
            }
          }
        });

        if (participants.length !== participantIds.length) {
          return res.status(400).json({
            success: false,
            message: 'Some participant IDs are invalid'
          });
        }

        // Get current session
        const session = await prisma.session.findUnique({
          where: { id }
        });

        if (!session) {
          return res.status(404).json({
            success: false,
            message: 'Session not found'
          });
        }

        // Merge with existing participants
        const existingParticipants = session.additionalParticipants 
          ? JSON.parse(session.additionalParticipants) 
          : [];
        
        const allParticipants = [...new Set([...existingParticipants, ...participantIds])];
        
        const updatedSession = await prisma.session.update({
          where: { id },
          data: {
            additionalParticipants: JSON.stringify(allParticipants)
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

        res.json({
          success: true,
          data: updatedSession,
          message: 'Participants added successfully'
        });
      } catch (error) {
        console.error('Error adding participants:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to add participants',
          message: error.message
        });
      }
    });

    // Get analytics/stats (admin only) - Enhanced
    this.app.get('/api/admin/analytics', checkAdmin, async (req, res) => {
      try {
        const { period = 'month' } = req.query; // week, month, quarter
        
        // Calculate date ranges
        const now = new Date();
        let startDate = new Date();
        if (period === 'week') {
          startDate.setDate(now.getDate() - 7);
        } else if (period === 'month') {
          startDate.setMonth(now.getMonth() - 1);
        } else if (period === 'quarter') {
          startDate.setMonth(now.getMonth() - 3);
        }

        const [
          totalUsers,
          totalSessions,
          totalReviews,
          activeUsers,
          sessionsByStatus,
          usersByType,
          allSessions,
          allUsers,
          allReviews
        ] = await Promise.all([
          prisma.user.count(),
          prisma.session.count(),
          prisma.review.count(),
          prisma.user.count({ where: { isActive: true } }),
          prisma.session.groupBy({
            by: ['status'],
            _count: true
          }),
          prisma.user.groupBy({
            by: ['userType'],
            _count: true
          }),
          prisma.session.findMany({
            include: {
              candidate: { select: { name: true, email: true } },
              expert: { select: { name: true, email: true } }
            }
          }),
          prisma.user.findMany({
            select: {
              id: true,
              email: true,
              name: true,
              userType: true,
              isActive: true,
              createdAt: true,
              totalSessions: true,
              rating: true
            }
          }),
          prisma.review.findMany({
            include: {
              session: true,
              reviewer: { select: { name: true, email: true } },
              reviewee: { select: { name: true, email: true } }
            }
          })
        ]);

        // Calculate average rating
        const avgRatingResult = await prisma.review.aggregate({
          _avg: { rating: true }
        });

        // Calculate revenue
        const totalRevenue = allSessions.reduce((sum, s) => sum + (s.paymentAmount || 0), 0);
        const completedRevenue = allSessions
          .filter(s => s.paymentStatus === 'completed')
          .reduce((sum, s) => sum + (s.paymentAmount || 0), 0);

        // Calculate new signups in period
        const newCandidates = allUsers.filter(u => 
          u.userType === 'candidate' && new Date(u.createdAt) >= startDate
        ).length;
        const newExperts = allUsers.filter(u => 
          u.userType === 'expert' && new Date(u.createdAt) >= startDate
        ).length;

        // Calculate interviews in period
        const periodSessions = allSessions.filter(s => 
          new Date(s.scheduledDate) >= startDate
        );

        // Calculate platform utilization (expert slots filled)
        const expertSessions = allSessions.filter(s => s.status === 'scheduled' || s.status === 'completed');
        const uniqueExperts = new Set(expertSessions.map(s => s.expertId)).size;
        const totalExperts = allUsers.filter(u => u.userType === 'expert' && u.isActive).length;
        const utilizationRate = totalExperts > 0 ? (uniqueExperts / totalExperts) * 100 : 0;

        // Group sessions by date for time series
        const sessionsOverTime = periodSessions.reduce((acc, s) => {
          const date = new Date(s.scheduledDate).toISOString().split('T')[0];
          acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {});

        // Revenue over time
        const revenueOverTime = periodSessions.reduce((acc, s) => {
          const date = new Date(s.scheduledDate).toISOString().split('T')[0];
          acc[date] = (acc[date] || 0) + (s.paymentAmount || 0);
          return acc;
        }, {});

        // Popular expertise areas (session types)
        const sessionTypesCount = allSessions.reduce((acc, s) => {
          acc[s.sessionType] = (acc[s.sessionType] || 0) + 1;
          return acc;
        }, {});

        // Expert performance (average ratings)
        const expertRatings = allUsers
          .filter(u => u.userType === 'expert' && u.rating)
          .map(u => u.rating)
          .filter(r => r > 0);
        const avgExpertRating = expertRatings.length > 0
          ? expertRatings.reduce((a, b) => a + b, 0) / expertRatings.length
          : 0;

        res.json({
          success: true,
          analytics: {
            // Key metrics
            totalUsers,
            activeUsers,
            totalSessions,
            totalReviews,
            averageRating: avgRatingResult._avg.rating || 0,
            totalRevenue,
            completedRevenue,
            newSignups: {
              candidates: newCandidates,
              experts: newExperts,
              total: newCandidates + newExperts
            },
            periodInterviews: periodSessions.length,
            platformUtilizationRate: Math.round(utilizationRate),
            
            // Breakdowns
            sessionsByStatus: sessionsByStatus.reduce((acc, item) => {
              acc[item.status] = item._count;
              return acc;
            }, {}),
            usersByType: usersByType.reduce((acc, item) => {
              acc[item.userType] = item._count;
              return acc;
            }, {}),
            
            // Time series data
            sessionsOverTime: Object.entries(sessionsOverTime).map(([date, count]) => ({
              date,
              count
            })).sort((a, b) => a.date.localeCompare(b.date)),
            
            revenueOverTime: Object.entries(revenueOverTime).map(([date, amount]) => ({
              date,
              amount
            })).sort((a, b) => a.date.localeCompare(b.date)),
            
            // Popular areas
            popularExpertiseAreas: Object.entries(sessionTypesCount)
              .map(([type, count]) => ({ type, count }))
              .sort((a, b) => b.count - a.count),
            
            // Expert performance
            averageExpertRating: avgExpertRating,
            
            // System health (mock data for now)
            systemHealth: {
              apiLatency: Math.floor(Math.random() * 50) + 10, // ms
              serverUptime: 99.9,
              videoIntegrationStatus: 'operational'
            }
          }
        });
      } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch analytics',
          message: error.message
        });
      }
    });

    // Reschedule/Cancel session (admin only)
    this.app.post('/api/admin/sessions/:id/reschedule', checkAdmin, async (req, res) => {
      try {
        const { id } = req.params;
        const { date, time, reason } = req.body;

        if (!date || !time) {
          return res.status(400).json({
            success: false,
            message: 'Date and time are required'
          });
        }

        const [year, month, day] = date.split('-').map(Number);
        const [hours, minutes] = time.split(':').map(Number);
        const newScheduledDate = new Date(year, month - 1, day, hours, minutes, 0, 0);

        const updatedSession = await prisma.session.update({
          where: { id },
          data: {
            scheduledDate: newScheduledDate,
            status: 'rescheduled'
          },
          include: {
            candidate: { select: { name: true, email: true } },
            expert: { select: { name: true, email: true } }
          }
        });

        res.json({
          success: true,
          data: updatedSession,
          message: 'Session rescheduled successfully'
        });
      } catch (error) {
        console.error('Error rescheduling session:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to reschedule session',
          message: error.message
        });
      }
    });

    // Cancel session (admin only)
    this.app.post('/api/admin/sessions/:id/cancel', checkAdmin, async (req, res) => {
      try {
        const { id } = req.params;
        const { reason } = req.body;

        const updatedSession = await prisma.session.update({
          where: { id },
          data: {
            status: 'cancelled'
          },
          include: {
            candidate: { select: { name: true, email: true } },
            expert: { select: { name: true, email: true } }
          }
        });

        res.json({
          success: true,
          data: updatedSession,
          message: 'Session cancelled successfully'
        });
      } catch (error) {
        console.error('Error cancelling session:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to cancel session',
          message: error.message
        });
      }
    });

    // Get user details with full history (admin only)
    this.app.get('/api/admin/users/:id', checkAdmin, async (req, res) => {
      try {
        const { id } = req.params;
        
        const user = await prisma.user.findUnique({
          where: { id },
          include: {
            candidateSessions: {
              include: {
                expert: { select: { name: true, email: true } }
              },
              orderBy: { scheduledDate: 'desc' }
            },
            expertSessions: {
              include: {
                candidate: { select: { name: true, email: true } }
              },
              orderBy: { scheduledDate: 'desc' }
            },
            reviewsReceived: {
              include: {
                reviewer: { select: { name: true, email: true } },
                session: { select: { title: true, sessionType: true } }
              },
              orderBy: { createdAt: 'desc' }
            }
          }
        });

        if (!user) {
          return res.status(404).json({
            success: false,
            message: 'User not found'
          });
        }

        res.json({
          success: true,
          data: user
        });
      } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch user details',
          message: error.message
        });
      }
    });

    // Create new user (admin only)
    this.app.post('/api/admin/users', checkAdmin, async (req, res) => {
      try {
        const { name, email, userType, password, bio, experience, skills, hourlyRate, isVerified, isActive } = req.body;

        if (!name || !email || !userType) {
          return res.status(400).json({
            success: false,
            message: 'Name, email, and userType are required'
          });
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
          where: { email }
        });

        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: 'User with this email already exists'
          });
        }

        // Create new user
        const newUser = await prisma.user.create({
          data: {
            name,
            email,
            userType,
            password: password || 'hashed_password_' + Date.now(), // Default password if not provided
            bio: bio || null,
            experience: experience || null,
            skills: skills ? (typeof skills === 'string' ? skills : JSON.stringify(skills)) : null,
            hourlyRate: hourlyRate || null,
            isVerified: isVerified !== undefined ? isVerified : (userType === 'expert' ? false : true),
            isActive: isActive !== undefined ? isActive : true,
            rating: 0,
            totalSessions: 0
          }
        });

        const { password: _, ...userWithoutPassword } = newUser;

        res.json({
          success: true,
          data: userWithoutPassword,
          message: 'User created successfully'
        });
      } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to create user',
          message: error.message
        });
      }
    });

    // Approve/Reject expert (admin only)
    this.app.post('/api/admin/users/:id/approve-expert', checkAdmin, async (req, res) => {
      try {
        const { id } = req.params;
        const { approved, reason } = req.body;

        const user = await prisma.user.findUnique({
          where: { id }
        });

        if (!user || user.userType !== 'expert') {
          return res.status(400).json({
            success: false,
            message: 'User is not an expert'
          });
        }

        const updatedUser = await prisma.user.update({
          where: { id },
          data: {
            isVerified: approved === true,
            isActive: approved === true
          }
        });

        res.json({
          success: true,
          data: updatedUser,
          message: approved ? 'Expert approved successfully' : 'Expert rejected'
        });
      } catch (error) {
        console.error('Error approving expert:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to approve expert',
          message: error.message
        });
      }
    });

    // Get financial transactions (admin only)
    this.app.get('/api/admin/financial/transactions', checkAdmin, async (req, res) => {
      try {
        const sessions = await prisma.session.findMany({
          where: {
            paymentAmount: { not: null }
          },
          include: {
            candidate: { select: { name: true, email: true } },
            expert: { select: { name: true, email: true } }
          },
          orderBy: { scheduledDate: 'desc' }
        });

        const transactions = sessions.map(s => ({
          id: s.id,
          sessionId: s.id,
          candidate: s.candidate.name,
          candidateEmail: s.candidate.email,
          expert: s.expert.name,
          expertEmail: s.expert.email,
          amount: s.paymentAmount,
          platformCommission: (s.paymentAmount || 0) * 0.2, // 20% commission
          expertPayout: (s.paymentAmount || 0) * 0.8, // 80% to expert
          status: s.paymentStatus,
          date: s.scheduledDate,
          sessionType: s.sessionType
        }));

        const totalRevenue = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
        const totalCommission = transactions.reduce((sum, t) => sum + t.platformCommission, 0);
        const totalPayouts = transactions.reduce((sum, t) => sum + t.expertPayout, 0);

        res.json({
          success: true,
          transactions,
          summary: {
            totalRevenue,
            totalCommission,
            totalPayouts,
            transactionCount: transactions.length
          }
        });
      } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch transactions',
          message: error.message
        });
      }
    });

    // Get expert payouts (admin only)
    this.app.get('/api/admin/financial/payouts', checkAdmin, async (req, res) => {
      try {
        const sessions = await prisma.session.findMany({
          where: {
            paymentStatus: 'completed',
            paymentAmount: { not: null }
          },
          include: {
            expert: { select: { id: true, name: true, email: true } }
          }
        });

        const payoutsByExpert = sessions.reduce((acc, s) => {
          const expertId = s.expertId;
          if (!acc[expertId]) {
            acc[expertId] = {
              expertId: expertId,
              expertName: s.expert.name,
              expertEmail: s.expert.email,
              totalEarnings: 0,
              platformCommission: 0,
              payoutAmount: 0,
              sessionCount: 0
            };
          }
          const amount = s.paymentAmount || 0;
          acc[expertId].totalEarnings += amount;
          acc[expertId].platformCommission += amount * 0.2;
          acc[expertId].payoutAmount += amount * 0.8;
          acc[expertId].sessionCount += 1;
          return acc;
        }, {});

        const payouts = Object.values(payoutsByExpert);

        res.json({
          success: true,
          payouts,
          totalPendingPayouts: payouts.reduce((sum, p) => sum + p.payoutAmount, 0)
        });
      } catch (error) {
        console.error('Error fetching payouts:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch payouts',
          message: error.message
        });
      }
    });

    // Configure multer for recording uploads
    const recordingsDir = path.join(__dirname, 'uploads', 'recordings');
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
    this.app.post('/api/sessions/:id/upload-recording', uploadRecording.single('recording'), async (req, res) => {
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

        // Verify session exists and user has access
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
        // S3 can work with either:
        // 1. IAM role (on EC2) - no credentials needed, automatically detected
        // 2. IAM user credentials (local dev) - AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
        // We only need the bucket name to be set
        const isS3Configured = process.env.AWS_S3_BUCKET_NAME;

        if (isS3Configured) {
          // Upload to S3
          try {
            const fileBuffer = fs.readFileSync(req.file.path);
            const fileName = `recording-${id}-${Date.now()}-${Math.round(Math.random() * 1E9)}.webm`;
            
            const s3Result = await s3Service.uploadFile(
              fileBuffer,
              fileName,
              req.file.mimetype || 'video/webm'
            );
            
            fullUrl = s3Result.url;
            recordingUrl = s3Result.key;

            // Delete local file after S3 upload
            if (fs.existsSync(req.file.path)) {
              fs.unlinkSync(req.file.path);
            }

            console.log(`✅ Recording uploaded to S3 for session ${id}: ${recordingUrl}`);
          } catch (s3Error) {
            console.error('S3 upload failed, falling back to local storage:', s3Error);
            // Fall back to local storage
            recordingUrl = `/uploads/recordings/${req.file.filename}`;
            fullUrl = process.env.FRONTEND_URL 
              ? `${process.env.FRONTEND_URL}${recordingUrl}`
              : `${req.protocol}://${req.get('host')}${recordingUrl}`;
            console.log(`✅ Recording saved locally for session ${id}: ${recordingUrl}`);
          }
        } else {
          // Use local storage
          recordingUrl = `/uploads/recordings/${req.file.filename}`;
          fullUrl = process.env.FRONTEND_URL 
            ? `${process.env.FRONTEND_URL}${recordingUrl}`
            : `${req.protocol}://${req.get('host')}${recordingUrl}`;
          console.log(`✅ Recording saved locally for session ${id}: ${recordingUrl}`);
        }

        // Update session with recording URL
        const updatedSession = await prisma.session.update({
          where: { id },
          data: {
            recordingUrl: fullUrl
          },
          include: {
            candidate: { select: { name: true, email: true } },
            expert: { select: { name: true, email: true } }
          }
        });

        res.json({
          success: true,
          data: {
            session: updatedSession,
            recordingUrl: fullUrl,
            fileSize: req.file.size,
            filename: req.file.filename
          },
          message: 'Recording uploaded successfully'
        });
      } catch (error) {
        console.error('Error uploading recording:', error);
        
        // Delete uploaded file on error
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
          success: false,
          error: 'Failed to upload recording',
          message: error.message
        });
      }
    });

    // Get fresh signed URL for a session recording
    this.app.get('/api/sessions/:id/recording', authenticateToken, async (req, res) => {
      try {
        const { id } = req.params;
        const userId = req.user?.id;
        
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

        // Check if user has access to this session (candidate, expert, or admin)
        const isAdmin = req.user?.userType === 'admin';
        const hasAccess = isAdmin || session.candidateId === userId || session.expertId === userId;
        
        if (!hasAccess) {
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
            console.log(`🔄 Processing S3 URL: ${session.recordingUrl.substring(0, 100)}...`);
            
            // Extract S3 key from URL
            // URL format: https://bucket.s3.region.amazonaws.com/key?params
            // Or: https://bucket.s3.region.amazonaws.com/key
            // Or: https://s3.region.amazonaws.com/bucket/key?params
            // Pre-signed URLs have query parameters that we need to ignore
            
            // Remove query parameters first
            const urlWithoutParams = session.recordingUrl.split('?')[0];
            console.log(`📝 URL without params: ${urlWithoutParams}`);
            
            // Parse the URL
            const urlObj = new URL(urlWithoutParams);
            let key = urlObj.pathname;
            
            // Remove leading slash if present
            if (key.startsWith('/')) {
              key = key.substring(1);
            }
            
            console.log(`🔑 Extracted pathname: ${key}`);
            
            // If the pathname doesn't start with 'recordings/', try to extract from full path
            if (!key.startsWith('recordings/')) {
              // Try to find 'recordings/' in the path
              const recordingsIndex = key.indexOf('recordings/');
              if (recordingsIndex !== -1) {
                key = key.substring(recordingsIndex);
                console.log(`✅ Found recordings/ at index ${recordingsIndex}, extracted key: ${key}`);
              } else {
                // If no 'recordings/' found, use the full pathname (minus leading slash)
                console.warn('⚠️ Could not find "recordings/" in URL path, using full pathname:', key);
              }
            }
            
            if (key && key.length > 0) {
              console.log(`🔄 Generating fresh signed URL for S3 key: ${key}`);
              
              // Generate fresh signed URL (valid for 7 days)
              accessibleUrl = await s3Service.getSignedUrl(key, 604800); // 7 days
              console.log(`✅ Fresh signed URL generated successfully`);
            } else {
              console.error('❌ Could not extract S3 key from URL:', session.recordingUrl);
              // Return original URL as fallback
            }
          } catch (s3Error) {
            console.error('❌ Error generating fresh signed URL:', s3Error);
            console.error('   Error details:', {
              message: s3Error.message,
              stack: s3Error.stack,
              url: session.recordingUrl
            });
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

    // Update recording URL for a session (admin or expert only)
    this.app.put('/api/sessions/:id/recording', checkAdmin, async (req, res) => {
      try {
        const { id } = req.params;
        const { recordingUrl } = req.body;

        if (!recordingUrl) {
          return res.status(400).json({
            success: false,
            message: 'Recording URL is required'
          });
        }

        const updatedSession = await prisma.session.update({
          where: { id },
          data: {
            recordingUrl: recordingUrl
          },
          include: {
            candidate: { select: { name: true, email: true } },
            expert: { select: { name: true, email: true } }
          }
        });

        res.json({
          success: true,
          data: updatedSession,
          message: 'Recording URL updated successfully'
        });
      } catch (error) {
        console.error('Error updating recording URL:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to update recording URL',
          message: error.message
        });
      }
    });

    // Zoom webhook endpoint for recording completion
    this.app.post('/api/webhooks/zoom/recording', express.raw({ type: 'application/json' }), async (req, res) => {
      try {
        // Verify webhook (in production, verify the signature)
        const payload = JSON.parse(req.body.toString());
        
        if (payload.event === 'recording.completed') {
          const meetingId = payload.payload.object.id.toString();
          const recordingUrl = payload.payload.object.recording_files?.[0]?.play_url || 
                              payload.payload.object.recording_files?.[0]?.download_url;

          if (recordingUrl) {
            // Find session by meetingId and update recording URL
            const session = await prisma.session.findFirst({
              where: { meetingId: meetingId }
            });

            if (session) {
              await prisma.session.update({
                where: { id: session.id },
                data: { recordingUrl: recordingUrl }
              });
              console.log(`Recording URL updated for session ${session.id}: ${recordingUrl}`);
            }
          }
        }

        res.status(200).send('OK');
      } catch (error) {
        console.error('Error processing Zoom webhook:', error);
        res.status(200).send('OK'); // Always return 200 to Zoom
      }
    });

    // Get recording from Zoom (manual trigger)
    this.app.post('/api/sessions/:id/fetch-recording', checkAdmin, async (req, res) => {
      try {
        const { id } = req.params;
        
        const session = await prisma.session.findUnique({
          where: { id }
        });

        if (!session || !session.meetingId) {
          return res.status(404).json({
            success: false,
            message: 'Session or meeting ID not found'
          });
        }

        // Try to fetch recording from Zoom
        const recordingUrl = await videoService.getZoomRecording(session.meetingId);

        if (recordingUrl) {
          const updatedSession = await prisma.session.update({
            where: { id },
            data: { recordingUrl: recordingUrl }
          });

          res.json({
            success: true,
            data: updatedSession,
            message: 'Recording URL fetched and updated successfully'
          });
        } else {
          res.json({
            success: false,
            message: 'Recording not yet available'
          });
        }
      } catch (error) {
        console.error('Error fetching recording:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch recording',
          message: error.message
        });
      }
    });
  }

  setupRealtime() {
    // Server-Sent Events endpoint for real-time updates
    this.app.get('/api/realtime', (req, res) => {
      let userId = req.query.userId || 'anonymous';
      
      // Handle mock IDs
      if (userId === 'candidate-001') {
        userId = 'john@example.com';
      } else if (userId === 'expert-001') {
        userId = 'jane@example.com';
      }
      
      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': config.cors.origin,
        'Access-Control-Allow-Credentials': 'true'
      });

      // Add connection to real-time service
      realtimeService.addConnection(userId, res);

      // Send initial connection message
      res.write(`data: ${JSON.stringify({
        event: 'connected',
        data: { userId, timestamp: new Date().toISOString() }
      })}\n\n`);

      // Handle client disconnect
      req.on('close', () => {
        realtimeService.removeConnection(userId, res);
      });
    });
  }

  updateFrontendConfig() {
    // This would update the frontend configuration file
    // For now, we'll just log the port
    console.log(`📝 Frontend should connect to: http://localhost:${this.port}`);
  }

  async shutdown() {
    console.log('🛑 Shutting down server...');
    
    if (this.server) {
      this.server.close();
    }
    
    realtimeService.stop();
    await databaseService.disconnect();
    
    console.log('✅ Server shutdown complete');
    process.exit(0);
  }
}

// Start the server
const server = new RobustServer();
server.start().catch(console.error);

module.exports = server;






