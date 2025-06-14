import * as WebBrowser from 'expo-web-browser';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL

export interface AppConnection {
  connected: boolean;
  status: 'CONNECTED' | 'NOT_CONNECTED' | 'CONNECTING' | 'ERROR';
  connectionId?: string;
  connectedAt?: string;
  error?: string;
}

export interface ConnectionStatus {
  userId: string;
  connections: {
    gmail: AppConnection;
    googlecalendar: AppConnection;
    googledocs: AppConnection;
    googledrive: AppConnection;
    googlesheets: AppConnection;
    notion: AppConnection;
  };
  supportedApps: string[];
}

export interface OAuthInitiateResponse {
  success: boolean;
  data?: {
    redirectUrl: string;
    connectionId: string;
    status: string;
    appName: string;
  };
  error?: string;
}

export interface CommandResponse {
  success: boolean;
  data?: {
    success: boolean;
    response: string;
    toolsUsed: string[];
    steps: number;
  };
  error?: string;
}

class ComposioService {
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    console.log(`Making API request to: ${url}`);
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      console.log(`API response status: ${response.status} for ${url}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error response:`, errorText);
        
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.error || `API request failed with status ${response.status}`);
        } catch {
          throw new Error(`API request failed with status ${response.status}: ${errorText}`);
        }
      }

      const result = await response.json();
      console.log(`API response data:`, result);
      return result;
    } catch (error) {
      console.error(`API request failed for ${url}:`, error);
      throw error;
    }
  }

  async getConnectionStatus(userId: string): Promise<ConnectionStatus> {
    const response = await this.request<{ success: boolean; data: ConnectionStatus }>(`/composio/oauth/status/${userId}`);
    return response.data;
  }

  async initiateConnection(userId: string, appName: string): Promise<OAuthInitiateResponse> {
    const response = await this.request<{ success: boolean; data: any; error?: string }>('/composio/oauth/initiate', {
      method: 'POST',
      body: JSON.stringify({ userId, appName }),
    });
    
    return {
      success: response.success,
      data: response.data,
      error: response.error,
    };
  }

  async waitForConnection(userId: string, appName: string, connectionId: string): Promise<{ success: boolean; status: string }> {
    const response = await this.request<{ success: boolean; data: any }>('/composio/oauth/wait', {
      method: 'POST',
      body: JSON.stringify({ userId, appName, connectionId }),
    });
    
    return {
      success: response.success,
      status: response.data?.status || 'UNKNOWN',
    };
  }

  async disconnectApp(userId: string, appName: string): Promise<{ success: boolean }> {
    const response = await this.request<{ success: boolean; data: any }>('/composio/oauth/disconnect', {
      method: 'DELETE',
      body: JSON.stringify({ userId, appName }),
    });
    
    return {
      success: response.success,
    };
  }

  async executeCommand(command: string, userId: string): Promise<CommandResponse> {
    const response = await this.request<{ success: boolean; data: any; error?: string }>('/ai/composio/execute', {
      method: 'POST',
      body: JSON.stringify({ command, userId }),
    });
    
    return {
      success: response.success,
      data: response.data,
      error: response.error,
    };
  }

  async executeWorkflow(command: string, userId: string): Promise<CommandResponse> {
    const response = await this.request<{ success: boolean; data: any; error?: string }>('/ai/composio/workflow', {
      method: 'POST',
      body: JSON.stringify({ command, userId }),
    });
    
    return {
      success: response.success,
      data: response.data,
      error: response.error,
    };
  }

  async connectApp(userId: string, appName: string): Promise<boolean> {
    try {
      console.log(`Starting OAuth connection for ${appName}...`);
      
      // Step 1: Initiate OAuth connection
      const initiateResponse = await this.initiateConnection(userId, appName);
      
      if (!initiateResponse.success || !initiateResponse.data) {
        const errorMsg = initiateResponse.error || 'Failed to initiate OAuth';
        console.error(`Failed to initiate OAuth for ${appName}:`, errorMsg);
        throw new Error(errorMsg);
      }

      const { redirectUrl, connectionId } = initiateResponse.data;
      
      console.log(`Opening OAuth URL for ${appName}: ${redirectUrl}`);
      
      // Determine the correct callback URL for browser environment
      const baseUrl = process.env.EXPO_PUBLIC_OAUTH_REDIRECT_URL || 'http://localhost:8081';
      const callbackUrl = `${baseUrl}/composio/callback`;
      
      console.log(`Using callback URL: ${callbackUrl}`);
      
      // Step 2: Open OAuth URL in browser with proper callback handling
      const result = await WebBrowser.openAuthSessionAsync(
        redirectUrl,
        callbackUrl,
        {
          showTitle: true,
          toolbarColor: '#6366f1',
          controlsColor: '#ffffff',
          // For web, we want to show in same window
          showInRecents: false,
        }
      );

      console.log(`OAuth session result for ${appName}:`, result);

      if (result.type === 'cancel') {
        console.log(`User cancelled OAuth flow for ${appName}`);
        return false;
      }

      if (result.type === 'dismiss') {
        console.log(`OAuth browser was dismissed for ${appName}`);
        // Don't return false immediately - the OAuth might have completed
        // Continue to polling to check if connection was established
      }

      console.log(`OAuth browser session completed for ${appName}, checking connection status...`);
      
      // Step 3: Check connection status immediately first
      try {
        const immediateCheck = await this.waitForConnection(userId, appName, connectionId);
        if (immediateCheck.success && immediateCheck.status === 'ACTIVE') {
          console.log(`${appName} connected successfully (immediate check)!`);
          return true;
        }
      } catch (error) {
        console.log(`Immediate check failed, continuing with polling:`, error);
      }
      
      // Step 4: Poll for connection status with increased timeout
      const maxAttempts = 30; // 30 seconds timeout (increased from 15)
      let attempts = 0;
      
      while (attempts < maxAttempts) {
        try {
          console.log(`Checking connection status for ${appName} (attempt ${attempts + 1}/${maxAttempts})`);
          
          const waitResponse = await this.waitForConnection(userId, appName, connectionId);
          
          if (waitResponse.success && waitResponse.status === 'ACTIVE') {
            console.log(`${appName} connected successfully!`);
            return true;
          }
          
          if (waitResponse.status === 'FAILED' || waitResponse.status === 'ERROR') {
            console.error(`OAuth connection failed for ${appName}: ${waitResponse.status}`);
            throw new Error(`OAuth connection failed for ${appName}`);
          }
          
          if (waitResponse.status === 'TIMEOUT') {
            console.error(`OAuth connection timed out for ${appName}`);
            throw new Error(`Connection timeout for ${appName}`);
          }
          
          // Wait 1 second before next attempt (same as before)
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
          
        } catch (error) {
          console.error(`Error checking connection status for ${appName}:`, error);
          
          // If it's a network error, retry
          if (error instanceof Error && (
            error.message.includes('fetch') || 
            error.message.includes('network') ||
            error.message.includes('timeout')
          )) {
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait longer for network errors
            continue;
          }
          
          // For other errors, throw immediately
          throw error;
        }
      }
      
      console.error(`Connection timeout for ${appName} after ${maxAttempts} attempts`);
      throw new Error(`Connection timeout for ${appName} - please try again`);
      
    } catch (error) {
      console.error(`Error connecting ${appName}:`, error);
      throw error;
    }
  }

  getAppDisplayName(appName: string): string {
    const displayNames: Record<string, string> = {
      gmail: 'Gmail',
      googlecalendar: 'Google Calendar',
      googledocs: 'Google Docs',
      googledrive: 'Google Drive',
      googlesheets: 'Google Sheets',
      notion: 'Notion',
    };
    return displayNames[appName] || appName;
  }

  getAppDescription(appName: string): string {
    const descriptions: Record<string, string> = {
      gmail: 'Send emails, manage inbox, organize with labels',
      googlecalendar: 'Schedule meetings, manage events, find free time',
      googledocs: 'Create documents, collaborate, format content',
      googledrive: 'Upload files, organize folders, manage permissions',
      googlesheets: 'Create spreadsheets, analyze data, manage formulas',
      notion: 'Create pages, manage databases, organize workspaces',
    };
    return descriptions[appName] || 'Connect this app to enable voice commands';
  }

  getAppIcon(appName: string): string {
    const icons: Record<string, string> = {
      gmail: '📧',
      googlecalendar: '📅',
      googledocs: '📄',
      googledrive: '💾',
      googlesheets: '📊',
      notion: '📝',
    };
    return icons[appName] || '🔗';
  }
}

export const composioService = new ComposioService();