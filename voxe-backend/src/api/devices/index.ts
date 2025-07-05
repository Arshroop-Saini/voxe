import express, { Request, Response } from 'express';
import redisService, { DeviceSession } from '../../lib/redis.js';

const devicesRouter = express.Router();

// Get all devices for a user
async function getUserDevices(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }

    const devices = await redisService.getUserDevices(userId);
    
    res.json({
      success: true,
      devices: devices.map(device => ({
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        isConnected: device.isActive,
        isStreaming: device.isStreaming,
        lastSeen: new Date(device.lastSeen).toISOString(),
        connectedAt: new Date(device.connectedAt).toISOString(),
        batteryLevel: device.batteryLevel,
        firmwareVersion: device.firmwareVersion,
        currentSessionId: device.currentSessionId
      }))
    });
  } catch (error) {
    console.error('Error fetching user devices:', error);
    res.status(500).json({ error: 'Failed to fetch user devices' });
  }
}

// Get specific device details
async function getDevice(req: Request, res: Response): Promise<void> {
  try {
    const { deviceId } = req.params;
    
    if (!deviceId) {
      res.status(400).json({ error: 'Device ID is required' });
      return;
    }

    const device = await redisService.getDeviceSession(deviceId);
    
    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    res.json({
      success: true,
      device: {
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        userId: device.userId,
        isConnected: device.isActive,
        isStreaming: device.isStreaming,
        lastSeen: new Date(device.lastSeen).toISOString(),
        connectedAt: new Date(device.connectedAt).toISOString(),
        batteryLevel: device.batteryLevel,
        firmwareVersion: device.firmwareVersion,
        currentSessionId: device.currentSessionId
      }
    });
  } catch (error) {
    console.error('Error fetching device details:', error);
    res.status(500).json({ error: 'Failed to fetch device details' });
  }
}

// Register a new device
async function registerDevice(req: Request, res: Response): Promise<void> {
  try {
    const { deviceId, deviceName, userId, firmwareVersion } = req.body;
    
    if (!deviceId || !deviceName || !userId) {
      res.status(400).json({ 
        error: 'Device ID, device name, and user ID are required' 
      });
      return;
    }

    // Check if device already exists
    const existingDevice = await redisService.getDeviceSession(deviceId);
    if (existingDevice) {
      res.status(409).json({ 
        error: 'Device already registered',
        device: {
          deviceId: existingDevice.deviceId,
          deviceName: existingDevice.deviceName,
          userId: existingDevice.userId
        }
      });
      return;
    }

    // Create device session
    const deviceSession: DeviceSession = {
      deviceId,
      userId,
      deviceName,
      socketId: '',
      connectedAt: Date.now(),
      lastSeen: Date.now(),
      isActive: false,
      isStreaming: false,
      firmwareVersion
    };

    await redisService.setDeviceSession(deviceId, deviceSession);

    res.status(201).json({
      success: true,
      message: 'Device registered successfully',
      device: {
        deviceId: deviceSession.deviceId,
        deviceName: deviceSession.deviceName,
        userId: deviceSession.userId,
        firmwareVersion: deviceSession.firmwareVersion,
        registeredAt: new Date(deviceSession.connectedAt).toISOString()
      }
    });
  } catch (error) {
    console.error('Error registering device:', error);
    res.status(500).json({ error: 'Failed to register device' });
  }
}

// Health check for devices
async function healthCheck(req: Request, res: Response): Promise<void> {
  try {
    const redisHealth = await redisService.healthCheck();
    
    res.json({
      success: true,
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        redis: redisHealth ? 'connected' : 'disconnected'
      }
    });
  } catch (error) {
    console.error('Error in device health check:', error);
    res.status(500).json({ 
      success: false,
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
}

// Mount routes
devicesRouter.get('/user/:userId', async (req: Request, res: Response): Promise<void> => {
  await getUserDevices(req, res);
});

devicesRouter.get('/health', async (req: Request, res: Response): Promise<void> => {
  await healthCheck(req, res);
});

devicesRouter.get('/:deviceId', async (req: Request, res: Response): Promise<void> => {
  await getDevice(req, res);
});

devicesRouter.post('/register', async (req: Request, res: Response): Promise<void> => {
  await registerDevice(req, res);
});

export default devicesRouter; 