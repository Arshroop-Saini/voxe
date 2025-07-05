import { Socket, Server } from 'socket.io';
import { GlassesSocket } from './index.js';
import redisService, { DeviceSession, StreamingSession } from '../lib/redis.js';
import { elevenLabsVoiceService } from '../lib/ai/elevenlabs-voice.js';

export interface ButtonPressEvent {
  type: 'press' | 'release';
  timestamp: number;
  sessionId?: string;
}

export interface ElevenLabsSession {
  sessionId: string;
  userId: string;
  deviceId: string;
  startTime: number;
  isActive: boolean;
  elevenLabsConfig?: any;
}

// Active ElevenLabs conversation sessions
const activeElevenLabsSessions: Map<string, ElevenLabsSession> = new Map();

export const handleGlassesEvents = (socket: Socket, glassesSocket: GlassesSocket, io: Server): void => {
  
  // Store device session in Redis when connected
  const storeDeviceSession = async () => {
    const deviceSession: DeviceSession = {
      deviceId: glassesSocket.deviceId,
      userId: glassesSocket.userId,
      deviceName: glassesSocket.deviceName,
      socketId: glassesSocket.id,
      connectedAt: Date.now(),
      lastSeen: Date.now(),
      isActive: true,
      isStreaming: false
    };
    
    await redisService.setDeviceSession(glassesSocket.deviceId, deviceSession);
  };
  
  // Initialize device session
  storeDeviceSession();
  
  // Handle button press events
  socket.on('glasses:button_press', async (data: ButtonPressEvent) => {
    console.log(`🔘 Button press from ${glassesSocket.deviceName}:`, data);
    
    if (data.type === 'press') {
      // Start ElevenLabs conversation session
      const sessionId = generateSessionId();
      
      try {
        // Get ElevenLabs conversation configuration
        const elevenLabsConfig = await elevenLabsVoiceService.startConversation(
          glassesSocket.userId,
          glassesSocket.deviceId,
          {
            device_name: glassesSocket.deviceName,
            session_id: sessionId,
          }
        );
        
        const streamingSession: StreamingSession = {
          sessionId,
          userId: glassesSocket.userId,
          deviceId: glassesSocket.deviceId,
          startTime: Date.now(),
          isActive: true,
          audioChunkCount: 0,
          status: 'active'
        };
        
        // Store in Redis
        await redisService.setStreamingSession(sessionId, streamingSession);
        
        // Update local session
        activeElevenLabsSessions.set(sessionId, {
          sessionId,
          userId: glassesSocket.userId,
          deviceId: glassesSocket.deviceId,
          startTime: Date.now(),
          isActive: true,
          elevenLabsConfig
        });
        
        glassesSocket.isStreaming = true;
        glassesSocket.sessionId = sessionId;
        
        // Update device session in Redis
        await redisService.updateStreamingSession(sessionId, { isActive: true });
        
        const deviceSession = await redisService.getDeviceSession(glassesSocket.deviceId);
        if (deviceSession) {
          deviceSession.isStreaming = true;
          deviceSession.currentSessionId = sessionId;
          deviceSession.lastSeen = Date.now();
          await redisService.setDeviceSession(glassesSocket.deviceId, deviceSession);
        }
        
        // Send ElevenLabs configuration to glasses
        socket.emit('elevenlabs:config', {
          sessionId,
          signedUrl: elevenLabsConfig.signedUrl,
          agentId: elevenLabsConfig.agentId,
          dynamicVariables: elevenLabsConfig.dynamicVariables,
          conversationConfig: elevenLabsConfig.conversationConfig,
          timestamp: new Date().toISOString()
        });
        
        // Confirm streaming started
        socket.emit('stream:started', {
          sessionId,
          type: 'elevenlabs',
          timestamp: new Date().toISOString()
        });
        
        // Notify mobile app
        io.to(`user:${glassesSocket.userId}`).emit('glasses:stream_started', {
          deviceId: glassesSocket.deviceId,
          deviceName: glassesSocket.deviceName,
          sessionId,
          type: 'elevenlabs',
          timestamp: new Date().toISOString()
        });
        
        console.log(`🎙️ ElevenLabs conversation started for ${glassesSocket.deviceName} (Session: ${sessionId})`);
        
      } catch (error) {
        console.error(`❌ Failed to start ElevenLabs conversation for ${glassesSocket.deviceName}:`, error);
        
        // Notify about the error
        socket.emit('stream:error', {
          error: 'Failed to start voice conversation',
          timestamp: new Date().toISOString()
        });
        
        io.to(`user:${glassesSocket.userId}`).emit('glasses:processing_error', {
          deviceId: glassesSocket.deviceId,
          sessionId,
          error: 'Failed to start voice conversation',
          timestamp: new Date().toISOString()
        });
      }
      
    } else if (data.type === 'release') {
      // Stop ElevenLabs conversation session
      if (glassesSocket.sessionId) {
        const session = activeElevenLabsSessions.get(glassesSocket.sessionId);
        if (session) {
          session.isActive = false;
          
          // Update Redis streaming session
          await redisService.updateStreamingSession(glassesSocket.sessionId, {
            isActive: false,
            endTime: Date.now(),
            status: 'completed'
          });
          
          // End ElevenLabs conversation
          try {
            await elevenLabsVoiceService.endConversation(glassesSocket.sessionId);
          } catch (error) {
            console.error('❌ Error ending ElevenLabs conversation:', error);
          }
          
          // Clean up session
          activeElevenLabsSessions.delete(glassesSocket.sessionId);
        }
      }
      
      glassesSocket.isStreaming = false;
      glassesSocket.sessionId = undefined;
      
      // Update device session in Redis
      const deviceSession = await redisService.getDeviceSession(glassesSocket.deviceId);
      if (deviceSession) {
        deviceSession.isStreaming = false;
        deviceSession.currentSessionId = undefined;
        deviceSession.lastSeen = Date.now();
        await redisService.setDeviceSession(glassesSocket.deviceId, deviceSession);
      }
      
      // Confirm streaming stopped
      socket.emit('stream:stopped', {
        timestamp: new Date().toISOString()
      });
      
      // Notify mobile app
      io.to(`user:${glassesSocket.userId}`).emit('glasses:stream_stopped', {
        deviceId: glassesSocket.deviceId,
        deviceName: glassesSocket.deviceName,
        timestamp: new Date().toISOString()
      });
      
      console.log(`🛑 ElevenLabs conversation stopped for ${glassesSocket.deviceName}`);
    }
  });
  
  // Handle ElevenLabs conversation status updates
  socket.on('elevenlabs:conversation_started', async (data: { conversationId: string; sessionId: string }) => {
    console.log(`🎙️ ElevenLabs conversation started: ${data.conversationId} for session: ${data.sessionId}`);
    
    // Update session with conversation ID
    const session = activeElevenLabsSessions.get(data.sessionId);
    if (session) {
      session.elevenLabsConfig = {
        ...session.elevenLabsConfig,
        conversationId: data.conversationId
      };
    }
    
    // Update Redis
    await redisService.updateStreamingSession(data.sessionId, {
      conversationId: data.conversationId,
      status: 'processing'
    });
    
    // Notify mobile app
    io.to(`user:${glassesSocket.userId}`).emit('glasses:conversation_active', {
      deviceId: glassesSocket.deviceId,
      sessionId: data.sessionId,
      conversationId: data.conversationId,
      timestamp: new Date().toISOString()
    });
  });
  
  // Handle ElevenLabs conversation ended
  socket.on('elevenlabs:conversation_ended', async (data: { conversationId: string; sessionId: string }) => {
    console.log(`🏁 ElevenLabs conversation ended: ${data.conversationId} for session: ${data.sessionId}`);
    
    // Update Redis
    await redisService.updateStreamingSession(data.sessionId, {
      status: 'completed',
      endTime: Date.now()
    });
    
    // Notify mobile app
    io.to(`user:${glassesSocket.userId}`).emit('glasses:conversation_ended', {
      deviceId: glassesSocket.deviceId,
      sessionId: data.sessionId,
      conversationId: data.conversationId,
      timestamp: new Date().toISOString()
    });
  });
  
  // Handle ping/pong for connection health
  socket.on('glasses:ping', () => {
    socket.emit('glasses:pong', { timestamp: new Date().toISOString() });
  });
  
  // Handle error events
  socket.on('glasses:error', (error: any) => {
    console.error(`❌ Error from ${glassesSocket.deviceName}:`, error);
    
    // Clean up any active sessions
    if (glassesSocket.sessionId) {
      activeElevenLabsSessions.delete(glassesSocket.sessionId);
      glassesSocket.isStreaming = false;
      glassesSocket.sessionId = undefined;
    }
    
    // Notify mobile app
    io.to(`user:${glassesSocket.userId}`).emit('glasses:error', {
      deviceId: glassesSocket.deviceId,
      deviceName: glassesSocket.deviceName,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  });
  
  // Handle disconnection
  socket.on('disconnect', async (reason: string) => {
    console.log(`📱 Glasses disconnected: ${glassesSocket.deviceName} (${reason})`);
    
    // Clean up any active ElevenLabs sessions
    if (glassesSocket.sessionId) {
      const session = activeElevenLabsSessions.get(glassesSocket.sessionId);
      if (session) {
        try {
          await elevenLabsVoiceService.endConversation(glassesSocket.sessionId);
        } catch (error) {
          console.error('❌ Error ending ElevenLabs conversation on disconnect:', error);
        }
        activeElevenLabsSessions.delete(glassesSocket.sessionId);
      }
      
      // Update streaming session in Redis
      await redisService.updateStreamingSession(glassesSocket.sessionId, {
        isActive: false,
        endTime: Date.now(),
        status: 'failed'
      });
    }
    
    // Update device session in Redis
    const deviceSession = await redisService.getDeviceSession(glassesSocket.deviceId);
    if (deviceSession) {
      deviceSession.isActive = false;
      deviceSession.isStreaming = false;
      deviceSession.currentSessionId = undefined;
      deviceSession.lastSeen = Date.now();
      await redisService.setDeviceSession(glassesSocket.deviceId, deviceSession);
    }
    
    // Notify mobile app
    io.to(`user:${glassesSocket.userId}`).emit('glasses:disconnected', {
      deviceId: glassesSocket.deviceId,
      deviceName: glassesSocket.deviceName,
      reason,
      timestamp: new Date().toISOString()
    });
  });
};

const generateSessionId = (): string => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const cleanupInactiveElevenLabsSessions = (): void => {
  const now = Date.now();
  const TIMEOUT = 10 * 60 * 1000; // 10 minutes
  
  for (const [sessionId, session] of activeElevenLabsSessions.entries()) {
    if (now - session.startTime > TIMEOUT) {
      console.log(`🧹 Cleaning up inactive ElevenLabs session: ${sessionId}`);
      activeElevenLabsSessions.delete(sessionId);
      
      // End ElevenLabs conversation
      elevenLabsVoiceService.endConversation(sessionId).catch(error => {
        console.error('❌ Error ending conversation during cleanup:', error);
      });
    }
  }
};

// Run cleanup every 5 minutes
setInterval(cleanupInactiveElevenLabsSessions, 5 * 60 * 1000); 