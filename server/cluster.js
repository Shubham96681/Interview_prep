/**
 * Cluster mode for handling high concurrency (10,000+ users)
 * This enables Node.js to utilize all CPU cores
 */

const cluster = require('cluster');
const os = require('os');
const numCPUs = os.cpus().length;

if (cluster.isMaster || cluster.isPrimary) {
  console.log(`🔄 Master process ${process.pid} is running`);
  console.log(`💻 Starting ${numCPUs} worker processes...`);

  // Fork workers equal to number of CPU cores
  // For production, you might want to use numCPUs - 1 to leave one core for system
  const workers = process.env.NODE_ENV === 'production' ? numCPUs : Math.min(numCPUs, 4);
  
  for (let i = 0; i < workers; i++) {
    cluster.fork();
  }

  // Restart worker if it crashes
  cluster.on('exit', (worker, code, signal) => {
    console.error(`❌ Worker ${worker.process.pid} died (code: ${code}, signal: ${signal})`);
    console.log('🔄 Starting a new worker...');
    cluster.fork();
  });

  // Log worker events
  cluster.on('online', (worker) => {
    console.log(`✅ Worker ${worker.process.pid} is online`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 Master received SIGTERM, shutting down workers...');
    for (const id in cluster.workers) {
      cluster.workers[id].kill();
    }
  });

  process.on('SIGINT', () => {
    console.log('🛑 Master received SIGINT, shutting down workers...');
    for (const id in cluster.workers) {
      cluster.workers[id].kill();
    }
  });
} else {
  // Worker process - start the server
  require('./index.js');
}

