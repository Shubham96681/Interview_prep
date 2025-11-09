const { Server } = require('socket.io');

class WebRTCService {
  constructor() {
    this.io = null;
    this.rooms = new Map(); // meetingId -> Set of socketIds
    this.socketToRoom = new Map(); // socketId -> meetingId
    this.socketToUser = new Map(); // socketId -> userId
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    this.io.on('connection', (socket) => {
      console.log('🔌 WebRTC client connected:', socket.id);

      // Join a meeting room
      socket.on('join-meeting', ({ meetingId, userId }) => {
        console.log(`👤 User ${userId} joining meeting ${meetingId}`);
        
        if (!this.rooms.has(meetingId)) {
          this.rooms.set(meetingId, new Set());
        }
        
        this.rooms.get(meetingId).add(socket.id);
        this.socketToRoom.set(socket.id, meetingId);
        this.socketToUser.set(socket.id, userId);
        
        socket.join(meetingId);
        
        // Notify others in the room
        const otherUsers = Array.from(this.rooms.get(meetingId))
          .filter(id => id !== socket.id)
          .map(id => this.socketToUser.get(id));
        
        socket.emit('joined-meeting', {
          meetingId,
          otherUsers,
          socketId: socket.id
        });
        
        // Notify others that a new user joined
        socket.to(meetingId).emit('user-joined', {
          userId,
          socketId: socket.id
        });
      });

      // Handle WebRTC offer
      socket.on('offer', ({ meetingId, offer, targetSocketId }) => {
        console.log(`📤 Offer from ${socket.id} to ${targetSocketId}`);
        socket.to(targetSocketId).emit('offer', {
          offer,
          senderSocketId: socket.id
        });
      });

      // Handle WebRTC answer
      socket.on('answer', ({ meetingId, answer, targetSocketId }) => {
        console.log(`📥 Answer from ${socket.id} to ${targetSocketId}`);
        socket.to(targetSocketId).emit('answer', {
          answer,
          senderSocketId: socket.id
        });
      });

      // Handle ICE candidates
      socket.on('ice-candidate', ({ meetingId, candidate, targetSocketId }) => {
        socket.to(targetSocketId).emit('ice-candidate', {
          candidate,
          senderSocketId: socket.id
        });
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log('🔌 WebRTC client disconnected:', socket.id);
        
        const meetingId = this.socketToRoom.get(socket.id);
        if (meetingId && this.rooms.has(meetingId)) {
          this.rooms.get(meetingId).delete(socket.id);
          
          if (this.rooms.get(meetingId).size === 0) {
            this.rooms.delete(meetingId);
          } else {
            // Notify others that user left
            socket.to(meetingId).emit('user-left', {
              socketId: socket.id,
              userId: this.socketToUser.get(socket.id)
            });
          }
        }
        
        this.socketToRoom.delete(socket.id);
        this.socketToUser.delete(socket.id);
      });

      // Handle recording status
      socket.on('recording-status', ({ meetingId, isRecording }) => {
        socket.to(meetingId).emit('recording-status', {
          isRecording,
          socketId: socket.id
        });
      });
    });

    console.log('✅ WebRTC signaling service initialized');
  }

  getIO() {
    return this.io;
  }

  getRoomUsers(meetingId) {
    if (!this.rooms.has(meetingId)) {
      return [];
    }
    return Array.from(this.rooms.get(meetingId))
      .map(socketId => this.socketToUser.get(socketId))
      .filter(Boolean);
  }
}

module.exports = new WebRTCService();

