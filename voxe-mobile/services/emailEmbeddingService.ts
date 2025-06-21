const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3002/api';

export interface EmbedEmailsResponse {
  success: boolean;
  message: string;
  data?: {
    totalEmails: number;
    successful: number;
    failed: number;
    results: Array<{
      emailId: string;
      memoryId: string;
      status: 'success' | 'failed';
      error?: string;
      timestamp: string;
    }>;
    timestamp: string;
    processingTimeMs: number;
  };
  error?: string;
  code?: string;
  details?: any;
}

export interface EmbeddingStatusResponse {
  success: boolean;
  message: string;
  data?: {
    lastEmbedding?: {
      timestamp: string;
      totalEmails: number;
      successful: number;
      failed: number;
    };
    totalEmbeddings: number;
    status: 'idle' | 'processing' | 'error';
  };
  error?: string;
}

export interface ApiError {
  error: string;
  message?: string;
  details?: any;
  code?: string;
}

class EmailEmbeddingService {
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      const error: ApiError = data;
      throw new Error(error.message || error.error || 'API request failed');
    }

    return data;
  }

  /**
   * Embed today's emails for the current user
   */
  async embedDailyEmails(): Promise<EmbedEmailsResponse> {
    console.log('🔄 Starting email embedding process...');
    
    // Get user ID for the request
    let userId: string | null = null;
    try {
      const { supabaseService } = await import('./supabase');
      const user = await supabaseService.getCurrentUser();
      userId = user?.id || null;
      console.log('✅ User ID retrieved:', userId ? `${userId.substring(0, 8)}...` : 'null');
    } catch (userError) {
      console.error('❌ Failed to get user ID for email embedding:', userError);
      throw new Error('User authentication required');
    }

    if (!userId) {
      console.error('❌ No user ID available');
      throw new Error('Please sign in to use email embedding features');
    }

    const startTime = Date.now();
    
    try {
      const response = await this.request<EmbedEmailsResponse>('/email-embedding', {
        method: 'POST',
        headers: {
          'x-user-id': userId,
        },
        body: JSON.stringify({}),
      });

      const duration = Date.now() - startTime;
      console.log(`✅ Email embedding completed in ${duration}ms:`, {
        totalEmails: response.data?.totalEmails || 0,
        successful: response.data?.successful || 0,
        failed: response.data?.failed || 0,
        success: response.success
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Email embedding failed after ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * Get embedding status for the current user
   */
  async getEmbeddingStatus(): Promise<EmbeddingStatusResponse> {
    console.log('🔍 Getting email embedding status...');
    
    // Get user ID for the request
    let userId: string | null = null;
    try {
      const { supabaseService } = await import('./supabase');
      const user = await supabaseService.getCurrentUser();
      userId = user?.id || null;
    } catch (userError) {
      console.error('❌ Failed to get user ID for status check:', userError);
      throw new Error('User authentication required');
    }

    if (!userId) {
      throw new Error('Please sign in to check embedding status');
    }

    try {
      const response = await this.request<EmbeddingStatusResponse>(`/email-embedding/status/${userId}`, {
        method: 'GET',
        headers: {
          'x-user-id': userId,
        },
      });

      console.log('✅ Embedding status retrieved:', {
        status: response.data?.status,
        totalEmbeddings: response.data?.totalEmbeddings,
        lastEmbedding: response.data?.lastEmbedding?.timestamp
      });

      return response;
    } catch (error) {
      console.error('❌ Failed to get embedding status:', error);
      throw error;
    }
  }

  /**
   * Health check for the email embedding service
   */
  async healthCheck(): Promise<{ status: string; message: string }> {
    try {
      return await this.request<{ status: string; message: string }>('/email-embedding/status', {
        method: 'GET',
      });
    } catch (error) {
      console.error('❌ Email embedding service health check failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const emailEmbeddingService = new EmailEmbeddingService(); 