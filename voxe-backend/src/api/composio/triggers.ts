import { Request, Response } from 'express';
import express from 'express';
import { triggerService } from '../../lib/triggers/triggerService.js';
import { supabaseService } from '../../lib/supabase.js';

const composioTriggersRouter = express.Router();

/**
 * Composio Triggers Management API
 * Provides CRUD operations for trigger configurations
 */

/**
 * Get all triggers for a user
 * GET /api/composio/triggers?userId=xxx&appName=gmail
 */
composioTriggersRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, appName } = req.query;

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    console.log(`📋 Getting triggers for user: ${userId}${appName ? ` (app: ${appName})` : ''}`);

    const triggers = await triggerService.getUserTriggers(
      userId as string,
      appName as string | undefined
    );

    res.status(200).json({
      status: 'success',
      triggers,
      count: triggers.length,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Error getting triggers:', error);
    res.status(500).json({
      error: 'Failed to get triggers',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Create a new trigger
 * POST /api/composio/triggers
 * Body: { user_id, app_name, trigger_name, config }
 */
composioTriggersRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { user_id, app_name, trigger_name, config } = req.body;

    // Validate required fields
    if (!user_id || !app_name || !trigger_name) {
      res.status(400).json({ 
        error: 'Missing required fields',
        required: ['user_id', 'app_name', 'trigger_name'],
        received: { user_id, app_name, trigger_name }
      });
      return;
    }

    console.log(`🆕 Creating trigger: ${app_name} - ${trigger_name} for user: ${user_id}`);

    const trigger = await triggerService.createTrigger({
      user_id,
      app_name,
      trigger_name,
      config: config || {}
    });

    res.status(201).json({
      status: 'success',
      message: 'Trigger created successfully',
      trigger,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Error creating trigger:', error);
    res.status(500).json({
      error: 'Failed to create trigger',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Update a trigger
 * PUT /api/composio/triggers/:id
 * Body: { config?, is_active? }
 */
composioTriggersRouter.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!id) {
      res.status(400).json({ error: 'Trigger ID is required' });
      return;
    }

    console.log(`✏️ Updating trigger: ${id}`);

    const trigger = await triggerService.updateTrigger(id, updates);

    res.status(200).json({
      status: 'success',
      message: 'Trigger updated successfully',
      trigger,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Error updating trigger:', error);
    res.status(500).json({
      error: 'Failed to update trigger',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Delete a trigger
 * DELETE /api/composio/triggers/:id
 */
composioTriggersRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'Trigger ID is required' });
      return;
    }

    console.log(`🗑️ Deleting trigger: ${id}`);

    const success = await triggerService.deleteTrigger(id);

    if (success) {
      res.status(200).json({
        status: 'success',
        message: 'Trigger deleted successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        error: 'Trigger not found',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error: any) {
    console.error('❌ Error deleting trigger:', error);
    res.status(500).json({
      error: 'Failed to delete trigger',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Debug connection status for a user and app
 * GET /api/composio/triggers/debug/connection/:userId/:appName
 */
composioTriggersRouter.get('/debug/connection/:userId/:appName', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, appName } = req.params;

    if (!userId || !appName) {
      res.status(400).json({ error: 'userId and appName are required' });
      return;
    }

    console.log(`🔍 Debug: Checking connection for user ${userId}, app ${appName}`);

    const connectionStatus = await triggerService.debugConnectionStatus(userId, appName);

    res.status(200).json({
      status: 'success',
      userId,
      appName,
      connection: connectionStatus,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Error debugging connection:', error);
    res.status(500).json({
      error: 'Failed to debug connection',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get available triggers for an app
 * GET /api/composio/triggers/available/:appName
 */
composioTriggersRouter.get('/available/:appName', async (req: Request, res: Response): Promise<void> => {
  try {
    const { appName } = req.params;

    if (!appName) {
      res.status(400).json({ error: 'App name is required' });
      return;
    }

    console.log(`📋 Getting available triggers for: ${appName}`);

    const availableTriggers = await triggerService.getAvailableTriggers(appName);

    res.status(200).json({
      status: 'success',
      appName,
      triggers: availableTriggers,
      count: availableTriggers.length,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Error getting available triggers:', error);
    res.status(500).json({
      error: 'Failed to get available triggers',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Enable a trigger
 * POST /api/composio/triggers/:id/enable
 */
composioTriggersRouter.post('/:id/enable', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'Trigger ID is required' });
      return;
    }

    console.log(`🟢 Enabling trigger: ${id}`);

    // Get the specific trigger by ID directly from database
    const { data: trigger, error: fetchError } = await supabaseService
      .from('trigger_configs')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !trigger || !trigger.composio_trigger_id) {
      res.status(404).json({ error: 'Trigger not found or missing Composio ID' });
      return;
    }

    await triggerService.enableTrigger(trigger.composio_trigger_id);

    res.status(200).json({
      status: 'success',
      message: 'Trigger enabled successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Error enabling trigger:', error);
    res.status(500).json({
      error: 'Failed to enable trigger',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Disable a trigger
 * POST /api/composio/triggers/:id/disable
 */
composioTriggersRouter.post('/:id/disable', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'Trigger ID is required' });
      return;
    }

    console.log(`🔴 Disabling trigger: ${id}`);

    // Get the specific trigger by ID directly from database
    const { data: trigger, error: fetchError } = await supabaseService
      .from('trigger_configs')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !trigger || !trigger.composio_trigger_id) {
      res.status(404).json({ error: 'Trigger not found or missing Composio ID' });
      return;
    }

    await triggerService.disableTrigger(trigger.composio_trigger_id);

    res.status(200).json({
      status: 'success',
      message: 'Trigger disabled successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Error disabling trigger:', error);
    res.status(500).json({
      error: 'Failed to disable trigger',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Health check for triggers service
 * GET /api/composio/triggers/health
 */
composioTriggersRouter.get('/health', async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json({
      status: 'healthy',
      service: 'composio-triggers-api',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error: any) {
    console.error('❌ Triggers health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get trigger events for monitoring
 * GET /api/composio/triggers/events/:userId
 */
composioTriggersRouter.get('/events/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { limit = '10', triggerConfigId } = req.query;

    console.log(`📊 Fetching trigger events for user: ${userId}`);

    let query = supabaseService
      .from('trigger_events')
      .select(`
        *,
        trigger_configs (
          id,
          app_name,
          trigger_name,
          composio_trigger_id
        )
      `)
      .eq('user_id', userId)
      .order('processed_at', { ascending: false })
      .limit(parseInt(limit as string));

    if (triggerConfigId) {
      query = query.eq('trigger_config_id', triggerConfigId);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error('Error fetching trigger events:', error);
      res.status(500).json({ error: 'Failed to fetch trigger events' });
      return;
    }

    console.log(`✅ Found ${events?.length || 0} trigger events for user ${userId}`);

    res.json({
      success: true,
      events: events || [],
      count: events?.length || 0
    });

  } catch (error: any) {
    console.error('Error in trigger events endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get trigger event statistics
 * GET /api/composio/triggers/stats/:userId
 */
composioTriggersRouter.get('/stats/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    console.log(`📈 Fetching trigger statistics for user: ${userId}`);

    // Get event counts by status
    const { data: statusStats, error: statusError } = await supabaseService
      .from('trigger_events')
      .select('processing_status')
      .eq('user_id', userId);

    if (statusError) {
      console.error('Error fetching status stats:', statusError);
      res.status(500).json({ error: 'Failed to fetch statistics' });
      return;
    }

    // Get event counts by app
    const { data: appStats, error: appError } = await supabaseService
      .from('trigger_events')
      .select('event_type')
      .eq('user_id', userId);

    if (appError) {
      console.error('Error fetching app stats:', appError);
      res.status(500).json({ error: 'Failed to fetch statistics' });
      return;
    }

    // Get recent events (last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { data: recentEvents, error: recentError } = await supabaseService
      .from('trigger_events')
      .select('processed_at')
      .eq('user_id', userId)
      .gte('processed_at', yesterday.toISOString());

    if (recentError) {
      console.error('Error fetching recent events:', recentError);
    }

    // Process statistics
    const statusCounts = (statusStats || []).reduce((acc: any, event: any) => {
      acc[event.processing_status] = (acc[event.processing_status] || 0) + 1;
      return acc;
    }, {});

    const appCounts = (appStats || []).reduce((acc: any, event: any) => {
      acc[event.event_type] = (acc[event.event_type] || 0) + 1;
      return acc;
    }, {});

    const stats = {
      totalEvents: statusStats?.length || 0,
      recentEvents: recentEvents?.length || 0,
      statusBreakdown: statusCounts,
      appBreakdown: appCounts,
      lastUpdated: new Date().toISOString()
    };

    console.log(`✅ Trigger statistics for user ${userId}:`, stats);

    res.json({
      success: true,
      stats
    });

  } catch (error: any) {
    console.error('Error in trigger stats endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Test webhook endpoint - simulate incoming webhook
 * POST /api/composio/triggers/test-webhook
 */
composioTriggersRouter.post('/test-webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, appName = 'gmail', triggerName = 'GMAIL_NEW_GMAIL_MESSAGE' } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    console.log(`🧪 Creating test webhook event for user: ${userId}`);

    // Create a mock webhook payload
    const mockWebhookPayload = {
      appName: appName,
      payload: {
        trigger_name: triggerName,
        id: `test-${Date.now()}`,
        from: 'test@example.com',
        subject: 'Test Email - Webhook Test',
        body: 'This is a test email to verify webhook processing',
        timestamp: new Date().toISOString()
      },
      metadata: {
        connectionId: 'test-connection-id',
        entityId: userId,
        integrationId: 'test-integration-id',
        triggerId: 'test-trigger-id'
      }
    };

    console.log('🔧 Mock webhook payload:', JSON.stringify(mockWebhookPayload, null, 2));

    // Process the mock event
    await triggerService.processWebhookEvent(mockWebhookPayload);

    console.log('✅ Test webhook processed successfully');

    res.json({
      success: true,
      message: 'Test webhook processed successfully',
      payload: mockWebhookPayload
    });

  } catch (error: any) {
    console.error('Error processing test webhook:', error);
    res.status(500).json({ 
      error: 'Failed to process test webhook',
      details: error.message 
    });
  }
});

export default composioTriggersRouter; 