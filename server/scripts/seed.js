const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient();

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...');

    // Clear existing data
    await prisma.review.deleteMany();
    await prisma.session.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.user.deleteMany();
    console.log('✅ Cleared existing data');

    // Create test candidate
    const candidatePassword = await bcrypt.hash('password123', 10);
    const candidate = await prisma.user.create({
      data: {
        name: 'John Doe',
        email: 'john@example.com',
        password: candidatePassword,
        userType: 'candidate',
        company: 'Tech Corp',
        title: 'Software Engineer',
        bio: 'Software engineer with 3 years of experience looking to improve interview skills',
        experience: '3 years in full-stack development',
        skills: JSON.stringify(['JavaScript', 'React', 'Node.js', 'Python']),
        rating: 0,
        totalSessions: 0,
        yearsOfExperience: '3-5',
        resumePath: 'sample-resume.pdf',
        profilePhotoPath: 'john-doe-photo.jpg'
      }
    });
    console.log('✅ Created test candidate:', candidate.name);

    // Create test expert
    const expertPassword = await bcrypt.hash('password123', 10);
    const expert = await prisma.user.create({
      data: {
        name: 'Jane Smith',
        email: 'jane@example.com',
        password: expertPassword,
        userType: 'expert',
        company: 'Google',
        title: 'Senior Software Engineer',
        bio: 'Senior software engineer with 8 years of experience in tech interviews',
        experience: '8 years in software engineering, 5 years conducting interviews',
        skills: JSON.stringify(['JavaScript', 'React', 'Node.js', 'Python', 'System Design', 'Algorithms']),
        rating: 4.8,
        totalSessions: 150,
        hourlyRate: 75,
        isVerified: true,
        yearsOfExperience: '6-10',
        proficiency: JSON.stringify(['Technical Interviews', 'System Design', 'Data Structures & Algorithms', 'Behavioral Interviews', 'Mock Interviews']),
        profilePhotoPath: 'jane-smith-photo.jpg'
      }
    });
    console.log('✅ Created test expert:', expert.name);

    // Create test sessions
    const sessions = [
      {
        title: 'Mock Technical Interview',
        description: 'Technical interview practice session',
        scheduledDate: new Date('2024-01-15T14:00:00Z'),
        duration: 60,
        sessionType: 'technical',
        status: 'completed',
        candidateId: candidate.id,
        expertId: expert.id,
        paymentAmount: 75,
        paymentStatus: 'completed',
        feedbackRating: 5,
        feedbackComment: 'Excellent performance! Great problem-solving skills and clear communication. Areas for improvement: system design depth.',
        feedbackDate: new Date('2024-01-15T15:00:00Z')
      },
      {
        title: 'Resume Review Session',
        description: 'Resume review and improvement suggestions',
        scheduledDate: new Date('2024-10-20T10:00:00Z'),
        duration: 30,
        sessionType: 'resume',
        status: 'scheduled',
        candidateId: candidate.id,
        expertId: expert.id,
        paymentAmount: 37.5,
        paymentStatus: 'pending'
      },
      {
        title: 'System Design Practice',
        description: 'System design interview preparation',
        scheduledDate: new Date('2024-01-10T15:30:00Z'),
        duration: 90,
        sessionType: 'system_design',
        status: 'completed',
        candidateId: candidate.id,
        expertId: expert.id,
        paymentAmount: 112.5,
        paymentStatus: 'completed',
        feedbackRating: 4,
        feedbackComment: 'Good system design thinking. Consider preparing more specific metrics and scalability considerations.',
        feedbackDate: new Date('2024-01-10T17:00:00Z')
      }
    ];

    for (const sessionData of sessions) {
      const session = await prisma.session.create({
        data: sessionData
      });
      console.log('✅ Created session:', session.title);
    }

    // Create test reviews
    const reviews = [
      {
        sessionId: (await prisma.session.findFirst({ where: { title: 'Mock Technical Interview' } })).id,
        reviewerId: candidate.id,
        revieweeId: expert.id,
        rating: 5,
        comment: 'Jane was an excellent interviewer. She provided great feedback and helped me understand my strengths and areas for improvement.',
        categories: JSON.stringify(['Communication', 'Technical Skills', 'Problem Solving'])
      },
      {
        sessionId: (await prisma.session.findFirst({ where: { title: 'System Design Practice' } })).id,
        reviewerId: candidate.id,
        revieweeId: expert.id,
        rating: 4,
        comment: 'Good session overall. Jane helped me think through system design problems systematically.',
        categories: JSON.stringify(['System Design', 'Architecture'])
      }
    ];

    for (const reviewData of reviews) {
      const review = await prisma.review.create({
        data: reviewData
      });
      console.log('✅ Created review with rating:', review.rating);
    }

    // Create test notifications
    const notifications = [
      {
        userId: candidate.id,
        type: 'session_booking',
        title: 'Session Booked',
        message: 'Your session with Jane Smith has been booked for October 20, 2024 at 10:00 AM',
        data: { sessionId: (await prisma.session.findFirst({ where: { title: 'Resume Review Session' } })).id }
      },
      {
        userId: expert.id,
        type: 'session_booking',
        title: 'New Session Request',
        message: 'John Doe has booked a session with you for October 20, 2024 at 10:00 AM',
        data: { sessionId: (await prisma.session.findFirst({ where: { title: 'Resume Review Session' } })).id }
      }
    ];

    for (const notificationData of notifications) {
      const notification = await prisma.notification.create({
        data: notificationData
      });
      console.log('✅ Created notification:', notification.title);
    }

    console.log('🎉 Database seeded successfully!');
    console.log('\n📊 Summary:');
    console.log('- 1 Candidate (John Doe)');
    console.log('- 1 Expert (Jane Smith)');
    console.log('- 3 Sessions (2 completed, 1 scheduled)');
    console.log('- 2 Reviews');
    console.log('- 2 Notifications');
    console.log('\n🔑 Test Credentials:');
    console.log('Candidate: john@example.com / password123');
    console.log('Expert: jane@example.com / password123');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

seedDatabase()
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });