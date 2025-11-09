const EventEmitter = require('events');

class RealtimeService extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map(); // userId -> Set of connections
    this.heartbeatInterval = null;
  }

  start() {
    console.log('🔄 Starting real-time service...');
    
    // Start heartbeat to keep connections alive
    this.heartbeatInterval = setInterval(() => {
      this.broadcastHeartbeat();
    }, 30000); // 30 seconds

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
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId).add(connection);
    
    console.log(`📱 User ${userId} connected (${this.connections.get(userId).size} connections)`);
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












