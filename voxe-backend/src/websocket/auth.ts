import { Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';

export interface DeviceAuthData {
  userId: string;
  deviceId: string;
  deviceName: string;
  token: string;
}

export const authenticateDevice = (socket: Socket, next: (err?: ExtendedError) => void): void => {
  try {
    const { userId, deviceId, deviceName, token } = socket.handshake.auth as DeviceAuthData;
    
    // Basic validation
    if (!userId || !deviceId || !deviceName || !token) {
      return next(new Error('Authentication failed: Missing credentials'));
    }
    
    // TODO: Implement proper JWT token validation
    // For now, we'll do basic token format validation
    if (token.length < 10) {
      return next(new Error('Authentication failed: Invalid token'));
    }
    
    // Store user and device info in socket data
    socket.data.userId = userId;
    socket.data.deviceId = deviceId;
    socket.data.deviceName = deviceName;
    socket.data.authenticated = true;
    
    // Join user-specific room for mobile app notifications
    socket.join(`user:${userId}`);
    
    console.log(`🔐 Device authenticated: ${deviceName} (${deviceId}) for user ${userId}`);
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    next(new Error('Authentication failed: Invalid credentials format'));
  }
};

// Helper function to validate device token (placeholder for JWT validation)
export const validateDeviceToken = (token: string, deviceId: string): boolean => {
  // TODO: Implement JWT token validation
  // For now, return true for basic validation
  return token.length >= 10;
};

// Helper function to extract user ID from token
export const extractUserIdFromToken = (token: string): string | null => {
  // TODO: Implement JWT token parsing
  // For now, return null to use the provided userId
  return null;
}; 