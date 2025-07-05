import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { authenticateDevice } from './auth.js';
import { handleGlassesEvents } from './events.js';

export interface GlassesSocket {
  id: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  isStreaming: boolean;
  sessionId?: string;
}

export class WebSocketServer {
  private io: SocketIOServer;
  private connectedGlasses: Map<string, GlassesSocket> = new Map();

  constructor(server: HttpServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupConnectionHandlers();
  }

  private setupMiddleware(): void {
    // Authentication middleware for glasses devices
    this.io.use(authenticateDevice);
  }

  private setupConnectionHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log(`🤓 Glasses connected: ${socket.id}`);
      
      // Store glasses connection info
      const glassesSocket: GlassesSocket = {
        id: socket.id,
        userId: socket.data.userId,
        deviceId: socket.data.deviceId,
        deviceName: socket.data.deviceName,
        isStreaming: false
      };
      
      this.connectedGlasses.set(socket.id, glassesSocket);
      
      // Set up event handlers for this glasses connection
      handleGlassesEvents(socket, glassesSocket, this.io);
      
      // Send connection confirmation
      socket.emit('connection:confirmed', {
        deviceId: glassesSocket.deviceId,
        timestamp: new Date().toISOString()
      });
      
      // Handle disconnection
      socket.on('disconnect', async () => {
        console.log(`🤓 Glasses disconnected: ${socket.id}`);
        this.connectedGlasses.delete(socket.id);
        
        // Remove device session from Redis
        const { redisService } = await import('../lib/redis.js');
        await redisService.removeDeviceSession(glassesSocket.deviceId);
        
        // Notify mobile app about glasses disconnection
        this.notifyMobileApp(glassesSocket.userId, 'glasses:disconnected', {
          deviceId: glassesSocket.deviceId,
          deviceName: glassesSocket.deviceName
        });
      });
    });
  }

  // Method to send data to mobile app
  private notifyMobileApp(userId: string, event: string, data: any): void {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  // Method to get connected glasses for a user
  public getConnectedGlasses(userId: string): GlassesSocket[] {
    return Array.from(this.connectedGlasses.values())
      .filter(glasses => glasses.userId === userId);
  }

  // Method to send data to specific glasses
  public sendToGlasses(socketId: string, event: string, data: any): void {
    this.io.to(socketId).emit(event, data);
  }

  // Method to broadcast to all glasses of a user
  public broadcastToUserGlasses(userId: string, event: string, data: any): void {
    const userGlasses = this.getConnectedGlasses(userId);
    userGlasses.forEach(glasses => {
      this.io.to(glasses.id).emit(event, data);
    });
  }

  // Get the Socket.IO server instance
  public getIO(): SocketIOServer {
    return this.io;
  }
}

export default WebSocketServer; 