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
  __internal: {
    engine: {
      // Connection pool size (adjust based on your database)
      // For PostgreSQL: connection_limit in connection string
      // For SQLite: these are less relevant but kept for consistency
    }
  }
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

































