#!/usr/bin/env node

/**
 * Simple SQLite Setup Script
 * This script sets up SQLite for the InterviewAce project
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🗄️  Setting up SQLite for InterviewAce...\n');

// Step 1: Update schema.prisma
console.log('1️⃣  Updating Prisma schema...');
const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
let schemaContent = fs.readFileSync(schemaPath, 'utf8');

// Update provider to sqlite
schemaContent = schemaContent.replace(
  /provider\s*=\s*"[^"]+"/,
  'provider = "sqlite"'
);

fs.writeFileSync(schemaPath, schemaContent);
console.log('✅ Schema updated to use SQLite');

// Step 2: Create .env file
console.log('\n2️⃣  Creating .env file...');
const envContent = `# Server Configuration
PORT=5000
NODE_ENV=development

# Database - SQLite
DATABASE_URL="file:./dev.db"

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# File Upload
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
`;

fs.writeFileSync(path.join(__dirname, '.env'), envContent);
console.log('✅ .env file created');

// Step 3: Generate Prisma client
console.log('\n3️⃣  Generating Prisma client...');
try {
  execSync('npx prisma generate', { 
    cwd: __dirname,
    stdio: 'inherit' 
  });
  console.log('✅ Prisma client generated');
} catch (error) {
  console.log('⚠️  Prisma generate failed, trying alternative approach...');
  
  // Try with different approach
  try {
    execSync('npx prisma db push', { 
      cwd: __dirname,
      stdio: 'inherit' 
    });
    console.log('✅ Database schema pushed');
  } catch (pushError) {
    console.log('❌ Database setup failed:', pushError.message);
    process.exit(1);
  }
}

// Step 4: Seed database
console.log('\n4️⃣  Seeding database...');
try {
  execSync('node scripts/seed.js', { 
    cwd: __dirname,
    stdio: 'inherit' 
  });
  console.log('✅ Database seeded');
} catch (error) {
  console.log('⚠️  Seeding failed:', error.message);
  console.log('You can run "npm run seed" later to seed the database');
}

console.log('\n🎉 SQLite setup completed successfully!');
console.log('\n📋 Next steps:');
console.log('1. Start the server: npm start');
console.log('2. Test the API: curl http://localhost:5000/api/health');
console.log('3. Run tests: npm test');
console.log('\n🔑 Test credentials:');
console.log('Candidate: john@example.com / password123');
console.log('Expert: jane@example.com / password123');



























