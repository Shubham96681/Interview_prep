const express = require('express');
const cors = require('cors');
const config = require('./config/server');
const databaseService = require('./services/database');
const realtimeService = require('./services/realtime');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
        
        if (!expert || expert.userType !== 'expert') {
          return res.status(400).json({
            success: false,
            error: 'Invalid expert ID',
            message: 'Expert not found'
          });
        }
        
        if (!candidate || candidate.userType !== 'candidate') {
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
        
        const sessionData = {
          title: `${sessionType || 'Technical'} Interview Session`,
          description: `Interview session scheduled for ${date} at ${time}`,
          scheduledDate: scheduledDate,
          duration: duration || 60,
          sessionType: sessionType || 'technical',
          status: 'scheduled',
          candidateId: actualCandidateId,
          expertId: actualExpertId,
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

    // Get analytics/stats (admin only)
    this.app.get('/api/admin/analytics', checkAdmin, async (req, res) => {
      try {
        const [
          totalUsers,
          totalSessions,
          totalReviews,
          activeUsers,
          sessionsByStatus,
          usersByType
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
          })
        ]);

        // Calculate average rating
        const avgRatingResult = await prisma.review.aggregate({
          _avg: {
            rating: true
          }
        });

        res.json({
          success: true,
          analytics: {
            totalUsers,
            activeUsers,
            totalSessions,
            totalReviews,
            averageRating: avgRatingResult._avg.rating || 0,
            sessionsByStatus: sessionsByStatus.reduce((acc, item) => {
              acc[item.status] = item._count;
              return acc;
            }, {}),
            usersByType: usersByType.reduce((acc, item) => {
              acc[item.userType] = item._count;
              return acc;
            }, {})
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






