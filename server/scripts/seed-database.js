#!/usr/bin/env node

/**
 * Database Seeding Script
 * This script seeds the database with demo users (admin, candidates, expert)
 * Run this script manually if the database needs to be seeded
 */

const path = require('path');
const { PrismaClient } = require('@prisma/client');

// Resolve the Prisma schema path
const prismaSchemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'file:./prisma/dev.db'
    }
  }
});

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Check if users already exist
    const userCount = await prisma.user.count();
    console.log(`📊 Found ${userCount} users in database`);
    
    if (userCount > 0) {
      console.log('⚠️  Database already has users. Checking if demo users exist...');
      
      // Check for admin user
      const adminExists = await prisma.user.findUnique({
        where: { email: 'admin@interviewace.com' }
      });
      
      if (!adminExists) {
        console.log('📝 Admin user not found, creating demo users...');
        await createDemoUsers();
      } else {
        console.log('✅ Demo users already exist. Skipping seed.');
        return;
      }
    } else {
      console.log('📝 Database is empty, creating demo users...');
      await createDemoUsers();
    }
    
    console.log('✅ Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function createDemoUsers() {
  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'john@example.com' },
      update: {},
      create: {
        email: 'john@example.com',
        name: 'John Doe',
        userType: 'candidate',
        password: 'hashed_password_123',
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

  console.log(`✅ Created/updated ${users.length} demo users:`);
  users.forEach(user => {
    console.log(`   - ${user.name} (${user.email}) - ${user.userType}`);
  });
}

// Run the seeding
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('🎉 Seeding complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedDatabase, createDemoUsers };

