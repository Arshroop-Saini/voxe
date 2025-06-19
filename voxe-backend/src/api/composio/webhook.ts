import { Request, Response } from 'express';
import express from 'express';
import crypto from 'crypto';
import { triggerService, TriggerEventData } from '../../lib/triggers/triggerService.js';

const composioWebhookRouter = express.Router();

/**
 * Composio Trigger Webhook Handler
 * Processes incoming trigger events from Composio with signature verification
 */

/**
 * Verify webhook signature from Composio
 */
function verifyWebhookSignature(req: Request): boolean {
  try {
    const signature = req.headers['x-composio-signature'] as string;
    const timestamp = req.headers['x-composio-timestamp'] as string;
    const webhookSecret = process.env.COMPOSIO_WEBHOOK_SECRET;

    if (!signature || !timestamp || !webhookSecret) {
      console.error('Missing webhook signature verification components');
      return false;
    }

    // Check timestamp to prevent replay attacks (within 5 minutes)
    const timestampSeconds = parseInt(timestamp);
    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - timestampSeconds) > 300) {
      console.error('Webhook timestamp too old, possible replay attack');
      return false;
    }

    // Create expected signature
    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${payload}`)
      .digest('hex');

    // Compare signatures using secure comparison
    const receivedSignature = signature.replace('sha256=', '');
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(receivedSignature)
    );

    if (!isValid) {
      console.error('Invalid webhook signature');
    }

    return isValid;
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Transform Composio webhook payload to our TriggerEventData format
 */
function transformWebhookPayload(payload: any): TriggerEventData {
  // Handle actual Composio webhook format based on the logs
  // The real format has: { type: "gmail_new_gmail_message", data: {...} }
  
  // Extract app name from type (e.g., "gmail_new_gmail_message" -> "gmail")
  let appName = 'unknown';
  if (payload.type) {
    const typeParts = payload.type.split('_');
    appName = typeParts[0]; // "gmail" from "gmail_new_gmail_message"
  }
  
  // Use the data field as the main payload
  const eventPayload = payload.data || payload.payload || payload;
  
  return {
    appName: appName,
    payload: eventPayload,
    metadata: {
      connectionId: eventPayload?.connection_id || payload.connectionId || '',
      entityId: eventPayload?.user_id || payload.entityId || payload.entity_id || payload.userId || 'default',
      integrationId: payload.integrationId || payload.integration_id || '',
      triggerId: eventPayload?.trigger_id || payload.triggerId || payload.trigger_id || payload.id || ''
    }
  };
}

/**
 * Main webhook handler endpoint
 * POST /api/composio/webhook
 */
composioWebhookRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    console.log('🚀 =================================');
    console.log(`📥 WEBHOOK RECEIVED - Request ID: ${requestId}`);
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
    console.log('🔍 Headers:', JSON.stringify(req.headers, null, 2));
    console.log('🔍 Body:', JSON.stringify(req.body, null, 2));
    console.log('🚀 =================================');

    // Verify webhook signature if webhook secret is configured
    const webhookSecret = process.env.COMPOSIO_WEBHOOK_SECRET;
    if (webhookSecret && process.env.NODE_ENV === 'production') {
      console.log('🔐 Verifying webhook signature...');
      const isValidSignature = verifyWebhookSignature(req);
      if (!isValidSignature) {
        console.error(`❌ WEBHOOK SIGNATURE INVALID - Request ID: ${requestId}`);
        res.status(401).json({ 
          error: 'Invalid signature',
          message: 'Webhook signature verification failed',
          requestId
        });
        return;
      }
      console.log(`✅ Webhook signature verified - Request ID: ${requestId}`);
    } else {
      if (!webhookSecret) {
        console.log(`⚠️ COMPOSIO_WEBHOOK_SECRET not configured - skipping signature verification - Request ID: ${requestId}`);
      } else {
        console.log(`⚠️ Development mode: Skipping signature verification - Request ID: ${requestId}`);
      }
    }

    // Validate request body
    if (!req.body || typeof req.body !== 'object') {
      console.error(`❌ INVALID WEBHOOK PAYLOAD - Request ID: ${requestId}`);
      res.status(400).json({ 
        error: 'Invalid payload',
        message: 'Webhook payload is missing or invalid',
        requestId
      });
      return;
    }

    // Transform payload to our format
    console.log(`🔄 Transforming webhook payload - Request ID: ${requestId}`);
    const eventData = transformWebhookPayload(req.body);
    console.log(`📋 Transformed event data:`, JSON.stringify(eventData, null, 2));
    
    // Validate transformed data
    if (!eventData.appName || !eventData.metadata.entityId) {
      console.error(`❌ MISSING REQUIRED EVENT DATA - Request ID: ${requestId}`);
      console.error('AppName:', eventData.appName);
      console.error('EntityId:', eventData.metadata.entityId);
      res.status(400).json({ 
        error: 'Invalid event data',
        message: 'Missing required fields: appName, entityId',
        requestId
      });
      return;
    }

    console.log(`✅ WEBHOOK VALIDATION PASSED - Request ID: ${requestId}`);
    console.log(`🎯 Processing event: ${eventData.appName} for entity: ${eventData.metadata.entityId}`);

    // Process the event asynchronously
    setImmediate(async () => {
      try {
        console.log(`🚀 STARTING EVENT PROCESSING - Request ID: ${requestId}`);
        const processingStartTime = Date.now();
        
        await triggerService.processWebhookEvent(eventData);
        
        const processingTime = Date.now() - processingStartTime;
        console.log(`✅ WEBHOOK EVENT PROCESSED SUCCESSFULLY - Request ID: ${requestId}`);
        console.log(`⏱️ Processing time: ${processingTime}ms`);
        console.log('🎉 =================================');
      } catch (processingError: any) {
        console.error('🚀 =================================');
        console.error(`❌ ERROR PROCESSING WEBHOOK EVENT - Request ID: ${requestId}`);
        console.error('Error:', processingError);
        console.error('Stack:', processingError.stack);
        console.error('Event Data:', JSON.stringify(eventData, null, 2));
        console.error('🚀 =================================');
        // Log error but don't fail the webhook response
      }
    });

    // Respond immediately to Composio
    const totalTime = Date.now() - startTime;
    console.log(`📤 RESPONDING TO COMPOSIO - Request ID: ${requestId} (${totalTime}ms)`);
    
    res.status(200).json({ 
      status: 'success',
      message: 'Webhook received and queued for processing',
      eventId: eventData.metadata.triggerId,
      requestId,
      timestamp: new Date().toISOString(),
      processingTime: totalTime
    });

  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error('🚀 =================================');
    console.error(`❌ WEBHOOK HANDLER ERROR - Request ID: ${requestId}`);
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    console.error('Body:', req.body);
    console.error('Headers:', req.headers);
    console.error(`⏱️ Failed after: ${totalTime}ms`);
    console.error('🚀 =================================');

    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to process webhook',
      requestId,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Webhook health check endpoint
 * GET /api/composio/webhook/health
 */
composioWebhookRouter.get('/health', async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('🏥 Webhook health check requested');
    
    res.status(200).json({
      status: 'healthy',
      service: 'composio-webhook-handler',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      webhookSecret: process.env.COMPOSIO_WEBHOOK_SECRET ? 'configured' : 'missing'
    });
  } catch (error: any) {
    console.error('❌ Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Test webhook endpoint for development
 * POST /api/composio/webhook/test
 */
composioWebhookRouter.post('/test', async (req: Request, res: Response): Promise<void> => {
  try {
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({ error: 'Test endpoint not available in production' });
      return;
    }

    console.log('🧪 Test webhook triggered');
    
    // Create a test event
    const testEventData: TriggerEventData = {
      appName: 'gmail',
      payload: {
        id: 'test-email-123',
        from: 'test@example.com',
        subject: 'Test Email for Webhook',
        body: 'This is a test email to verify webhook processing.',
        receivedAt: new Date().toISOString()
      },
      metadata: {
        connectionId: 'test-connection-123',
        entityId: req.body.userId || 'test-user-123',
        integrationId: 'test-integration-123',
        triggerId: 'test-trigger-123'
      }
    };

    // Process the test event
    await triggerService.processWebhookEvent(testEventData);

    res.status(200).json({
      status: 'success',
      message: 'Test webhook processed successfully',
      testEvent: testEventData,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Test webhook error:', error);
    res.status(500).json({
      error: 'Test webhook failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get webhook configuration info
 * GET /api/composio/webhook/config
 */
composioWebhookRouter.get('/config', async (req: Request, res: Response): Promise<void> => {
  try {
    const webhookUrl = `${process.env.BACKEND_URL || 'http://localhost:3002'}/api/composio/webhook`;
    
    res.status(200).json({
      webhookUrl,
      healthCheckUrl: `${webhookUrl}/health`,
      testUrl: `${webhookUrl}/test`,
      secretConfigured: !!process.env.COMPOSIO_WEBHOOK_SECRET,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ Webhook config error:', error);
    res.status(500).json({
      error: 'Failed to get webhook config',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default composioWebhookRouter; 