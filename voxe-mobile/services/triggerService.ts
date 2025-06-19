const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3002/api';

export interface TriggerConfig {
  id: string;
  user_id: string;
  app_name: string;
  trigger_name: string;
  composio_trigger_id: string;
  config: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TriggerEvent {
  id: string;
  trigger_config_id: string;
  user_id: string;
  event_type: string;
  payload: any;
  processed_at: string;
  processing_status: 'success' | 'failed' | 'pending';
  error_message?: string;
  notification_sent: boolean;
}

export interface CreateTriggerRequest {
  user_id: string;
  app_name: string;
  trigger_name: string;
  config: any;
}

export interface AvailableTrigger {
  name: string;
  display_name: string;
  description: string;
  appName: string;
  config: any;
}

export interface ApiResponse<T> {
  status: string;
  data?: T;
  triggers?: T;
  count?: number;
  message?: string;
  error?: string;
  timestamp: string;
}

class TriggerService {
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Get user ID for authenticated requests
    let userId: string | null = null;
    try {
      const { supabaseService } = await import('./supabase');
      const user = await supabaseService.getCurrentUser();
      userId = user?.id || null;
    } catch (userError) {
      console.warn('Could not get user ID for trigger request:', userError);
    }
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(userId && { 'x-user-id': userId }),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || error.error || 'Trigger API request failed');
    }

    return response.json();
  }

  /**
   * Get all triggers for the current user
   */
  async getUserTriggers(appName?: string): Promise<TriggerConfig[]> {
    try {
      // Get user ID
      const { supabaseService } = await import('./supabase');
      const user = await supabaseService.getCurrentUser();
      
      if (!user?.id) {
        throw new Error('User authentication required');
      }

      const params = new URLSearchParams({ userId: user.id });
      if (appName) {
        params.append('appName', appName);
      }

      const response = await this.request<ApiResponse<TriggerConfig[]>>(
        `/composio/triggers?${params.toString()}`
      );

      return response.triggers || [];
    } catch (error) {
      console.error('Error fetching user triggers:', error);
      throw error;
    }
  }

  /**
   * Check if user has connected a specific app
   */
  async checkAppConnection(appName: string): Promise<boolean> {
    try {
      // Get user ID
      const { supabaseService } = await import('./supabase');
      const user = await supabaseService.getCurrentUser();
      
      if (!user?.id) {
        throw new Error('User authentication required');
      }

      // Import composio service to check connection status
      const { composioService } = await import('./composio');
      const connectionStatus = await composioService.getConnectionStatus(user.id);
      
      const appConnection = connectionStatus.connections[appName as keyof typeof connectionStatus.connections];
      return appConnection?.connected || false;
    } catch (error) {
      console.error('Error checking app connection:', error);
      return false;
    }
  }

  /**
   * Create a new trigger with connection validation
   */
  async createTrigger(params: CreateTriggerRequest): Promise<TriggerConfig> {
    try {
      // First, validate that the user has connected the app
      const isConnected = await this.checkAppConnection(params.app_name);
      
      if (!isConnected) {
        throw new Error(`Please connect ${params.app_name} in the Connections tab before creating triggers`);
      }

      const response = await this.request<ApiResponse<TriggerConfig>>(
        '/composio/triggers',
        {
          method: 'POST',
          body: JSON.stringify(params),
        }
      );

      if (!response.data) {
        throw new Error('Invalid response format');
      }

      return response.data;
    } catch (error) {
      console.error('Error creating trigger:', error);
      throw error;
    }
  }

  /**
   * Update a trigger
   */
  async updateTrigger(triggerId: string, updates: Partial<TriggerConfig>): Promise<TriggerConfig> {
    try {
      const response = await this.request<ApiResponse<TriggerConfig>>(
        `/composio/triggers/${triggerId}`,
        {
          method: 'PUT',
          body: JSON.stringify(updates),
        }
      );

      if (!response.data) {
        throw new Error('Invalid response format');
      }

      return response.data;
    } catch (error) {
      console.error('Error updating trigger:', error);
      throw error;
    }
  }

  /**
   * Delete a trigger
   */
  async deleteTrigger(triggerId: string): Promise<boolean> {
    try {
      await this.request<ApiResponse<void>>(
        `/composio/triggers/${triggerId}`,
        {
          method: 'DELETE',
        }
      );

      return true;
    } catch (error) {
      console.error('Error deleting trigger:', error);
      throw error;
    }
  }

  /**
   * Get available triggers for an app
   */
  async getAvailableTriggers(appName: string): Promise<AvailableTrigger[]> {
    try {
      const response = await this.request<ApiResponse<AvailableTrigger[]>>(
        `/composio/triggers/available/${appName}`
      );

      return response.triggers || [];
    } catch (error) {
      console.error('Error fetching available triggers:', error);
      throw error;
    }
  }

  /**
   * Enable a trigger
   */
  async enableTrigger(triggerId: string): Promise<void> {
    try {
      await this.request<ApiResponse<void>>(
        `/composio/triggers/${triggerId}/enable`,
        {
          method: 'POST',
        }
      );
    } catch (error) {
      console.error('Error enabling trigger:', error);
      throw error;
    }
  }

  /**
   * Disable a trigger
   */
  async disableTrigger(triggerId: string): Promise<void> {
    try {
      await this.request<ApiResponse<void>>(
        `/composio/triggers/${triggerId}/disable`,
        {
          method: 'POST',
        }
      );
    } catch (error) {
      console.error('Error disabling trigger:', error);
      throw error;
    }
  }

  /**
   * Get trigger events/history
   */
  async getTriggerEvents(triggerId?: string): Promise<TriggerEvent[]> {
    try {
      // This would require a new backend endpoint for trigger events
      // For now, return empty array
      console.log('getTriggerEvents not yet implemented in backend');
      return [];
    } catch (error) {
      console.error('Error fetching trigger events:', error);
      throw error;
    }
  }

  /**
   * Test webhook endpoint
   */
  async testWebhook(userId?: string): Promise<{ status: string; message: string }> {
    try {
      const response = await this.request<{ status: string; message: string }>(
        '/composio/webhook/test',
        {
          method: 'POST',
          body: JSON.stringify({ userId }),
        }
      );

      return response;
    } catch (error) {
      console.error('Error testing webhook:', error);
      throw error;
    }
  }

  /**
   * Get webhook configuration
   */
  async getWebhookConfig(): Promise<{
    webhookUrl: string;
    healthCheckUrl: string;
    testUrl: string;
    secretConfigured: boolean;
    environment: string;
  }> {
    try {
      const response = await this.request<{
        webhookUrl: string;
        healthCheckUrl: string;
        testUrl: string;
        secretConfigured: boolean;
        environment: string;
      }>('/composio/webhook/config');

      return response;
    } catch (error) {
      console.error('Error fetching webhook config:', error);
      throw error;
    }
  }

  /**
   * Health check for triggers service
   */
  async healthCheck(): Promise<{ status: string; service: string }> {
    try {
      const response = await this.request<{ status: string; service: string }>(
        '/composio/triggers/health'
      );

      return response;
    } catch (error) {
      console.error('Error checking triggers health:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const triggerService = new TriggerService(); 