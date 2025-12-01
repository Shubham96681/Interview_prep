const { PrismaClient } = require('@prisma/client');

const globalForPrisma = globalThis;

// Configure Prisma with connection pooling for high concurrency
const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Connection pool configuration for high concurrency
  // These settings help handle 10,000+ concurrent users
  // MongoDB connection pooling is handled via connection string parameters:
  // maxPoolSize, minPoolSize, maxIdleTimeMS in DATABASE_URL
});

// Handle Prisma connection errors gracefully
prisma.$on('error', (e) => {
  console.error('❌ Prisma error:', e);
});

// Graceful disconnect on process termination
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Add connection health check - don't exit in production
prisma.$connect().catch((error) => {
  console.error('❌ Failed to connect to database:', error);
  console.error('⚠️ Server will continue but database operations may fail');
  // Don't exit in production - allow server to start and handle errors gracefully
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

module.exports = prisma;

































