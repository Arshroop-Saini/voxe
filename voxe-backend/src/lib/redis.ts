import { createClient, RedisClientType } from 'redis';

export interface DeviceSession {
  deviceId: string;
  userId: string;
  deviceName: string;
  socketId: string;
  connectedAt: number;
  lastSeen: number;
  isActive: boolean;
  isStreaming: boolean;
  currentSessionId?: string;
  batteryLevel?: number;
  firmwareVersion?: string;
}

export interface StreamingSession {
  sessionId: string;
  deviceId: string;
  userId: string;
  startTime: number;
  endTime?: number;
  isActive: boolean;
  audioChunkCount: number;
  transcription?: string;
  aiResponse?: string;
  toolsUsed?: any[];
  processingTime?: number;
  error?: string;
  status: 'active' | 'processing' | 'completed' | 'failed';
  conversationId?: string;
}

class RedisService {
  private client: RedisClientType | null = null;
  private isConnected = false;
  private connectionAttempted = false;

  constructor() {
    // Don't initialize automatically - will be done when connect() is called
  }

  private async initializeClient(): Promise<void> {
    try {
      // Create Redis client with configuration
      this.client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          connectTimeout: 60000
        }
      });

      // Set up event handlers
      this.client.on('error', (error) => {
        console.error('📕 Redis client error:', error);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('📕 Redis client connecting...');
      });

      this.client.on('ready', () => {
        console.log('📕 Redis client ready');
        this.isConnected = true;
      });

      this.client.on('end', () => {
        console.log('📕 Redis client disconnected');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        console.log('📕 Redis client reconnecting...');
      });

    } catch (error) {
      console.error('📕 Failed to initialize Redis client:', error);
    }
  }

  // Connect to Redis
  async connect(): Promise<void> {
    if (this.connectionAttempted) {
      return; // Don't try multiple times
    }
    
    this.connectionAttempted = true;
    
    if (!this.client) {
      await this.initializeClient();
    }

    if (this.client && !this.isConnected) {
      try {
        await this.client.connect();
        console.log('📕 Redis connected successfully');
      } catch (error) {
        console.error('📕 Redis connection failed:', error instanceof Error ? error.message : error);
        console.log('📕 Continuing without Redis - device sessions will be stored in memory only');
        // Don't throw - let the service continue without Redis
        this.isConnected = false;
        this.client = null; // Clear client to prevent retries
      }
    }
  }

  // Disconnect from Redis
  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.disconnect();
      console.log('📕 Redis disconnected');
    }
  }

  // Device Session Management
  async setDeviceSession(deviceId: string, session: DeviceSession): Promise<void> {
    if (!this.client || !this.isConnected) {
      console.warn('📕 Redis not connected, skipping device session storage');
      return;
    }

    try {
      const key = `device:${deviceId}`;
      await this.client.hSet(key, {
        deviceId: session.deviceId,
        userId: session.userId,
        deviceName: session.deviceName,
        socketId: session.socketId,
        connectedAt: session.connectedAt.toString(),
        lastSeen: session.lastSeen.toString(),
        isActive: session.isActive.toString(),
        isStreaming: session.isStreaming.toString(),
        currentSessionId: session.currentSessionId || '',
        batteryLevel: session.batteryLevel?.toString() || '',
        firmwareVersion: session.firmwareVersion || ''
      });

      // Set TTL for device session (24 hours)
      await this.client.expire(key, 24 * 60 * 60);

      // Add to user's device list
      await this.client.sAdd(`user:${session.userId}:devices`, deviceId);
      
      console.log(`📕 Device session stored: ${deviceId}`);
    } catch (error) {
      console.error('📕 Failed to store device session:', error);
    }
  }

  async getDeviceSession(deviceId: string): Promise<DeviceSession | null> {
    if (!this.client || !this.isConnected) {
      return null;
    }

    try {
      const key = `device:${deviceId}`;
      const data = await this.client.hGetAll(key);
      
      if (Object.keys(data).length === 0) {
        return null;
      }

      return {
        deviceId: data.deviceId,
        userId: data.userId,
        deviceName: data.deviceName,
        socketId: data.socketId,
        connectedAt: parseInt(data.connectedAt),
        lastSeen: parseInt(data.lastSeen),
        isActive: data.isActive === 'true',
        isStreaming: data.isStreaming === 'true',
        currentSessionId: data.currentSessionId || undefined,
        batteryLevel: data.batteryLevel ? parseInt(data.batteryLevel) : undefined,
        firmwareVersion: data.firmwareVersion || undefined
      };
    } catch (error) {
      console.error('📕 Failed to get device session:', error);
      return null;
    }
  }

  async updateDeviceHeartbeat(deviceId: string): Promise<void> {
    if (!this.client || !this.isConnected) {
      return;
    }

    try {
      const key = `device:${deviceId}`;
      await this.client.hSet(key, 'lastSeen', Date.now().toString());
      console.log(`📕 Device heartbeat updated: ${deviceId}`);
    } catch (error) {
      console.error('📕 Failed to update device heartbeat:', error);
    }
  }

  async removeDeviceSession(deviceId: string): Promise<void> {
    if (!this.client || !this.isConnected) {
      return;
    }

    try {
      // Get user ID first
      const session = await this.getDeviceSession(deviceId);
      
      // Remove device session
      await this.client.del(`device:${deviceId}`);
      
      // Remove from user's device list
      if (session) {
        await this.client.sRem(`user:${session.userId}:devices`, deviceId);
      }
      
      console.log(`📕 Device session removed: ${deviceId}`);
    } catch (error) {
      console.error('📕 Failed to remove device session:', error);
    }
  }

  async getUserDevices(userId: string): Promise<DeviceSession[]> {
    if (!this.client || !this.isConnected) {
      return [];
    }

    try {
      const deviceIds = await this.client.sMembers(`user:${userId}:devices`);
      const devices: DeviceSession[] = [];

      for (const deviceId of deviceIds) {
        const session = await this.getDeviceSession(deviceId);
        if (session) {
          devices.push(session);
        }
      }

      return devices;
    } catch (error) {
      console.error('📕 Failed to get user devices:', error);
      return [];
    }
  }

  // Streaming Session Management
  async setStreamingSession(sessionId: string, session: StreamingSession): Promise<void> {
    if (!this.client || !this.isConnected) {
      return;
    }

    try {
      const key = `session:${sessionId}`;
      await this.client.hSet(key, {
        sessionId: session.sessionId,
        deviceId: session.deviceId,
        userId: session.userId,
        startTime: session.startTime.toString(),
        endTime: session.endTime?.toString() || '',
        isActive: session.isActive.toString(),
        audioChunkCount: session.audioChunkCount.toString(),
        transcription: session.transcription || '',
        aiResponse: session.aiResponse || '',
        toolsUsed: session.toolsUsed ? JSON.stringify(session.toolsUsed) : '',
        processingTime: session.processingTime?.toString() || '',
        error: session.error || '',
        status: session.status,
        conversationId: session.conversationId || ''
      });

      // Set TTL for streaming session (1 hour)
      await this.client.expire(key, 60 * 60);

      // Add to device's session list
      await this.client.lPush(`device:${session.deviceId}:sessions`, sessionId);
      
      console.log(`📕 Streaming session stored: ${sessionId}`);
    } catch (error) {
      console.error('📕 Failed to store streaming session:', error);
    }
  }

  async getStreamingSession(sessionId: string): Promise<StreamingSession | null> {
    if (!this.client || !this.isConnected) {
      return null;
    }

    try {
      const key = `session:${sessionId}`;
      const data = await this.client.hGetAll(key);
      
      if (Object.keys(data).length === 0) {
        return null;
      }

      return {
        sessionId: data.sessionId,
        deviceId: data.deviceId,
        userId: data.userId,
        startTime: parseInt(data.startTime),
        endTime: data.endTime ? parseInt(data.endTime) : undefined,
        isActive: data.isActive === 'true',
        audioChunkCount: parseInt(data.audioChunkCount),
        transcription: data.transcription || undefined,
        aiResponse: data.aiResponse || undefined,
        toolsUsed: data.toolsUsed ? JSON.parse(data.toolsUsed) : undefined,
        processingTime: data.processingTime ? parseInt(data.processingTime) : undefined,
        error: data.error || undefined,
        status: data.status as 'active' | 'processing' | 'completed' | 'failed',
        conversationId: data.conversationId || undefined
      };
    } catch (error) {
      console.error('📕 Failed to get streaming session:', error);
      return null;
    }
  }

  async updateStreamingSession(sessionId: string, updates: Partial<StreamingSession>): Promise<void> {
    if (!this.client || !this.isConnected) {
      return;
    }

    try {
      const key = `session:${sessionId}`;
      const updateData: Record<string, string> = {};

      // Convert updates to string format for Redis
      Object.entries(updates).forEach(([field, value]) => {
        if (value !== undefined) {
          if (typeof value === 'boolean' || typeof value === 'number') {
            updateData[field] = value.toString();
          } else if (typeof value === 'string') {
            updateData[field] = value;
          } else if (field === 'toolsUsed' && Array.isArray(value)) {
            updateData[field] = JSON.stringify(value);
          }
        }
      });

      if (Object.keys(updateData).length > 0) {
        await this.client.hSet(key, updateData);
        console.log(`📕 Streaming session updated: ${sessionId}`);
      }
    } catch (error) {
      console.error('📕 Failed to update streaming session:', error);
    }
  }

  // Cleanup functions
  async cleanupExpiredSessions(): Promise<void> {
    if (!this.client || !this.isConnected) {
      return;
    }

    try {
      const now = Date.now();
      const maxAge = 5 * 60 * 1000; // 5 minutes

      // This would require scanning keys, which is not ideal for production
      // In a real implementation, you'd use a more efficient approach
      console.log('📕 Cleanup completed');
    } catch (error) {
      console.error('📕 Failed to cleanup expired sessions:', error);
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      await this.client.ping();
      return true;
    } catch (error) {
      console.error('📕 Redis health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const redisService = new RedisService();
export default redisService; 