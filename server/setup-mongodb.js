#!/usr/bin/env node

/**
 * MongoDB Setup Script
 * This script helps set up MongoDB for the interview marketplace application
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

console.log('🚀 Setting up MongoDB for Interview Marketplace...\n');

// Step 1: Check if MongoDB is running
console.log('1️⃣  Checking MongoDB connection...');
const defaultMongoUrl = 'mongodb://localhost:27017/interview_marketplace?retryWrites=true&w=majority';

// First, check if DATABASE_URL is set to MongoDB
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('mongodb')) {
  console.log('⚠️  DATABASE_URL is not set to MongoDB');
  console.log('📝 Updating .env file...');
  
  const envPath = path.join(__dirname, '.env');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
    // Replace DATABASE_URL with MongoDB connection string
    envContent = envContent.replace(
      /DATABASE_URL=.*/,
      `DATABASE_URL="${defaultMongoUrl}"`
    );
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Updated .env file with MongoDB connection string');
    // Reload env
    require('dotenv').config({ override: true });
  }
}

try {
  const { MongoClient } = require('mongodb');
  const mongoUrl = process.env.DATABASE_URL || defaultMongoUrl;
  const client = new MongoClient(mongoUrl);
  
  client.connect().then(() => {
    console.log('✅ MongoDB is running and accessible');
    client.close();
  }).catch((error) => {
    console.error('❌ Cannot connect to MongoDB:', error.message);
    console.error('\n💡 Make sure MongoDB is running:');
    console.error('   - Local: mongod (or check service status)');
    console.error('   - Docker: docker start mongodb');
    console.error('   - Windows Service: Check Services app');
    console.error(`   - Connection string: ${mongoUrl}`);
    process.exit(1);
  });
} catch (error) {
  console.error('❌ Error checking MongoDB:', error.message);
  process.exit(1);
}

// Step 2: Update .env file if needed
console.log('\n2️⃣  Checking .env configuration...');
const envPath = path.join(__dirname, '.env');
let envContent = '';

if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
  
  if (!envContent.includes('mongodb://') && !envContent.includes('mongodb+srv://')) {
    console.log('⚠️  DATABASE_URL in .env is not set to MongoDB');
    console.log('📝 Please update .env file with:');
    console.log('   DATABASE_URL="mongodb://localhost:27017/interview_marketplace?retryWrites=true&w=majority"');
    console.log('\n   Or run: npm run setup:mongodb');
  } else {
    console.log('✅ DATABASE_URL is configured for MongoDB');
  }
} else {
  console.log('⚠️  .env file not found');
  console.log('📝 Creating .env from env.example...');
  if (fs.existsSync(path.join(__dirname, 'env.example'))) {
    fs.copyFileSync(path.join(__dirname, 'env.example'), envPath);
    // Update DATABASE_URL to MongoDB
    envContent = fs.readFileSync(envPath, 'utf8');
    envContent = envContent.replace(
      /DATABASE_URL=.*/,
      'DATABASE_URL="mongodb://localhost:27017/interview_marketplace?retryWrites=true&w=majority&maxPoolSize=50&minPoolSize=10&maxIdleTimeMS=30000"'
    );
    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env file created with MongoDB configuration');
  }
}

// Step 3: Generate Prisma client
console.log('\n3️⃣  Generating Prisma client...');
try {
  execSync('npx prisma generate', { 
    cwd: __dirname,
    stdio: 'inherit' 
  });
  console.log('✅ Prisma client generated');
} catch (error) {
  console.error('❌ Failed to generate Prisma client:', error.message);
  process.exit(1);
}

// Step 4: Push schema to MongoDB
console.log('\n4️⃣  Pushing schema to MongoDB...');
try {
  execSync('npx prisma db push', { 
    cwd: __dirname,
    stdio: 'inherit' 
  });
  console.log('✅ Database schema pushed to MongoDB');
} catch (error) {
  console.error('❌ Failed to push schema:', error.message);
  console.error('\n💡 Make sure:');
  console.error('   1. MongoDB is running');
  console.error('   2. DATABASE_URL in .env is correct');
  console.error('   3. You have write permissions to the database');
  process.exit(1);
}

// Step 5: Verify connection
console.log('\n5️⃣  Verifying database connection...');
try {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  prisma.$connect().then(async () => {
    const userCount = await prisma.user.count();
    console.log(`✅ Connected to MongoDB successfully`);
    console.log(`📊 Current users in database: ${userCount}`);
    
    await prisma.$disconnect();
    console.log('\n🎉 MongoDB setup completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   - Run "npm run db:seed" to seed the database');
    console.log('   - Run "npm run db:create-admin" to create an admin user');
    console.log('   - Start the server with "npm start"');
  }).catch((error) => {
    console.error('❌ Failed to verify connection:', error.message);
    process.exit(1);
  });
} catch (error) {
  console.error('❌ Error verifying connection:', error.message);
  process.exit(1);
}

