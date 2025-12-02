const EventEmitter = require('events');

class RealtimeService extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map(); // userId -> Set of connections
    this.heartbeatInterval = null;
    this.maxConnectionsPerUser = 10; // Increased for legitimate multi-tab usage
    this.maxTotalConnections = 10000; // Maximum total connections (supports 10K concurrent users)
    this.connectionCleanupInterval = null;
  }

  start() {
    console.log('🔄 Starting real-time service...');
    console.log(`📊 Max connections: ${this.maxTotalConnections}, Max per user: ${this.maxConnectionsPerUser}`);
    
    // Start heartbeat to keep connections alive
    // Use 15 seconds to prevent proxy timeouts (many proxies timeout SSE after 20-30s of inactivity)
    this.heartbeatInterval = setInterval(() => {
      this.broadcastHeartbeat();
    }, 15000); // 15 seconds - safer for proxies and load balancers

    // Clean up stale connections every 5 minutes
    this.connectionCleanupInterval = setInterval(() => {
      this.cleanupStaleConnections();
    }, 5 * 60 * 1000); // 5 minutes

    console.log('✅ Real-time service started');
  }

  stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    console.log('🛑 Real-time service stopped');
  }

  // Add a connection for a user
  addConnection(userId, connection) {
    // Check total connection limit
    if (this.getTotalConnections() >= this.maxTotalConnections) {
      console.warn(`⚠️ Maximum connection limit reached (${this.maxTotalConnections})`);
      try {
        connection.write('data: ' + JSON.stringify({
          event: 'error',
          data: { message: 'Server at capacity, please try again later' }
        }) + '\n\n');
        connection.end();
      } catch (error) {
        // Connection already closed
      }
      return false;
    }

    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    
    const userConnections = this.connections.get(userId);
    
    // Limit connections per user
    if (userConnections.size >= this.maxConnectionsPerUser) {
      console.warn(`⚠️ User ${userId} has too many connections (${userConnections.size})`);
      // Remove oldest connection
      const firstConnection = userConnections.values().next().value;
      this.removeConnection(userId, firstConnection);
    }
    
    userConnections.add(connection);
    
    // Clean up on connection close
    connection.on('close', () => {
      this.removeConnection(userId, connection);
    });
    
    connection.on('error', (error) => {
      console.error(`❌ Connection error for user ${userId}:`, error);
      this.removeConnection(userId, connection);
    });
    
    if (this.getTotalConnections() % 100 === 0) {
      console.log(`📱 Total connections: ${this.getTotalConnections()}`);
    }
    
    return true;
  }

  // Remove a connection for a user
  removeConnection(userId, connection) {
    if (this.connections.has(userId)) {
      this.connections.get(userId).delete(connection);
      
      if (this.connections.get(userId).size === 0) {
        this.connections.delete(userId);
      }
      
      console.log(`📱 User ${userId} disconnected (${this.connections.get(userId)?.size || 0} connections)`);
    }
  }

  // Send data to a specific user
  sendToUser(userId, event, data) {
    if (this.connections.has(userId)) {
      const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
      
      this.connections.get(userId).forEach(connection => {
        try {
          connection.write(`data: ${message}\n\n`);
        } catch (error) {
          console.error(`❌ Error sending to user ${userId}:`, error);
          this.removeConnection(userId, connection);
        }
      });
    }
  }

  // Broadcast to all connected users
  broadcast(event, data) {
    const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
    
    this.connections.forEach((connections, userId) => {
      connections.forEach(connection => {
        try {
          connection.write(`data: ${message}\n\n`);
        } catch (error) {
          console.error(`❌ Error broadcasting to user ${userId}:`, error);
          this.removeConnection(userId, connection);
        }
      });
    });
  }

  // Send heartbeat to all connections
  broadcastHeartbeat() {
    this.broadcast('heartbeat', { status: 'alive' });
  }

  // Notify about session updates
  notifySessionUpdate(userId, session) {
    this.sendToUser(userId, 'session_updated', session);
  }

  // Notify about new session
  notifyNewSession(userId, session) {
    this.sendToUser(userId, 'session_created', session);
  }

  // Get connection count for a user
  getConnectionCount(userId) {
    return this.connections.get(userId)?.size || 0;
  }

  // Get total connection count
  getTotalConnections() {
    let total = 0;
    this.connections.forEach(connections => {
      total += connections.size;
    });
    return total;
  }
}

module.exports = new RealtimeService();























