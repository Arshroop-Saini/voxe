import express, { Request, Response } from 'express';
import { z } from 'zod';
import { composioOAuth } from '../../lib/composio/oauth.js';

const composioOAuthRouter = express.Router();

// Supported apps for OAuth connections
const SUPPORTED_APPS = ['gmail', 'googlecalendar', 'googledocs', 'googledrive', 'googlesheets', 'notion'];

// Request schemas
const initiateConnectionSchema = z.object({
  userId: z.string().uuid(),
  appName: z.string().refine(app => SUPPORTED_APPS.includes(app.toLowerCase()), {
    message: `App must be one of: ${SUPPORTED_APPS.join(', ')}`
  }),
  redirectUrl: z.string().url().optional()
});

const connectionStatusSchema = z.object({
  userId: z.string().uuid()
});

const waitForConnectionSchema = z.object({
  userId: z.string().uuid(),
  appName: z.string().refine(app => SUPPORTED_APPS.includes(app.toLowerCase())),
  timeout: z.number().min(30).max(300).default(240)
});

/**
 * POST /api/composio/oauth/initiate
 * Initiate OAuth connection for a specific app
 */
composioOAuthRouter.post('/initiate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, appName, redirectUrl } = initiateConnectionSchema.parse(req.body);
    
    console.log(`Initiating Composio OAuth for user ${userId} - app: ${appName}`);
    
    const result = await composioOAuth.initiateConnection(userId, appName.toLowerCase(), redirectUrl);
    
    res.json({
      success: true,
      data: {
        redirectUrl: result.redirectUrl,
        connectionId: result.connectionId,
        status: result.status,
        appName: appName.toLowerCase()
      }
    });
  } catch (error) {
    console.error('Error initiating Composio OAuth connection:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initiate OAuth connection'
    });
  }
});

/**
 * POST /api/composio/oauth/wait
 * Wait for OAuth connection to become active
 */
composioOAuthRouter.post('/wait', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, appName, timeout } = waitForConnectionSchema.parse(req.body);
    
    console.log(`Waiting for Composio OAuth connection: ${userId} - ${appName}`);
    
    const result = await composioOAuth.waitForConnection(userId, appName.toLowerCase(), timeout);
    
    res.json({
      success: true,
      data: {
        connectionId: result.connectionId,
        status: result.status,
        isActive: result.isActive,
        appName: appName.toLowerCase()
      }
    });
  } catch (error) {
    console.error('Error waiting for Composio OAuth connection:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to wait for OAuth connection'
    });
  }
});

/**
 * GET /api/composio/oauth/status/:userId
 * Get connection status for all supported apps
 */
composioOAuthRouter.get('/status/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = connectionStatusSchema.parse({ userId: req.params.userId });
    
    const status = await composioOAuth.getConnectionStatus(userId);
    
    res.json({
      success: true,
      data: {
        userId,
        connections: status,
        supportedApps: SUPPORTED_APPS
      }
    });
  } catch (error) {
    console.error('Error getting Composio OAuth status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get connection status'
    });
  }
});

/**
 * GET /api/composio/oauth/connections/:userId
 * Get all active connections for a user
 */
composioOAuthRouter.get('/connections/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = connectionStatusSchema.parse({ userId: req.params.userId });
    
    const connections = await composioOAuth.getUserConnections(userId);
    
    res.json({
      success: true,
      data: {
        userId,
        connections,
        totalConnections: connections.length
      }
    });
  } catch (error) {
    console.error('Error getting user connections:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get user connections'
    });
  }
});

/**
 * DELETE /api/composio/oauth/disconnect
 * Disconnect a specific app for user
 */
composioOAuthRouter.delete('/disconnect', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, appName } = z.object({
      userId: z.string().uuid(),
      appName: z.string().refine(app => SUPPORTED_APPS.includes(app.toLowerCase()))
    }).parse(req.body);
    
    console.log(`Disconnecting Composio OAuth: ${userId} - ${appName}`);
    
    const success = await composioOAuth.disconnectApp(userId, appName.toLowerCase());
    
    res.json({
      success,
      data: {
        userId,
        appName: appName.toLowerCase(),
        disconnected: success
      }
    });
  } catch (error) {
    console.error('Error disconnecting Composio OAuth:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to disconnect app'
    });
  }
});

/**
 * GET /api/composio/oauth/callback
 * OAuth callback handler (for Composio redirects)
 */
composioOAuthRouter.get('/callback', async (req: Request, res: Response): Promise<void> => {
  try {
    // This endpoint receives OAuth callbacks from Composio
    // The actual connection activation is handled by Composio
    // We just redirect to a success page or back to the app
    
    const { state, code, error } = req.query;
    
    if (error) {
      console.error('OAuth callback error:', error);
      res.redirect(`${process.env.MOBILE_APP_URL || 'exp://localhost:8081'}/oauth-error?error=${encodeURIComponent(error as string)}`);
      return;
    }
    
    if (code) {
      console.log('OAuth callback received with code, redirecting to success');
      res.redirect(`${process.env.MOBILE_APP_URL || 'exp://localhost:8081'}/oauth-success?provider=composio&state=${state || ''}`);
      return;
    }
    
    // Default redirect
    res.redirect(`${process.env.MOBILE_APP_URL || 'exp://localhost:8081'}/oauth-complete`);
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    res.redirect(`${process.env.MOBILE_APP_URL || 'exp://localhost:8081'}/oauth-error?error=callback_failed`);
  }
});

/**
 * GET /api/composio/oauth/health
 * Health check for Composio OAuth service
 */
composioOAuthRouter.get('/health', async (req: Request, res: Response): Promise<void> => {
  try {
    // Test basic Composio connection
    const testEntity = await composioOAuth.getOrCreateEntity('health-check-test');
    
    res.json({
      success: true,
      data: {
        service: 'Composio OAuth',
        status: 'healthy',
        supportedApps: SUPPORTED_APPS,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Composio OAuth health check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Composio OAuth service unhealthy'
    });
  }
});

export default composioOAuthRouter; 