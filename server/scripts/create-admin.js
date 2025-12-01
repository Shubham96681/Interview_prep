#!/usr/bin/env node

/**
 * Script to create an admin user
 * Usage: node scripts/create-admin.js [email] [password] [name]
 * 
 * Example: node scripts/create-admin.js admin@example.com admin123 "Admin User"
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    // Get command line arguments or use defaults
    const email = process.argv[2] || 'admin@example.com';
    const password = process.argv[3] || 'admin123';
    const name = process.argv[4] || 'Admin User';

    console.log('🔐 Creating admin user...\n');

    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (existingAdmin) {
      console.log(`⚠️  Admin user with email ${email} already exists!`);
      console.log(`   ID: ${existingAdmin.id}`);
      console.log(`   Name: ${existingAdmin.name}`);
      console.log(`   Type: ${existingAdmin.userType}`);
      console.log(`   Active: ${existingAdmin.isActive ? '✅' : '❌'}`);
      
      // Ask if user wants to update to admin
      if (existingAdmin.userType !== 'admin') {
        console.log(`\n⚠️  This user is currently a ${existingAdmin.userType}, not an admin.`);
        console.log('   To convert to admin, you can run:');
        console.log(`   sqlite3 prisma/prod.db "UPDATE users SET userType = 'admin', isActive = 1, isVerified = 1 WHERE email = '${email}';"`);
      }
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        name: name,
        userType: 'admin',
        isActive: true,
        isVerified: true,
        company: 'Interview Prep Platform',
        title: 'Administrator',
        bio: 'Platform Administrator'
      }
    });

    console.log('✅ Admin user created successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`ID:        ${admin.id}`);
    console.log(`Email:     ${admin.email}`);
    console.log(`Name:      ${admin.name}`);
    console.log(`Type:      ${admin.userType}`);
    console.log(`Active:    ${admin.isActive ? '✅ Yes' : '❌ No'}`);
    console.log(`Verified:  ${admin.isVerified ? '✅ Yes' : '❌ No'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n🔑 Admin Credentials:');
    console.log(`   Email:    ${admin.email}`);
    console.log(`   Password: ${password}`);
    console.log('\n💡 You can now login with these credentials.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    if (error.code === 'P2002') {
      console.error('   This email is already registered. Please use a different email.');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createAdmin();

