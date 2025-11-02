const express = require('express');
const cors = require('cors');
const config = require('./config/server');
const databaseService = require('./services/database');
const realtimeService = require('./services/realtime');

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
      
      // Start server
      this.server = this.app.listen(this.port, () => {
        console.log(`✅ Server running on http://localhost:${this.port}`);
        console.log(`✅ Health check: http://localhost:${this.port}/api/health`);
        console.log(`✅ Real-time: http://localhost:${this.port}/api/realtime`);
        console.log(`✅ CORS enabled for: ${config.cors.origin}`);
        
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
    // CORS
    this.app.use(cors(config.cors));
    
    // JSON parsing
    this.app.use(express.json());
    
    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
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

    // Authentication endpoints
    this.app.post('/api/auth/login', async (req, res) => {
      try {
        const { email, password } = req.body;
        
        console.log('Login attempt:', { email, password: password ? '***' : 'undefined' });
        
        // For demo purposes, accept any password
        // In production, you'd verify the password hash
        const user = await databaseService.getUserByEmail(email);
        
        if (user && password) {
          console.log('Login successful for:', email);
          res.json({
            success: true,
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              userType: user.userType
            },
            token: 'jwt-token-' + Date.now()
          });
        } else {
          console.log('Login failed for:', email);
          res.status(401).json({
            success: false,
            message: 'Invalid credentials'
          });
        }
      } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
          success: false,
          message: 'Internal server error'
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

        // For demo purposes, return a default user
        // In production, you'd verify the JWT token
        const user = await databaseService.getUserByEmail('shubhamsingh6087@gmail.com');
        
        if (user) {
          res.json({
            success: true,
            data: {
              id: user.id,
              name: user.name,
              email: user.email,
              userType: user.userType
            }
          });
        } else {
          res.status(401).json({
            success: false,
            message: 'Invalid token'
          });
        }
      } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({
          success: false,
          message: 'Internal server error'
        });
      }
    });

    // Sessions endpoints
    this.app.get('/api/sessions', async (req, res) => {
      try {
        const { userId, userType, limit } = req.query;
        
        console.log('Fetching sessions for:', { userId, userType, limit });
        
        // Default to your user if no userId provided
        const targetUserId = userId || 'cmguho5y30000mb9sp9zy6gwe';
        const targetUserType = userType || 'candidate';
        
        const sessions = await databaseService.getSessionsForUser(targetUserId, targetUserType);
        
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
        const { expertId, candidateId, date, time, duration, sessionType } = req.body;
        
        console.log('Creating session:', { expertId, candidateId, date, time, duration, sessionType });
        
        // Create session in database
        // Parse date and time as local time (not UTC)
        const [year, month, day] = date.split('-').map(Number);
        const [hours, minutes] = time.split(':').map(Number);
        const scheduledDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
        
        const sessionData = {
          title: `${sessionType || 'Technical'} Interview Session`,
          description: `Interview session scheduled for ${date} at ${time}`,
          scheduledDate: scheduledDate,
          duration: duration || 60,
          sessionType: sessionType || 'technical',
          status: 'scheduled',
          candidateId,
          expertId,
          paymentAmount: 75,
          paymentStatus: 'pending'
        };

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
          createdAt: newSession.createdAt.toISOString()
        };
        
        res.json({
          success: true,
          data: formattedSession,
          message: 'Session created successfully'
        });
      } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to create session',
          message: error.message
        });
      }
    });

    // Experts endpoint
    this.app.get('/api/experts', (req, res) => {
      res.json({
        success: true,
        data: [
          {
            id: 'cmgnfskqx0001mbh0inzrgmsy',
            name: 'Jane Smith',
            title: 'Senior Software Engineer',
            company: 'Tech Corp',
            rating: 4.8,
            reviewCount: 150,
            hourlyRate: 75,
            specialties: ['React', 'Node.js', 'TypeScript'],
            bio: 'Experienced software engineer with 10+ years in full-stack development.',
            avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
            experience: '10+ years',
            languages: ['English', 'Spanish'],
            availability: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
          }
        ]
      });
    });
  }

  setupRealtime() {
    // Server-Sent Events endpoint for real-time updates
    this.app.get('/api/realtime', (req, res) => {
      const userId = req.query.userId || 'cmguho5y30000mb9sp9zy6gwe';
      
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






