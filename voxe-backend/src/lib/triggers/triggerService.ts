import { ComposioToolSet } from 'composio-core';
import { supabaseService } from '../supabase.js';

export interface TriggerConfig {
  id?: string;
  user_id: string;
  app_name: string;
  trigger_name: string;
  composio_trigger_id?: string;
  config: any;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TriggerEvent {
  id?: string;
  trigger_config_id?: string;
  user_id: string;
  event_type: string;
  payload: any;
  processed_at?: string;
  processing_status?: 'success' | 'failed' | 'pending';
  error_message?: string;
  notification_sent?: boolean;
}

export interface CreateTriggerRequest {
  user_id: string;
  app_name: string;
  trigger_name: string;
  config: any;
}

export interface TriggerEventData {
  appName: string;
  payload: Record<string, any>;
  metadata: {
    connectionId: string;
    entityId: string;
    integrationId: string;
    triggerId: string;
  };
}

/**
 * Trigger Management Service for Composio
 * Handles creation, management, and webhook processing of triggers
 */
export class TriggerService {
  private composio: ComposioToolSet;

  constructor() {
    // Enable debug logging if environment variable is set
    if (process.env.COMPOSIO_LOGGING_LEVEL === 'debug') {
      console.log('🐛 Debug logging enabled for Composio');
    }

    this.composio = new ComposioToolSet({
      apiKey: process.env.COMPOSIO_API_KEY
    });
    
    if (!process.env.COMPOSIO_API_KEY) {
      console.warn('Composio API key not configured. Trigger features will be limited.');
    }
    
    console.log('🔄 TriggerService initialized');
  }

  /**
   * Create a new trigger for a user or reactivate existing one
   */
  async createTrigger(params: CreateTriggerRequest): Promise<TriggerConfig> {
    try {
      console.log(`🚀 Creating/reactivating trigger for user ${params.user_id}: ${params.app_name} - ${params.trigger_name}`);
      console.log(`📋 Config:`, JSON.stringify(params.config, null, 2));

      // Check if trigger already exists (active or inactive)
      const { data: existingTrigger, error: searchError } = await supabaseService
        .from('trigger_configs')
        .select('*')
        .eq('user_id', params.user_id)
        .eq('app_name', params.app_name)
        .eq('trigger_name', params.trigger_name)
        .single();

      if (existingTrigger && !searchError) {
        console.log(`🔄 Found existing trigger:`, existingTrigger);
        
        if (existingTrigger.is_active) {
          console.log(`✅ Trigger is already active`);
          return existingTrigger as TriggerConfig;
        } else {
          console.log(`🟢 Reactivating existing trigger...`);
          
          // Reactivate in Composio
          if (existingTrigger.composio_trigger_id) {
            try {
              const result = await this.composio.triggers.enable({ 
                triggerId: existingTrigger.composio_trigger_id 
              });
              console.log(`✅ Successfully enabled trigger in Composio:`, result);
            } catch (enableError: any) {
              console.warn('⚠️ Warning: Failed to enable trigger in Composio:', enableError.message);
              // Continue with database update even if Composio enable fails
            }
          }
          
          // Update database to mark as active
          const { data: updatedTrigger, error: updateError } = await supabaseService
            .from('trigger_configs')
            .update({ 
              is_active: true,
              config: params.config, // Update config in case it changed
              updated_at: new Date().toISOString()
            })
            .eq('id', existingTrigger.id)
            .select()
            .single();

          if (updateError) {
            throw new Error(`Failed to reactivate trigger in database: ${updateError.message}`);
          }

          console.log(`✅ Trigger successfully reactivated:`, updatedTrigger);
          return updatedTrigger as TriggerConfig;
        }
      }

      // No existing trigger found, create a new one
      console.log(`🆕 Creating new trigger...`);

      // Get the user's entity
      const entity = await this.composio.getEntity(params.user_id);
      console.log(`👤 Entity retrieved for user: ${params.user_id}`);

      // DEBUGGING STEP 1: Verify the connected account
      console.log(`🔍 Checking ${params.app_name} connection status...`);
      try {
        const connection = await entity.getConnection({ app: params.app_name });
        console.log(`📡 Connection status for ${params.app_name}:`, {
          connectionId: connection?.id,
          status: connection?.status,
          appUniqueId: connection?.appUniqueId,
          fullConnection: connection
        });

        if (!connection || connection?.status !== 'ACTIVE') {
          throw new Error(`${params.app_name} connection is not active (status: ${connection?.status}). Please reconnect in the Connections tab.`);
        }
      } catch (connectionError: any) {
        console.error(`❌ Connection check failed for ${params.app_name}:`, connectionError.message);
        throw new Error(`Failed to verify ${params.app_name} connection: ${connectionError.message}`);
      }

      // DEBUGGING STEP 2: Check if trigger is available
      console.log(`🔍 Verifying trigger availability: ${params.trigger_name}`);
      try {
        const availableTriggers = await this.composio.triggers.list({ 
          appNames: [params.app_name] 
        });
        console.log(`📋 Available triggers for ${params.app_name}:`, 
          availableTriggers.map((t: any) => ({ name: t.name, display_name: t.display_name }))
        );

        const triggerExists = availableTriggers.some((t: any) => t.name === params.trigger_name);
        if (!triggerExists) {
          throw new Error(`Trigger '${params.trigger_name}' is not available for ${params.app_name}. Available triggers: ${availableTriggers.map((t: any) => t.name).join(', ')}`);
        }
        console.log(`✅ Trigger '${params.trigger_name}' is available`);
      } catch (triggerCheckError: any) {
        console.error(`❌ Trigger availability check failed:`, triggerCheckError.message);
        throw new Error(`Failed to verify trigger availability: ${triggerCheckError.message}`);
      }

      // DEBUGGING STEP 3: Setup trigger with enhanced error logging
      console.log(`🎯 Setting up trigger: ${params.trigger_name} for ${params.app_name}`);
      console.log(`🔧 Using config:`, JSON.stringify(params.config, null, 2));
      
      const response = await entity.setupTrigger({
        app: params.app_name,
        triggerName: params.trigger_name,
        config: params.config
      });

      // Handle response safely - the response type may vary
      const composioTriggerId = (response as any)?.id || (response as any)?.triggerId || `trigger_${Date.now()}`;
      console.log(`✅ Trigger created successfully with ID: ${composioTriggerId}`);
      console.log(`📊 Full response:`, JSON.stringify(response, null, 2));

      // Store in database
      const { data, error } = await supabaseService
        .from('trigger_configs')
        .insert({
          user_id: params.user_id,
          app_name: params.app_name,
          trigger_name: params.trigger_name,
          composio_trigger_id: composioTriggerId,
          config: params.config,
          is_active: true
        })
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        throw new Error(`Failed to store trigger: ${error.message}`);
      }

      console.log(`💾 Trigger stored in database with ID: ${data.id}`);
      return data as TriggerConfig;

    } catch (error: any) {
      console.error('❌ Error creating trigger:', error);
      
      // Enhanced error logging for debugging
      if (error.metadata) {
        console.error('🔍 Error metadata:', {
          fullUrl: error.metadata.fullUrl,
          method: error.metadata.method,
          statusCode: error.metadata.statusCode,
          requestId: error.metadata.requestId,
          errorId: error.errorId,
          errCode: error.errCode,
          description: error.description,
          possibleFix: error.possibleFix
        });
      }
      
      throw new Error(`Failed to create trigger: ${error.message}`);
    }
  }

  /**
   * Get all triggers for a user (both active and inactive)
   */
  async getUserTriggers(userId: string, appName?: string): Promise<TriggerConfig[]> {
    try {
      let query = supabaseService
        .from('trigger_configs')
        .select('*')
        .eq('user_id', userId);

      if (appName) {
        query = query.eq('app_name', appName);
      }

      // Get all triggers (active and inactive), ordered by active status first, then by creation date
      const { data, error } = await query
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch triggers: ${error.message}`);
      }

      return data || [];
    } catch (error: any) {
      console.error('Error fetching user triggers:', error);
      throw error;
    }
  }

  /**
   * Update trigger configuration
   */
  async updateTrigger(triggerId: string, updates: Partial<TriggerConfig>): Promise<TriggerConfig> {
    try {
      const { data, error } = await supabaseService
        .from('trigger_configs')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', triggerId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update trigger: ${error.message}`);
      }

      return data as TriggerConfig;
    } catch (error: any) {
      console.error('Error updating trigger:', error);
      throw error;
    }
  }

  /**
   * Delete a trigger (actually just disable it - don't remove from database)
   */
  async deleteTrigger(triggerId: string): Promise<boolean> {
    try {
      // Get trigger config first
      const { data: triggerConfig, error: fetchError } = await supabaseService
        .from('trigger_configs')
        .select('*')
        .eq('id', triggerId)
        .single();

      if (fetchError || !triggerConfig) {
        throw new Error('Trigger not found');
      }

      console.log(`🔴 Disabling trigger: ${triggerId} (Composio ID: ${triggerConfig.composio_trigger_id})`);

      // Disable in Composio backend using the correct method from docs
      if (triggerConfig.composio_trigger_id) {
        try {
          // Method 1: Using the triggers.disable() method directly (recommended from docs)
          console.log(`🔄 Disabling trigger in Composio: ${triggerConfig.composio_trigger_id}`);
          
          const result = await this.composio.triggers.disable({ 
            triggerId: triggerConfig.composio_trigger_id 
          });
          
          console.log(`✅ Successfully disabled trigger in Composio:`, result);
          
        } catch (composioError: any) {
          console.warn('⚠️ Warning: Failed to disable trigger in Composio:', composioError.message);
          
          // Try alternative method using entity if the first method fails
          try {
            console.log(`🔄 Trying alternative method with entity...`);
            const entity = await this.composio.getEntity(triggerConfig.user_id);
            await entity.disableTrigger(triggerConfig.composio_trigger_id);
            console.log(`✅ Successfully disabled trigger using entity method`);
          } catch (entityError: any) {
            console.warn('⚠️ Warning: Both disable methods failed:', entityError.message);
            // Continue with database update even if Composio disable fails
          }
        }
      }

      // Mark as inactive in our database (don't delete)
      const { error: updateError } = await supabaseService
        .from('trigger_configs')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', triggerId);

      if (updateError) {
        throw new Error(`Failed to update trigger status in database: ${updateError.message}`);
      }

      console.log(`✅ Trigger successfully disabled and marked inactive: ${triggerId}`);
      return true;

    } catch (error: any) {
      console.error('❌ Error disabling trigger:', error);
      throw error;
    }
  }

  /**
   * Process webhook event from Composio
   */
  async processWebhookEvent(eventData: TriggerEventData): Promise<void> {
    try {
      console.log(`📥 Processing webhook event: ${eventData.appName}`);
      console.log(`🔍 Event payload:`, JSON.stringify(eventData.payload, null, 2));

      // Find the trigger config
      const { data: triggerConfig, error } = await supabaseService
        .from('trigger_configs')
        .select('*')
        .eq('composio_trigger_id', eventData.metadata.triggerId)
        .eq('user_id', eventData.metadata.entityId)
        .single();

      if (error || !triggerConfig) {
        console.warn(`⚠️ No trigger config found for trigger ID: ${eventData.metadata.triggerId}`);
        return;
      }

      // Log the event
      await this.logTriggerEvent(triggerConfig.id!, eventData);

      // Process the event based on app and trigger type
      await this.handleTriggerEvent(triggerConfig, eventData);

      console.log(`✅ Successfully processed webhook event for ${eventData.appName}`);

    } catch (error: any) {
      console.error('Error processing webhook event:', error);
      
      // Log failed event
      try {
        await this.logTriggerEvent(null, eventData, 'failed', error.message);
      } catch (logError) {
        console.error('Failed to log error event:', logError);
      }
    }
  }

  /**
   * Handle specific trigger events based on app and type
   */
  private async handleTriggerEvent(triggerConfig: TriggerConfig, eventData: TriggerEventData): Promise<void> {
    const eventKey = `${eventData.appName}_${triggerConfig.trigger_name}`;
    
    console.log(`🎯 Handling event: ${eventKey}`);

    switch (eventKey) {
              case 'gmail_GMAIL_NEW_GMAIL_MESSAGE':
        await this.handleGmailEvent(triggerConfig, eventData);
        break;
        
      case 'googlecalendar_GOOGLECALENDAR_EVENT_CREATED':
        await this.handleCalendarEvent(triggerConfig, eventData);
        break;
        
      case 'notion_NOTION_PAGE_CREATED':
        await this.handleNotionEvent(triggerConfig, eventData);
        break;
        
      default:
        await this.handleGenericEvent(triggerConfig, eventData);
    }
  }

  /**
   * Handle Gmail events
   */
  private async handleGmailEvent(triggerConfig: TriggerConfig, eventData: TriggerEventData): Promise<void> {
    const email = eventData.payload;
    
    // Create notification
    await this.createNotification(triggerConfig.user_id, {
      type: 'gmail_event',
      title: 'New Email Received',
      message: `From: ${email.from}\nSubject: ${email.subject}`,
      data: {
        emailId: email.id,
        from: email.from,
        subject: email.subject,
        triggerConfigId: triggerConfig.id
      }
    });
  }

  /**
   * Handle Calendar events
   */
  private async handleCalendarEvent(triggerConfig: TriggerConfig, eventData: TriggerEventData): Promise<void> {
    const event = eventData.payload;
    
    // Create notification
    await this.createNotification(triggerConfig.user_id, {
      type: 'calendar_event',
      title: 'New Calendar Event',
      message: `Event: ${event.summary}\nTime: ${event.start?.dateTime || event.start?.date}`,
      data: {
        eventId: event.id,
        summary: event.summary,
        startTime: event.start?.dateTime || event.start?.date,
        triggerConfigId: triggerConfig.id
      }
    });
  }

  /**
   * Handle Notion events
   */
  private async handleNotionEvent(triggerConfig: TriggerConfig, eventData: TriggerEventData): Promise<void> {
    const page = eventData.payload;
    
    // Create notification
    await this.createNotification(triggerConfig.user_id, {
      type: 'notion_event',
      title: 'New Notion Page',
      message: `Page created: ${page.properties?.title?.title?.[0]?.plain_text || 'Untitled'}`,
      data: {
        pageId: page.id,
        title: page.properties?.title?.title?.[0]?.plain_text,
        triggerConfigId: triggerConfig.id
      }
    });
  }

  /**
   * Handle generic events
   */
  private async handleGenericEvent(triggerConfig: TriggerConfig, eventData: TriggerEventData): Promise<void> {
    // Create generic notification
    await this.createNotification(triggerConfig.user_id, {
      type: 'trigger_event',
      title: `${eventData.appName} Event`,
      message: `New ${triggerConfig.trigger_name} event occurred`,
      data: {
        appName: eventData.appName,
        triggerName: triggerConfig.trigger_name,
        payload: eventData.payload,
        triggerConfigId: triggerConfig.id
      }
    });
  }

  /**
   * Get available triggers for an app
   */
  async getAvailableTriggers(appName: string): Promise<any[]> {
    try {
      // Get available triggers from Composio
      const triggers = await this.composio.triggers.list({
        appNames: [appName]
      });

      return triggers || [];
    } catch (error: any) {
      console.error('Error fetching available triggers:', error);
      return [];
    }
  }

  /**
   * Debug method to check connection status for a user
   */
  async debugConnectionStatus(userId: string, appName: string): Promise<any> {
    try {
      console.log(`🔍 Debugging connection status for user ${userId}, app ${appName}`);
      
      const entity = await this.composio.getEntity(userId);
      const connection = await entity.getConnection({ app: appName });
      
      console.log(`📡 Connection details:`, {
        exists: !!connection,
        id: connection?.id,
        status: connection?.status,
        appName: connection?.appName,
        appUniqueId: connection?.appUniqueId,
        createdAt: connection?.createdAt,
        updatedAt: connection?.updatedAt,
        fullObject: connection
      });

      return connection;
    } catch (error: any) {
      console.error(`❌ Error checking connection:`, error);
      throw error;
    }
  }

  /**
   * Enable a trigger (mark as active)
   */
  async enableTrigger(composioTriggerId: string): Promise<void> {
    try {
      console.log(`🟢 Enabling trigger: ${composioTriggerId}`);
      
      // Enable in Composio using the correct method from docs
      try {
        const result = await this.composio.triggers.enable({ 
          triggerId: composioTriggerId 
        });
        console.log(`✅ Successfully enabled trigger in Composio:`, result);
      } catch (composioError: any) {
        console.warn('⚠️ Warning: Could not enable trigger in Composio:', composioError.message);
        
        // Note: Entity class only has disableTrigger method according to docs
        // No enableTrigger method available on Entity class
      }
      
      // Update database status
      const { error } = await supabaseService
        .from('trigger_configs')
        .update({ is_active: true })
        .eq('composio_trigger_id', composioTriggerId);
        
      if (error) {
        throw new Error(`Failed to update trigger status in database: ${error.message}`);
      }
      
      console.log(`✅ Trigger enabled and database updated: ${composioTriggerId}`);
    } catch (error: any) {
      console.error('❌ Error enabling trigger:', error);
      throw error;
    }
  }

  /**
   * Disable a trigger (mark as inactive)
   */
  async disableTrigger(composioTriggerId: string): Promise<void> {
    try {
      console.log(`🔴 Disabling trigger: ${composioTriggerId}`);
      
      // Disable in Composio using the correct method from docs
      try {
        const result = await this.composio.triggers.disable({ 
          triggerId: composioTriggerId 
        });
        console.log(`✅ Successfully disabled trigger in Composio:`, result);
      } catch (composioError: any) {
        console.warn('⚠️ Warning: Could not disable trigger in Composio:', composioError.message);
        
        // Try alternative method using entity
        try {
          const entity = await this.composio.getEntity('default'); // We may need user_id here
          await entity.disableTrigger(composioTriggerId);
          console.log(`✅ Successfully disabled trigger using entity method`);
        } catch (entityError: any) {
          console.warn('⚠️ Warning: Both disable methods failed:', entityError.message);
        }
      }
      
      // Update database status
      const { error } = await supabaseService
        .from('trigger_configs')
        .update({ is_active: false })
        .eq('composio_trigger_id', composioTriggerId);
        
      if (error) {
        throw new Error(`Failed to update trigger status in database: ${error.message}`);
      }
      
      console.log(`✅ Trigger disabled and database updated: ${composioTriggerId}`);
    } catch (error: any) {
      console.error('❌ Error disabling trigger:', error);
      throw error;
    }
  }

  /**
   * Log trigger event to database
   */
  private async logTriggerEvent(
    triggerConfigId: string | null,
    eventData: TriggerEventData,
    status: 'success' | 'failed' | 'pending' = 'success',
    errorMessage?: string
  ): Promise<void> {
    try {
      await supabaseService
        .from('trigger_events')
        .insert({
          trigger_config_id: triggerConfigId,
          user_id: eventData.metadata.entityId,
          event_type: eventData.appName,
          payload: eventData.payload,
          processing_status: status,
          error_message: errorMessage,
          processed_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error logging trigger event:', error);
    }
  }

  /**
   * Create user notification
   */
  private async createNotification(userId: string, notification: {
    type: string;
    title: string;
    message: string;
    data: any;
  }): Promise<void> {
    try {
      await supabaseService
        .from('user_notifications')
        .insert({
          user_id: userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          read: false,
          created_at: new Date().toISOString()
        });
      
      console.log(`✅ Created notification for user ${userId}: ${notification.title}`);
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  }
}

// Export singleton instance
export const triggerService = new TriggerService(); 