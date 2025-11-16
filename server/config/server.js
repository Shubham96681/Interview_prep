const net = require('net');

// Auto-detect available port
async function findAvailablePort(startPort = 5000, maxPort = 5010) {
  for (let port = startPort; port <= maxPort; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available ports found between ${startPort} and ${maxPort}`);
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.listen(port, () => {
      server.once('close', () => {
        resolve(true);
      });
      server.close();
    });
    
    server.on('error', () => {
      resolve(false);
    });
  });
}

// Server configuration
const config = {
  // Auto-detect port
  getPort: async () => {
    const envPort = process.env.PORT;
    if (envPort) {
      const port = parseInt(envPort);
      if (await isPortAvailable(port)) {
        return port;
      }
    }
    return await findAvailablePort();
  },
  
  // Database configuration
  database: {
    url: process.env.DATABASE_URL || 'file:./dev.db',
    autoMigrate: true,
    autoSeed: false // Only seed if database is empty
  },
  
  // CORS configuration
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
  },
  
  // Real-time configuration
  realtime: {
    enabled: true,
    heartbeatInterval: 30000 // 30 seconds
  }
};

module.exports = config;


















