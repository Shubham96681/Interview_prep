const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { execSync, spawn } = require('child_process');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function main() {
  console.log('Starting in-memory MongoDB replica set for local development...');
  const mongod = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  const uri = mongod.getUri('interview_marketplace');
  process.env.DATABASE_URL = uri;
  console.log(`MongoDB ready at ${uri}`);

  execSync('npx prisma generate', { cwd: __dirname, stdio: 'inherit', env: process.env });
  execSync('npx prisma db push', { cwd: __dirname, stdio: 'inherit', env: process.env });

  try {
    execSync('node scripts/seed.js', { cwd: __dirname, stdio: 'inherit', env: process.env });
    console.log('Database seeded with sample data');
  } catch {
    console.warn('Database seed skipped or failed — server will still start');
  }

  const server = spawn('node', ['index.js'], {
    cwd: __dirname,
    stdio: 'inherit',
    env: process.env,
  });

  const shutdown = async () => {
    server.kill();
    await mongod.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  server.on('exit', async (code) => {
    await mongod.stop();
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error('Failed to start development server:', error);
  process.exit(1);
});
