import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface GlassesConnectionStatus {
  deviceId: string;
  deviceName: string;
  isConnected: boolean;
  isStreaming: boolean;
  lastSeen: string;
  batteryLevel?: number;
}

export interface StreamingSession {
  sessionId: string;
  deviceId: string;
  deviceName: string;
  isActive: boolean;
  startTime: string;
  transcription?: string;
  aiResponse?: string;
}

export interface WebSocketEvents {
  // WebSocket connection events
  'connection:established': () => void;
  'connection:lost': (data: { reason: string }) => void;
  'connection:failed': () => void;
  
  // Glasses connection events
  'glasses:connected': (data: { deviceId: string; deviceName: string }) => void;
  'glasses:disconnected': (data: { deviceId: string; deviceName: string }) => void;
  
  // Streaming events
  'glasses:stream_started': (data: { deviceId: string; deviceName: string; sessionId: string; timestamp: string }) => void;
  'glasses:stream_stopped': (data: { deviceId: string; deviceName: string; timestamp: string }) => void;
  'glasses:audio_activity': (data: { deviceId: string; timestamp: string; chunkSize: number }) => void;
  
  // AI processing events
  'glasses:transcription_started': (data: { deviceId: string; sessionId: string; timestamp: string }) => void;
  'glasses:transcription': (data: { deviceId: string; sessionId: string; transcription: string; timestamp: string }) => void;
  'glasses:ai_response': (data: { deviceId: string; sessionId: string; response: string; toolsUsed?: any[]; processingTime?: number; timestamp: string }) => void;
  'glasses:processing_error': (data: { deviceId: string; sessionId: string; error: string; timestamp: string }) => void;
  
  // Error events
  'glasses:error': (data: { deviceId: string; deviceName: string; error: string; timestamp: string }) => void;
}

class WebSocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private eventListeners: Map<string, Function[]> = new Map();
  private baseUrl: string;
  
  // Connection state
  private connectedGlasses: Map<string, GlassesConnectionStatus> = new Map();
  private activeSession: StreamingSession | null = null;

  constructor() {
    this.baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3002';
  }

  // Initialize WebSocket connection
  async connect(): Promise<void> {
    try {
      if (this.socket && this.isConnected) {
        console.log('📱 WebSocket already connected');
        return;
      }

      console.log('📱 Connecting to WebSocket server...');
      
      // Get user authentication token from AsyncStorage
      const token = await AsyncStorage.getItem('userToken');
      const userId = await AsyncStorage.getItem('userId');
      
      if (!token || !userId) {
        throw new Error('User authentication required');
      }

      this.socket = io(this.baseUrl, {
        auth: {
          token,
          userId,
          type: 'mobile_app'
        },
        transports: ['websocket', 'polling'],
        timeout: 10000,
        forceNew: true
      });

      this.setupEventHandlers();
      
    } catch (error) {
      console.error('📱 WebSocket connection failed:', error);
      this.handleReconnect();
    }
  }

  // Setup event handlers for WebSocket connection
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('📱 WebSocket connected successfully');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connection:established');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('📱 WebSocket disconnected:', reason);
      this.isConnected = false;
      this.emit('connection:lost', { reason });
      
      if (reason === 'io server disconnect') {
        // Server disconnected, don't try to reconnect
        return;
      }
      
      this.handleReconnect();
    });

    this.socket.on('connect_error', (error) => {
      console.error('📱 WebSocket connection error:', error);
      this.handleReconnect();
    });

    // Glasses connection events
    this.socket.on('glasses:connected', (data) => {
      console.log('🤓 Glasses connected:', data);
      this.connectedGlasses.set(data.deviceId, {
        deviceId: data.deviceId,
        deviceName: data.deviceName,
        isConnected: true,
        isStreaming: false,
        lastSeen: new Date().toISOString()
      });
      this.emit('glasses:connected', data);
    });

    this.socket.on('glasses:disconnected', (data) => {
      console.log('🤓 Glasses disconnected:', data);
      this.connectedGlasses.delete(data.deviceId);
      this.emit('glasses:disconnected', data);
    });

    // Streaming events
    this.socket.on('glasses:stream_started', (data) => {
      console.log('🎙️ Streaming started:', data);
      const glasses = this.connectedGlasses.get(data.deviceId);
      if (glasses) {
        glasses.isStreaming = true;
        this.connectedGlasses.set(data.deviceId, glasses);
      }
      
      this.activeSession = {
        sessionId: data.sessionId,
        deviceId: data.deviceId,
        deviceName: data.deviceName,
        isActive: true,
        startTime: data.timestamp
      };
      
      this.emit('glasses:stream_started', data);
    });

    this.socket.on('glasses:stream_stopped', (data) => {
      console.log('🛑 Streaming stopped:', data);
      const glasses = this.connectedGlasses.get(data.deviceId);
      if (glasses) {
        glasses.isStreaming = false;
        this.connectedGlasses.set(data.deviceId, glasses);
      }
      
      if (this.activeSession) {
        this.activeSession.isActive = false;
        this.activeSession = null;
      }
      
      this.emit('glasses:stream_stopped', data);
    });

    this.socket.on('glasses:audio_activity', (data) => {
      console.log('🎵 Audio activity:', data);
      this.emit('glasses:audio_activity', data);
    });

    // AI processing events
    this.socket.on('glasses:transcription', (data) => {
      console.log('📝 Transcription received:', data);
      if (this.activeSession && this.activeSession.sessionId === data.sessionId) {
        this.activeSession.transcription = data.transcription;
      }
      this.emit('glasses:transcription', data);
    });

    this.socket.on('glasses:ai_response', (data) => {
      console.log('🤖 AI response received:', data);
      if (this.activeSession && this.activeSession.sessionId === data.sessionId) {
        this.activeSession.aiResponse = data.response;
      }
      this.emit('glasses:ai_response', data);
    });

    // Error events
    this.socket.on('glasses:error', (data) => {
      console.error('❌ Glasses error:', data);
      this.emit('glasses:error', data);
    });
  }

  // Handle reconnection logic
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('📱 Max reconnection attempts reached');
      this.emit('connection:failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`📱 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  // Event system for components to listen to WebSocket events
  on<K extends keyof WebSocketEvents>(event: K, callback: WebSocketEvents[K]): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off<K extends keyof WebSocketEvents>(event: K, callback: WebSocketEvents[K]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  // Send commands to glasses (for future use)
  sendToGlasses(deviceId: string, command: string, data?: any): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('mobile:command', {
        deviceId,
        command,
        data,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Get current connection status
  getConnectionStatus(): {
    isConnected: boolean;
    connectedGlasses: GlassesConnectionStatus[];
    activeSession: StreamingSession | null;
  } {
    return {
      isConnected: this.isConnected,
      connectedGlasses: Array.from(this.connectedGlasses.values()),
      activeSession: this.activeSession
    };
  }

  // Disconnect WebSocket
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.connectedGlasses.clear();
      this.activeSession = null;
      console.log('📱 WebSocket disconnected');
    }
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();
export default websocketService; 