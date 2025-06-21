import Supermemory from 'supermemory';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Supermemory client for email embedding and memory operations
 * Used to store and retrieve email content with semantic understanding
 */
export class SupermemoryClient {
  private static instance: SupermemoryClient;
  private client: Supermemory;
  private isConnected = false;

  private constructor() {
    if (!process.env.SUPERMEMORY_API_KEY) {
      throw new Error('SUPERMEMORY_API_KEY is required but not found in environment variables');
    }

    this.client = new Supermemory({
      apiKey: process.env.SUPERMEMORY_API_KEY,
    });
  }

  /**
   * Get singleton instance of SupermemoryClient
   */
  public static getInstance(): SupermemoryClient {
    if (!SupermemoryClient.instance) {
      SupermemoryClient.instance = new SupermemoryClient();
    }
    return SupermemoryClient.instance;
  }

  /**
   * Get the raw Supermemory client instance
   */
  public getClient(): Supermemory {
    return this.client;
  }

  /**
   * Test connection to Supermemory API
   * @returns Promise<boolean> - true if connection is successful
   */
  public async testConnection(): Promise<boolean> {
    try {
      // Test with a simple memory addition and then we can remove it
      const testResponse = await this.client.memories.add({
        content: 'Test connection from Voxe backend',
        containerTags: ['test_connection'],
        customId: `test_${Date.now()}`,
        metadata: {
          type: 'connection_test',
          timestamp: new Date().toISOString(),
          source: 'voxe_backend'
        }
      });

      this.isConnected = !!testResponse.id;
      
      if (this.isConnected) {
        console.log('✅ Supermemory connection successful');
        console.log(`Test memory created with ID: ${testResponse.id}`);
      }

      return this.isConnected;
    } catch (error) {
      console.error('❌ Supermemory connection failed:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Add a memory to Supermemory
   * @param content - The content to store
   * @param containerTags - Tags for grouping and filtering
   * @param customId - Optional custom identifier
   * @param metadata - Additional metadata
   */
  public async addMemory(
    content: string,
    containerTags: string[],
    customId?: string,
    metadata?: Record<string, string | number | boolean>
  ): Promise<{ id: string; status: string }> {
    try {
      const response = await this.client.memories.add({
        content,
        containerTags,
        ...(customId && { customId }),
        ...(metadata && { metadata })
      });

      return response;
    } catch (error) {
      console.error('Failed to add memory to Supermemory:', error);
      throw error;
    }
  }

  /**
   * Batch add multiple memories to Supermemory
   * Optimized for email embedding operations
   */
  public async batchAddMemories(
    memories: Array<{
      content: string;
      containerTags: string[];
      customId?: string;
      metadata?: Record<string, string | number | boolean>;
    }>
  ): Promise<{
    success: boolean;
    results: Array<{
      success: boolean;
      memoryId?: string;
      error?: string;
      customId?: string;
    }>;
    totalProcessed: number;
    successCount: number;
    failureCount: number;
  }> {
    const results: Array<{
      success: boolean;
      memoryId?: string;
      error?: string;
      customId?: string;
    }> = [];

    let successCount = 0;
    let failureCount = 0;

    console.log(`🚀 Starting batch memory addition: ${memories.length} memories`);

    // Process memories in batches to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < memories.length; i += batchSize) {
      const batch = memories.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (memory) => {
        try {
          const result = await this.addMemory(
            memory.content,
            memory.containerTags,
            memory.customId,
            memory.metadata
          );

          successCount++;
          return {
            success: true,
            memoryId: result.id,
            customId: memory.customId
          };
        } catch (error: any) {
          failureCount++;
          return {
            success: false,
            error: error.message || 'Unknown error',
            customId: memory.customId
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add small delay between batches to be respectful to the API
      if (i + batchSize < memories.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`✅ Batch operation completed: ${successCount} success, ${failureCount} failures`);

    return {
      success: failureCount === 0,
      results,
      totalProcessed: memories.length,
      successCount,
      failureCount
    };
  }

  /**
   * Check if client is connected
   */
  public isClientConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get API key status (masked for security)
   */
  public getApiKeyStatus(): string {
    const apiKey = process.env.SUPERMEMORY_API_KEY;
    if (!apiKey) return 'NOT_SET';
    return `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 8)}`;
  }

  /**
   * Search memories for Gmail trigger context enhancement
   * Optimized for finding email history from specific senders
   * @param userId - User ID for container filtering
   * @param senderEmail - Email address of the sender to search for
   * @param query - Optional search query (defaults to sender-based search)
   * @returns Promise<SearchResult> - Search results with email history
   */
  public async searchEmailHistory(
    userId: string,
    senderEmail: string,
    query?: string
  ): Promise<{
    success: boolean;
    results: Array<{
      documentId: string;
      content: string;
      score: number;
      metadata: Record<string, any>;
      title: string | null;
      summary: string | null;
      createdAt: string;
    }>;
    total: number;
    timing: number;
    error?: string;
  }> {
    // Use a simple, guaranteed valid search query
    // The container tags will handle the filtering by sender
    let searchQuery = "search relavant emails history of this user.";
    
    // Ensure query is valid and not empty
    if (query && query.trim().length > 0) {
      // Use provided query but keep it simple
      searchQuery = query.trim();
    }
    
    console.log(`🔍 Searching email history for user ${userId} from sender ${senderEmail}`);
    console.log(`📝 Search query: "${searchQuery}" (length: ${searchQuery.length})`);

    const searchParams = {
      q: searchQuery,
      containerTags: [`user_${userId}`, `sender_${senderEmail}`],
      limit: 5
      // Removed all optional parameters to simplify the request
    };

    console.log(`🎯 Search parameters:`, JSON.stringify(searchParams, null, 2));

    // Validate search parameters before sending
    if (!searchParams.q || searchParams.q.trim().length === 0) {
      console.error(`❌ Invalid search query: "${searchParams.q}"`);
      return {
        success: false,
        results: [],
        total: 0,
        timing: 0,
        error: 'Search query cannot be empty'
      };
    }

    try {
      const startTime = Date.now();
      
      const response = await this.client.search.execute(searchParams);
      const searchTime = Date.now() - startTime;

      console.log(`⚡ Search completed in ${searchTime}ms`);
      console.log(`📊 Found ${response.total} total results, returning ${response.results.length} results`);

      // Process and format results for LLM consumption
      const formattedResults = response.results.map(result => ({
        documentId: result.documentId,
        content: result.chunks.map(chunk => chunk.content).join('\n'),
        score: result.score,
        metadata: result.metadata || {},
        title: result.title,
        summary: result.summary || null,
        createdAt: result.createdAt
      }));

      return {
        success: true,
        results: formattedResults,
        total: response.total,
        timing: searchTime,
      };

    } catch (error: any) {
      console.error('❌ Failed to search email history:', error);
      
      // Enhanced error logging for debugging
      if (error.status === 500) {
        console.error(`🔥 Supermemory server error - API may be down or overloaded`);
        console.error(`🔍 Failed search parameters:`, JSON.stringify(searchParams, null, 2));
      } else if (error.status === 400) {
        console.error(`📋 Invalid search parameters:`, JSON.stringify(searchParams, null, 2));
        console.error(`🔍 Query validation - Length: ${searchParams.q.length}, Content: "${searchParams.q}"`);
      } else if (error.status === 401) {
        console.error(`🔑 Authentication failed - check API key`);
      }
      
      return {
        success: false,
        results: [],
        total: 0,
        timing: 0,
        error: `Supermemory API error (${error.status || 'unknown'}): ${error.message || 'Search failed'}`
      };
    }
  }

  /**
   * Advanced search with custom parameters
   * For more complex search scenarios beyond basic email history
   */
  public async searchMemories(
    searchParams: {
      q: string;
      containerTags?: string[];
      limit?: number;
      documentThreshold?: number;
      chunkThreshold?: number;
      rerank?: boolean;
      includeSummary?: boolean;
      includeFullDocs?: boolean;
      filters?: any;
    }
  ): Promise<{
    success: boolean;
    results: any[];
    total: number;
    timing: number;
    error?: string;
  }> {
    try {
      const startTime = Date.now();
      const response = await this.client.search.execute({
        limit: 10,
        documentThreshold: 0.3,
        chunkThreshold: 0.3,
        rerank: false,
        includeSummary: false,
        includeFullDocs: false,
        ...searchParams
      });
      const searchTime = Date.now() - startTime;

      return {
        success: true,
        results: response.results,
        total: response.total,
        timing: searchTime
      };

    } catch (error: any) {
      console.error('❌ Failed to search memories:', error);
      return {
        success: false,
        results: [],
        total: 0,
        timing: 0,
        error: error.message || 'Unknown search error'
      };
    }
  }
}

// Export singleton instance
export const supermemoryClient = SupermemoryClient.getInstance();

// Export default for convenience
export default supermemoryClient; 