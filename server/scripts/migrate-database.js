#!/usr/bin/env node

/**
 * Database Migration Utility
 * 
 * This script helps migrate between different database providers (SQLite, PostgreSQL, etc.)
 * It provides easy switching between development (SQLite) and production (PostgreSQL) databases.
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const MIGRATION_CONFIGS = {
  sqlite: {
    provider: 'sqlite',
    url: 'file:./dev.db',
    description: 'SQLite - Perfect for development and testing'
  },
  postgresql: {
    provider: 'postgresql',
    url: process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/interview_marketplace',
    description: 'PostgreSQL - Production-ready database'
  }
};

class DatabaseMigrator {
  constructor() {
    this.currentConfig = null;
    this.targetConfig = null;
  }

  /**
   * Detect current database provider from schema.prisma
   */
  detectCurrentProvider() {
    const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    
    const providerMatch = schemaContent.match(/provider\s*=\s*"([^"]+)"/);
    if (providerMatch) {
      return providerMatch[1];
    }
    
    throw new Error('Could not detect database provider from schema.prisma');
  }

  /**
   * Update schema.prisma with new provider
   */
  updateSchema(provider) {
    const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
    let schemaContent = fs.readFileSync(schemaPath, 'utf8');
    
    // Update provider
    schemaContent = schemaContent.replace(
      /provider\s*=\s*"[^"]+"/,
      `provider = "${provider}"`
    );
    
    fs.writeFileSync(schemaPath, schemaContent);
    console.log(`✅ Updated schema.prisma to use ${provider}`);
  }

  /**
   * Update .env file with new DATABASE_URL
   */
  updateEnvFile(databaseUrl) {
    const envPath = path.join(__dirname, '..', '.env');
    const envExamplePath = path.join(__dirname, '..', 'env.example');
    
    // Read current .env or create from example
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    } else if (fs.existsSync(envExamplePath)) {
      envContent = fs.readFileSync(envExamplePath, 'utf8');
    }
    
    // Update or add DATABASE_URL
    if (envContent.includes('DATABASE_URL=')) {
      envContent = envContent.replace(
        /DATABASE_URL=.*/,
        `DATABASE_URL="${databaseUrl}"`
      );
    } else {
      envContent += `\nDATABASE_URL="${databaseUrl}"\n`;
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log(`✅ Updated .env file with new DATABASE_URL`);
  }

  /**
   * Generate Prisma client
   */
  async generatePrismaClient() {
    const { execSync } = require('child_process');
    
    try {
      console.log('🔄 Generating Prisma client...');
      execSync('npx prisma generate', { 
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit' 
      });
      console.log('✅ Prisma client generated successfully');
    } catch (error) {
      throw new Error(`Failed to generate Prisma client: ${error.message}`);
    }
  }

  /**
   * Run database migrations
   */
  async runMigrations() {
    const { execSync } = require('child_process');
    
    try {
      console.log('🔄 Running database migrations...');
      execSync('npx prisma migrate dev --name init', { 
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit' 
      });
      console.log('✅ Database migrations completed');
    } catch (error) {
      console.log('⚠️  Migration failed, trying to reset...');
      try {
        execSync('npx prisma migrate reset --force', { 
          cwd: path.join(__dirname, '..'),
          stdio: 'inherit' 
        });
        console.log('✅ Database reset and migrations completed');
      } catch (resetError) {
        throw new Error(`Failed to run migrations: ${error.message}`);
      }
    }
  }

  /**
   * Seed the database with test data
   */
  async seedDatabase() {
    const { execSync } = require('child_process');
    
    try {
      console.log('🔄 Seeding database...');
      execSync('npm run seed', { 
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit' 
      });
      console.log('✅ Database seeded successfully');
    } catch (error) {
      console.log('⚠️  Seeding failed:', error.message);
    }
  }

  /**
   * Test database connection
   */
  async testConnection() {
    try {
      const prisma = new PrismaClient();
      await prisma.$connect();
      console.log('✅ Database connection successful');
      await prisma.$disconnect();
      return true;
    } catch (error) {
      console.log('❌ Database connection failed:', error.message);
      return false;
    }
  }

  /**
   * Migrate to a specific database provider
   */
  async migrateTo(provider) {
    if (!MIGRATION_CONFIGS[provider]) {
      throw new Error(`Unknown provider: ${provider}. Available: ${Object.keys(MIGRATION_CONFIGS).join(', ')}`);
    }

    const config = MIGRATION_CONFIGS[provider];
    console.log(`\n🚀 Migrating to ${provider.toUpperCase()}`);
    console.log(`📝 ${config.description}`);
    console.log(`🔗 URL: ${config.url}\n`);

    try {
      // Update schema
      this.updateSchema(config.provider);
      
      // Update .env
      this.updateEnvFile(config.url);
      
      // Generate Prisma client
      await this.generatePrismaClient();
      
      // Run migrations
      await this.runMigrations();
      
      // Test connection
      const connected = await this.testConnection();
      if (!connected) {
        throw new Error('Database connection test failed');
      }
      
      // Seed database (optional)
      if (provider === 'sqlite') {
        await this.seedDatabase();
      }
      
      console.log(`\n🎉 Successfully migrated to ${provider.toUpperCase()}!`);
      console.log('\n📋 Next steps:');
      console.log('1. Start your server: npm start');
      console.log('2. Test the API endpoints');
      console.log('3. Run tests: npm test');
      
    } catch (error) {
      console.error(`\n❌ Migration failed: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Show current database status
   */
  showStatus() {
    const currentProvider = this.detectCurrentProvider();
    console.log(`\n📊 Current Database Status:`);
    console.log(`Provider: ${currentProvider.toUpperCase()}`);
    console.log(`URL: ${process.env.DATABASE_URL || 'Not set'}`);
    
    if (currentProvider === 'sqlite') {
      const dbPath = path.join(__dirname, '..', 'dev.db');
      if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        console.log(`Database file: ${dbPath}`);
        console.log(`Size: ${(stats.size / 1024).toFixed(2)} KB`);
        console.log(`Last modified: ${stats.mtime.toISOString()}`);
      } else {
        console.log(`Database file: Not found (needs migration)`);
      }
    }
  }

  /**
   * Show available migration options
   */
  showOptions() {
    console.log('\n🔄 Available Database Providers:');
    Object.entries(MIGRATION_CONFIGS).forEach(([key, config]) => {
      console.log(`\n${key.toUpperCase()}:`);
      console.log(`  Description: ${config.description}`);
      console.log(`  Provider: ${config.provider}`);
      console.log(`  URL: ${config.url}`);
    });
  }
}

// CLI Interface
async function main() {
  const migrator = new DatabaseMigrator();
  const command = process.argv[2];
  const provider = process.argv[3];

  console.log('🗄️  Database Migration Utility\n');

  switch (command) {
    case 'status':
      migrator.showStatus();
      break;
      
    case 'options':
      migrator.showOptions();
      break;
      
    case 'migrate':
      if (!provider) {
        console.log('❌ Please specify a provider. Usage: node migrate-database.js migrate <provider>');
        console.log('Available providers:', Object.keys(MIGRATION_CONFIGS).join(', '));
        process.exit(1);
      }
      await migrator.migrateTo(provider);
      break;
      
    case 'to-sqlite':
      await migrator.migrateTo('sqlite');
      break;
      
    case 'to-postgresql':
      await migrator.migrateTo('postgresql');
      break;
      
    default:
      console.log('📖 Usage:');
      console.log('  node migrate-database.js status                    - Show current database status');
      console.log('  node migrate-database.js options                   - Show available providers');
      console.log('  node migrate-database.js migrate <provider>        - Migrate to specific provider');
      console.log('  node migrate-database.js to-sqlite                 - Quick migrate to SQLite');
      console.log('  node migrate-database.js to-postgresql             - Quick migrate to PostgreSQL');
      console.log('\nExamples:');
      console.log('  node migrate-database.js to-sqlite                 # For development');
      console.log('  node migrate-database.js to-postgresql             # For production');
      break;
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = DatabaseMigrator;


























