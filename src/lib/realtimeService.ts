// Real-time service for frontend
import backendDetector from './backendDetector';

interface RealtimeEvent {
  event: string;
  data: any;
  timestamp: string;
}

type EventHandler = (data: any) => void;

class RealtimeService {
  private static instance: RealtimeService;
  private eventSource: EventSource | null = null;
  private eventHandlers: Map<string, EventHandler[]> = new Map();
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  static getInstance(): RealtimeService {
    if (!RealtimeService.instance) {
      RealtimeService.instance = new RealtimeService();
    }
    return RealtimeService.instance;
  }

  async connect(userId: string): Promise<void> {
    // Validate userId - must be provided and not a frontend-generated ID
    if (!userId) {
      console.error('❌ RealtimeService: userId is required');
      return;
    }
    
    // Reject frontend-generated IDs
    if (userId.startsWith('user-')) {
      console.error('❌ RealtimeService: Frontend-generated ID detected! Cannot connect with:', userId);
      console.error('❌ This ID will not work with the backend. User must have a valid database ID.');
      return;
    }

    if (this.isConnected) {
      return;
    }

    try {
      // Use relative URL in production (nginx will proxy), localhost in development
      let url: string;
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // Development: detect port
        const port = await backendDetector.detectBackendPort();
        url = `http://localhost:${port}/api/realtime?userId=${userId}`;
      } else {
        // Production: use relative URL (nginx will proxy /api/realtime to backend)
        url = `/api/realtime?userId=${userId}`;
      }
      
      console.log('🔄 Connecting to real-time service...', url);
      
      this.eventSource = new EventSource(url);
      
      this.eventSource.onopen = () => {
        console.log('✅ Real-time connection established');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected', { userId });
      };

      this.eventSource.onmessage = (event) => {
        try {
          const realtimeEvent: RealtimeEvent = JSON.parse(event.data);
          console.log('📨 Real-time event received:', realtimeEvent.event);
          this.emit(realtimeEvent.event, realtimeEvent.data);
        } catch (error) {
          console.error('❌ Error parsing real-time event:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        const target = error.target as EventSource;
        const readyState = target?.readyState;
        
        console.error('❌ Real-time connection error:', error);
        console.error(`❌ EventSource readyState: ${readyState} (0=CONNECTING, 1=OPEN, 2=CLOSED)`);
        console.error(`❌ EventSource URL: ${target?.url}`);
        
        this.isConnected = false;
        
        // Check if EventSource is in a failed state (readyState 2 = CLOSED)
        if (readyState === EventSource.CLOSED) {
          console.warn('⚠️ Real-time connection closed. This may indicate:');
          console.warn('   - The endpoint returned an error (check server logs)');
          console.warn('   - CORS issues');
          console.warn('   - Network/proxy problems');
          console.warn('   - Server-side error in /api/realtime endpoint');
          console.warn('⚠️ If this is production, ensure /api/realtime is properly configured in your proxy/nginx.');
        } else if (readyState === EventSource.CONNECTING) {
          console.warn('⚠️ Connection still connecting, waiting...');
        }
        
        this.handleReconnect(userId);
      };

    } catch (error) {
      console.error('❌ Failed to connect to real-time service:', error);
      this.handleReconnect(userId);
    }
  }

  private handleReconnect(userId: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached. Real-time service will not reconnect automatically.');
      console.error('💡 The real-time endpoint may not be available on this server. The app will continue to work without real-time updates.');
      this.disconnect();
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      // Close existing connection before reconnecting
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
      this.connect(userId);
    }, delay);
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
    console.log('🔌 Real-time connection closed');
  }

  on(event: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`❌ Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  isConnectedToRealtime(): boolean {
    return this.isConnected;
  }

  // Convenience methods for common events
  onSessionCreated(handler: (session: any) => void): void {
    this.on('session_created', handler);
  }

  onSessionUpdated(handler: (session: any) => void): void {
    this.on('session_updated', handler);
  }

  onHeartbeat(handler: (data: any) => void): void {
    this.on('heartbeat', handler);
  }
}

export default RealtimeService.getInstance();












