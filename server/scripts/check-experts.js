#!/usr/bin/env node

/**
 * Database Query Script - Check Experts
 * This script queries the database to find all experts and their IDs
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkExperts() {
  try {
    console.log('🔍 Querying database for experts...\n');
    
    // Find all experts
    const experts = await prisma.user.findMany({
      where: {
        userType: 'expert'
      },
      select: {
        id: true,
        email: true,
        name: true,
        title: true,
        company: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        hourlyRate: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (experts.length === 0) {
      console.log('❌ No experts found in the database.\n');
      console.log('💡 You may need to register an expert first.');
      return;
    }

    console.log(`✅ Found ${experts.length} expert(s) in the database:\n`);
    console.log('='.repeat(80));
    
    experts.forEach((expert, index) => {
      console.log(`\n📋 Expert #${index + 1}:`);
      console.log(`   ID:        ${expert.id}`);
      console.log(`   Name:      ${expert.name}`);
      console.log(`   Email:     ${expert.email}`);
      console.log(`   Title:     ${expert.title || 'N/A'}`);
      console.log(`   Company:   ${expert.company || 'N/A'}`);
      console.log(`   Rate:      $${expert.hourlyRate || 0}/hour`);
      console.log(`   Active:    ${expert.isActive ? '✅ Yes' : '❌ No'}`);
      console.log(`   Verified:  ${expert.isVerified ? '✅ Yes' : '❌ No'}`);
      console.log(`   Created:   ${expert.createdAt.toISOString()}`);
      console.log(`   Profile URL: https://54.91.53.228/expert/${expert.id}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('\n💡 To view an expert profile, use the Profile URL shown above.');
    console.log('💡 Make sure to use the actual database ID (starts with "cl"), not a frontend-generated ID.\n');

  } catch (error) {
    console.error('❌ Error querying database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
checkExperts();

