const prisma = require('../lib/prisma');

/**
 * Script to check users directly from the database
 * Usage: node scripts/check-users.js [options]
 * 
 * Options:
 *   - all: List all users
 *   - email <email>: Find user by email
 *   - id <id>: Find user by ID
 *   - type <type>: Find users by type (candidate/expert/admin)
 *   - active: Find only active users
 *   - count: Show user count only
 */

async function checkUsers() {
  try {
    const args = process.argv.slice(2);
    const command = args[0] || 'all';

    console.log('🔍 Checking users in database...\n');

    switch (command) {
      case 'all':
        await listAllUsers();
        break;
      
      case 'email':
        const email = args[1];
        if (!email) {
          console.error('❌ Please provide an email address');
          console.log('Usage: node scripts/check-users.js email <email>');
          process.exit(1);
        }
        await findUserByEmail(email);
        break;
      
      case 'id':
        const id = args[1];
        if (!id) {
          console.error('❌ Please provide a user ID');
          console.log('Usage: node scripts/check-users.js id <id>');
          process.exit(1);
        }
        await findUserById(id);
        break;
      
      case 'type':
        const userType = args[1];
        if (!userType) {
          console.error('❌ Please provide a user type (candidate/expert/admin)');
          console.log('Usage: node scripts/check-users.js type <candidate|expert|admin>');
          process.exit(1);
        }
        await findUsersByType(userType);
        break;
      
      case 'active':
        await findActiveUsers();
        break;
      
      case 'count':
        await showUserCount();
        break;
      
      default:
        console.log('Available commands:');
        console.log('  all              - List all users');
        console.log('  email <email>    - Find user by email');
        console.log('  id <id>          - Find user by ID');
        console.log('  type <type>      - Find users by type (candidate/expert/admin)');
        console.log('  active           - Find only active users');
        console.log('  count            - Show user count only');
        break;
    }
  } catch (error) {
    console.error('❌ Error checking users:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function listAllUsers() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      userType: true,
      isActive: true,
      isVerified: true,
      createdAt: true,
      totalSessions: true,
      rating: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  console.log(`📊 Total users: ${users.length}\n`);
  
  if (users.length === 0) {
    console.log('No users found in database.');
    return;
  }

  console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
  console.log('│ ID                                    │ Email                    │ Name          │ Type      │ Active │');
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');
  
  users.forEach(user => {
    const id = user.id.substring(0, 36) + '...';
    const email = (user.email || '').padEnd(24).substring(0, 24);
    const name = (user.name || '').padEnd(13).substring(0, 13);
    const type = (user.userType || '').padEnd(9).substring(0, 9);
    const active = user.isActive ? '✅' : '❌';
    console.log(`│ ${id} │ ${email} │ ${name} │ ${type} │ ${active}   │`);
  });
  
  console.log('└─────────────────────────────────────────────────────────────────────────────┘');
}

async function findUserByEmail(email) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: {
      candidateSessions: {
        select: {
          id: true,
          title: true,
          scheduledDate: true,
          status: true
        },
        take: 5,
        orderBy: {
          scheduledDate: 'desc'
        }
      },
      expertSessions: {
        select: {
          id: true,
          title: true,
          scheduledDate: true,
          status: true
        },
        take: 5,
        orderBy: {
          scheduledDate: 'desc'
        }
      }
    }
  });

  if (!user) {
    console.log(`❌ User not found with email: ${email}`);
    return;
  }

  console.log('✅ User found:\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`ID:              ${user.id}`);
  console.log(`Email:           ${user.email}`);
  console.log(`Name:            ${user.name}`);
  console.log(`User Type:       ${user.userType}`);
  console.log(`Active:          ${user.isActive ? '✅ Yes' : '❌ No'}`);
  console.log(`Verified:        ${user.isVerified ? '✅ Yes' : '❌ No'}`);
  console.log(`Phone:           ${user.phone || 'N/A'}`);
  console.log(`Company:         ${user.company || 'N/A'}`);
  console.log(`Title:           ${user.title || 'N/A'}`);
  console.log(`Rating:          ${user.rating || 0}`);
  console.log(`Total Sessions:  ${user.totalSessions || 0}`);
  console.log(`Hourly Rate:     ${user.hourlyRate ? `$${user.hourlyRate}` : 'N/A'}`);
  console.log(`Created At:      ${user.createdAt}`);
  console.log(`Updated At:      ${user.updatedAt}`);
  
  if (user.bio) {
    console.log(`\nBio:\n${user.bio}`);
  }
  
  if (user.skills) {
    try {
      const skills = JSON.parse(user.skills);
      console.log(`\nSkills: ${Array.isArray(skills) ? skills.join(', ') : user.skills}`);
    } catch {
      console.log(`\nSkills: ${user.skills}`);
    }
  }

  if (user.candidateSessions.length > 0) {
    console.log(`\n📅 Recent Candidate Sessions (${user.candidateSessions.length}):`);
    user.candidateSessions.forEach(session => {
      console.log(`   - ${session.title} (${session.scheduledDate.toLocaleString()}) - ${session.status}`);
    });
  }

  if (user.expertSessions.length > 0) {
    console.log(`\n📅 Recent Expert Sessions (${user.expertSessions.length}):`);
    user.expertSessions.forEach(session => {
      console.log(`   - ${session.title} (${session.scheduledDate.toLocaleString()}) - ${session.status}`);
    });
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

async function findUserById(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      userType: true,
      isActive: true,
      isVerified: true,
      phone: true,
      company: true,
      title: true,
      rating: true,
      totalSessions: true,
      hourlyRate: true,
      createdAt: true,
      updatedAt: true,
      bio: true,
      skills: true
    }
  });

  if (!user) {
    console.log(`❌ User not found with ID: ${id}`);
    return;
  }

  console.log('✅ User found:\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(JSON.stringify(user, null, 2));
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

async function findUsersByType(userType) {
  const validTypes = ['candidate', 'expert', 'admin'];
  if (!validTypes.includes(userType.toLowerCase())) {
    console.error(`❌ Invalid user type. Must be one of: ${validTypes.join(', ')}`);
    return;
  }

  const users = await prisma.user.findMany({
    where: {
      userType: userType.toLowerCase()
    },
    select: {
      id: true,
      email: true,
      name: true,
      userType: true,
      isActive: true,
      isVerified: true,
      totalSessions: true,
      rating: true,
      createdAt: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  console.log(`📊 Found ${users.length} ${userType}(s):\n`);
  
  if (users.length === 0) {
    console.log(`No ${userType}s found in database.`);
    return;
  }

  users.forEach((user, index) => {
    console.log(`${index + 1}. ${user.name} (${user.email})`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Active: ${user.isActive ? '✅' : '❌'} | Verified: ${user.isVerified ? '✅' : '❌'}`);
    console.log(`   Sessions: ${user.totalSessions || 0} | Rating: ${user.rating || 0}`);
    console.log('');
  });
}

async function findActiveUsers() {
  const users = await prisma.user.findMany({
    where: {
      isActive: true
    },
    select: {
      id: true,
      email: true,
      name: true,
      userType: true,
      isVerified: true,
      totalSessions: true,
      rating: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  console.log(`📊 Found ${users.length} active user(s):\n`);
  
  if (users.length === 0) {
    console.log('No active users found in database.');
    return;
  }

  users.forEach((user, index) => {
    console.log(`${index + 1}. ${user.name} (${user.email}) - ${user.userType}`);
  });
}

async function showUserCount() {
  const total = await prisma.user.count();
  const candidates = await prisma.user.count({ where: { userType: 'candidate' } });
  const experts = await prisma.user.count({ where: { userType: 'expert' } });
  const admins = await prisma.user.count({ where: { userType: 'admin' } });
  const active = await prisma.user.count({ where: { isActive: true } });
  const verified = await prisma.user.count({ where: { isVerified: true } });

  console.log('📊 User Statistics:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Total Users:     ${total}`);
  console.log(`Candidates:      ${candidates}`);
  console.log(`Experts:         ${experts}`);
  console.log(`Admins:          ${admins}`);
  console.log(`Active Users:    ${active}`);
  console.log(`Verified Users:  ${verified}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// Run the script
checkUsers();

