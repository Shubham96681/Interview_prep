const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class DatabaseService {
  constructor() {
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('🔧 Initializing database...');
      
      // Test database connection
      await prisma.$connect();
      console.log('✅ Database connected successfully');

      // Check if database needs seeding
      const userCount = await prisma.user.count();
      console.log(`📊 Found ${userCount} users in database`);

      if (userCount === 0) {
        console.log('🌱 Database is empty, seeding initial data...');
        await this.seedDatabase();
      } else {
        console.log('✅ Database already has data, skipping seed');
      }

      this.isInitialized = true;
      console.log('✅ Database initialization complete');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  async seedDatabase() {
    try {
      // Create default users
      const users = await Promise.all([
        prisma.user.upsert({
          where: { email: 'john@example.com' },
          update: {},
          create: {
            email: 'john@example.com',
            name: 'John Doe',
            userType: 'candidate',
            password: 'hashed_password_123', // In real app, this would be properly hashed
            bio: 'Experienced software developer looking to improve interview skills',
            experience: '5+ years',
            skills: JSON.stringify(['JavaScript', 'React', 'Node.js'])
          }
        }),
        prisma.user.upsert({
          where: { email: 'jane@example.com' },
          update: {},
          create: {
            email: 'jane@example.com',
            name: 'Jane Smith',
            userType: 'expert',
            password: 'hashed_password_123',
            bio: 'Senior Software Engineer with 10+ years of experience',
            experience: '10+ years',
            skills: JSON.stringify(['React', 'Node.js', 'TypeScript', 'System Design']),
            hourlyRate: 75,
            timezone: 'UTC-5',
            workingHoursStart: '09:00',
            workingHoursEnd: '17:00',
            daysAvailable: JSON.stringify(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
            isVerified: true
          }
        }),
        prisma.user.upsert({
          where: { email: 'shubhamsingh6087@gmail.com' },
          update: {},
          create: {
            email: 'shubhamsingh6087@gmail.com',
            name: 'Shubham Singh',
            userType: 'candidate',
            password: 'hashed_password_123',
            bio: 'Software developer preparing for technical interviews',
            experience: '3+ years',
            skills: JSON.stringify(['JavaScript', 'React', 'Python', 'SQL'])
          }
        }),
        prisma.user.upsert({
          where: { email: 'admin@interviewace.com' },
          update: {},
          create: {
            email: 'admin@interviewace.com',
            name: 'Admin User',
            userType: 'admin',
            password: 'hashed_password_123',
            bio: 'System Administrator',
            experience: 'Administrator',
            skills: JSON.stringify(['System Administration', 'User Management', 'Session Management'])
          }
        })
      ]);

      console.log(`✅ Created/updated ${users.length} users`);

      // Create some sample sessions if none exist
      const sessionCount = await prisma.session.count();
      if (sessionCount === 0) {
        const sampleSessions = [
          {
            title: 'Technical Interview Practice',
            description: 'Mock technical interview focusing on algorithms and data structures',
            scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
            duration: 60,
            sessionType: 'technical',
            status: 'scheduled',
            candidateId: users[2].id, // Shubham Singh
            expertId: users[1].id, // Jane Smith
            paymentAmount: 75,
            paymentStatus: 'pending'
          },
          {
            title: 'System Design Interview',
            description: 'System design interview preparation session',
            scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Day after tomorrow
            duration: 90,
            sessionType: 'system_design',
            status: 'scheduled',
            candidateId: users[2].id, // Shubham Singh
            expertId: users[1].id, // Jane Smith
            paymentAmount: 112.5,
            paymentStatus: 'pending'
          }
        ];

        await prisma.session.createMany({
          data: sampleSessions
        });

        console.log(`✅ Created ${sampleSessions.length} sample sessions`);
      }

    } catch (error) {
      console.error('❌ Database seeding failed:', error);
      throw error;
    }
  }

  async getUserByEmail(email) {
    return await prisma.user.findUnique({
      where: { email }
    });
  }

  async createSession(sessionData) {
    try {
      console.log('DatabaseService.createSession called with:', JSON.stringify(sessionData, null, 2));
      
      // Remove any undefined values to avoid Prisma errors
      const cleanData = {};
      for (const [key, value] of Object.entries(sessionData)) {
        if (value !== undefined) {
          cleanData[key] = value;
        }
      }
      
      console.log('Cleaned session data:', JSON.stringify(cleanData, null, 2));
      
      const result = await prisma.session.create({
        data: cleanData,
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
      
      console.log('✅ Session created successfully:', result.id);
      return result;
    } catch (error) {
      console.error('❌ DatabaseService.createSession error:', error);
      console.error('Error code:', error.code);
      console.error('Error meta:', error.meta);
      throw error;
    }
  }

  async getSessionsForUser(userId, userType) {
    const whereClause = userType === 'candidate' 
      ? { candidateId: userId }
      : { expertId: userId };

    return await prisma.session.findMany({
      where: whereClause,
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
      orderBy: {
        scheduledDate: 'asc'
      }
    });
  }

  async disconnect() {
    await prisma.$disconnect();
  }
}

module.exports = new DatabaseService();






