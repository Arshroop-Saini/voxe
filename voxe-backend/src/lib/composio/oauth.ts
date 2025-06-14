import { OpenAIToolSet } from 'composio-core';

// Composio OAuth Integration Service following official documentation patterns
export class ComposioOAuthService {
  private toolset: OpenAIToolSet;
  private connectionRequests: Map<string, any> = new Map(); // Store connection requests

  constructor() {
    this.toolset = new OpenAIToolSet({
      apiKey: process.env.COMPOSIO_API_KEY
    });
    
    console.log('🔄 ComposioOAuthService initialized - using Composio default OAuth');
  }

  /**
   * Initiate OAuth connection using Composio's default OAuth flow
   * Following the exact documentation pattern
   */
  async initiateConnection(userId: string, appName: string, redirectUrl?: string): Promise<{
    redirectUrl: string;
    connectionId: string;
    status: string;
  }> {
    try {
      console.log(`🚀 Initiating ${appName} connection for user: ${userId}`);
      
      const finalRedirectUri = redirectUrl || `${process.env.BACKEND_URL || 'http://localhost:3002'}/api/composio/oauth/callback`;
      console.log(`🔍 Final redirect URI: "${finalRedirectUri}"`);

      // Get entity - following docs pattern
      const entity = await this.toolset.getEntity(userId);
      console.log(`🔍 Got entity for user: ${userId}`);

      // Initiate connection - following exact docs pattern
      const connectionRequest = await entity.initiateConnection({
        appName: appName,
        redirectUri: finalRedirectUri
      });

      console.log(`✅ Connection initiated successfully`);
      console.log(`🔍 Connection ID: ${connectionRequest.connectedAccountId}`);
      console.log(`🔍 Redirect URL: ${connectionRequest.redirectUrl}`);
      console.log(`🔍 Status: ${connectionRequest.connectionStatus}`);

      // Verify we got a proper redirect URL
      if (!connectionRequest.redirectUrl) {
        throw new Error('No redirect URL received from Composio');
      }

      // Store the connectionRequest object for later use with waitUntilActive()
      const requestKey = `${userId}-${appName}`;
      this.connectionRequests.set(requestKey, connectionRequest);
      console.log(`🔍 Stored connection request for key: ${requestKey}`);

      // Also store in database for persistence
      await this.storeConnectionRequest(userId, appName, {
        connectionId: connectionRequest.connectedAccountId,
        status: connectionRequest.connectionStatus || 'INITIATED',
        redirectUrl: connectionRequest.redirectUrl,
        integrationId: 'default',
        createdAt: new Date().toISOString()
      });

      return {
        redirectUrl: connectionRequest.redirectUrl,
        connectionId: connectionRequest.connectedAccountId,
        status: connectionRequest.connectionStatus || 'INITIATED'
      };

    } catch (error: any) {
      console.error(`❌ Error initiating ${appName} connection:`, error);
      throw error;
    }
  }

  /**
   * Wait for connection to become active using the official waitUntilActive() method
   * Following the exact documentation pattern
   */
  async waitForConnection(userId: string, appName: string, timeout: number = 120): Promise<{
    connectionId: string;
    status: string;
    isActive: boolean;
  }> {
    try {
      console.log(`⏳ Waiting for ${appName} connection to become active (timeout: ${timeout}s)`);
      
      // Get the stored connectionRequest object
      const requestKey = `${userId}-${appName}`;
      const connectionRequest = this.connectionRequests.get(requestKey);
      
      if (!connectionRequest) {
        throw new Error(`No connection request found for ${userId}-${appName}. Call initiateConnection first.`);
      }

      console.log(`🔍 Found stored connection request for ${requestKey}`);
      console.log(`🔍 Using waitUntilActive() method from docs...`);

      // Use the official waitUntilActive() method from the documentation
      const activeConnection = await connectionRequest.waitUntilActive(timeout);
      
      console.log(`✅ Connection became active: ${activeConnection.id}`);
      console.log(`🔍 Active connection status: ${activeConnection.status}`);
      
      // Update database status
      await this.updateConnectionStatus(userId, appName, 'ACTIVE', activeConnection.id);
      
      // Clean up stored connection request
      this.connectionRequests.delete(requestKey);
      
      return {
        connectionId: activeConnection.id,
        status: 'ACTIVE',
        isActive: true
      };

    } catch (error: any) {
      console.error(`❌ Error waiting for ${appName} connection:`, error);
      
      // Clean up stored connection request on error
      const requestKey = `${userId}-${appName}`;
      this.connectionRequests.delete(requestKey);
      
      // Check if it's a timeout error
      if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
        console.log(`⏰ Connection timeout for ${appName} after ${timeout} seconds`);
        await this.updateConnectionStatus(userId, appName, 'TIMEOUT', '');
        
        return {
          connectionId: '',
          status: 'TIMEOUT',
          isActive: false
        };
      }
      
      // Other errors
      await this.updateConnectionStatus(userId, appName, 'FAILED', '');
      return {
        connectionId: '',
        status: 'FAILED',
        isActive: false
      };
    }
  }

  /**
   * Get connection status for multiple apps
   */
  async getConnectionStatus(userId: string): Promise<Record<string, any>> {
    try {
      console.log(`📊 Getting connection status for user: ${userId}`);
      
      const connections = await this.toolset.connectedAccounts.list({
        entityId: userId
      });

      console.log(`📊 Found ${connections.items?.length || 0} total connections`);

      const apps = ['gmail', 'googlecalendar', 'googledocs', 'googledrive', 'googlesheets', 'notion'];
      const status: Record<string, any> = {};

      for (const app of apps) {
        const connection = connections.items?.find(conn => 
          conn.appName === app || conn.appUniqueId === app
        );

        if (connection) {
          status[app] = {
            connectionId: connection.id,
            status: connection.status,
            connected: connection.status === 'ACTIVE'
          };
          console.log(`📊 Status for ${app}: ${connection.status}`);
        } else {
          status[app] = 'No connection found';
          console.log(`📊 Status for ${app}: No connection found`);
        }
      }

      return status;
    } catch (error: any) {
      console.error('❌ Error getting connection status:', error);
      throw error;
    }
  }

  /**
   * Get all active connections for a user
   */
  async getUserConnections(userId: string): Promise<Array<{
    appName: string;
    connectionId: string;
    status: string;
    connectedAt: string;
  }>> {
    try {
      console.log(`Getting connections for user: ${userId}`);
      
      const connections = await this.toolset.connectedAccounts.list({
        entityId: userId
      });

      return connections.items?.map(conn => ({
        appName: conn.appName || conn.appUniqueId || 'unknown',
        connectionId: conn.id,
        status: conn.status,
        connectedAt: conn.createdAt || new Date().toISOString()
      })) || [];
    } catch (error: any) {
      console.error('Error getting user connections:', error);
      throw error;
    }
  }

  /**
   * Disconnect an app for a user
   */
  async disconnectApp(userId: string, appName: string): Promise<boolean> {
    try {
      console.log(`Disconnecting ${appName} for user: ${userId}`);
      
      const connections = await this.toolset.connectedAccounts.list({
        entityId: userId
      });

      const connection = connections.items?.find(conn => 
        conn.appName === appName || conn.appUniqueId === appName
      );

      if (connection) {
        await this.toolset.connectedAccounts.delete({
          connectedAccountId: connection.id
        });
        console.log(`Successfully disconnected ${appName}`);
        return true;
      } else {
        console.log(`No connection found for ${appName}`);
        return false;
      }
    } catch (error: any) {
      console.error(`Error disconnecting ${appName}:`, error);
      throw error;
    }
  }

  /**
   * Get or create entity for a user
   */
  async getOrCreateEntity(userId: string): Promise<any> {
    try {
      return await this.toolset.getEntity(userId);
    } catch (error: any) {
      console.error('Error getting/creating entity:', error);
      throw error;
    }
  }

  // Database helper methods remain the same
  private async storeConnectionRequest(userId: string, appName: string, connectionData: {
    connectionId: string;
    status: string;
    redirectUrl: string;
    integrationId: string;
    createdAt: string;
  }): Promise<void> {
    try {
      // This would store in your database
      console.log(`📝 Storing connection request for ${userId}-${appName}:`, connectionData);
      // Implementation depends on your database choice
    } catch (error: any) {
      console.error('Error storing connection request:', error);
      // Don't throw - this is not critical for OAuth flow
    }
  }

  private async getConnectionRequest(userId: string, appName: string): Promise<{
    connection_id: string;
    status: string;
    redirect_url: string;
    integration_id: string;
    created_at: string;
  } | null> {
    try {
      // This would retrieve from your database
      console.log(`📖 Getting connection request for ${userId}-${appName}`);
      return null; // Placeholder
    } catch (error: any) {
      console.error('Error getting connection request:', error);
      return null;
    }
  }

  private async updateConnectionStatus(userId: string, appName: string, status: string, connectionId: string): Promise<void> {
    try {
      // This would update your database
      console.log(`📝 Updating connection status for ${userId}-${appName}: ${status} (${connectionId})`);
      // Implementation depends on your database choice
    } catch (error: any) {
      console.error('Error updating connection status:', error);
      // Don't throw - this is not critical for OAuth flow
    }
  }
}

export const composioOAuth = new ComposioOAuthService(); 