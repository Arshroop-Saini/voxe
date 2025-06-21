import { createMem0, addMemories, retrieveMemories, getMemories } from '@mem0/vercel-ai-provider';

/**
 * Mem0 Service for Voxe - Following User's Specified 3-Step Pattern
 * 
 * Step 1: Initialize with createMem0()
 * Step 2: Use addMemories() after each interaction
 * Step 3: Use retrieveMemories() + OpenAI provider for context
 */

// Types for Mem0 operations
export interface MemoryContext {
  user_id: string;
  app_id?: string;
  agent_id?: string;
  run_id?: string;
}

class Mem0Service {
  private mem0Instance: any;
  private isInitialized: boolean = false;

  constructor() {
    this.initializeMem0();
  }

  /**
   * STEP 1: Initialize Mem0 with createMem0() - Following user's exact pattern
   */
  private initializeMem0(): void {
    try {
      if (!process.env.MEM0_API_KEY) {
        throw new Error('MEM0_API_KEY environment variable is required');
      }

      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY environment variable is required');
      }

      // Initialize using user's exact pattern
      this.mem0Instance = createMem0({
        provider: "openai",
        mem0ApiKey: process.env.MEM0_API_KEY,
        apiKey: process.env.OPENAI_API_KEY,
        config: {
          compatibility: "strict",
          // Additional model-specific configuration options can be added here.
        },
      });

      this.isInitialized = true;
      console.log('✅ Mem0 service initialized with user-specified pattern');
    } catch (error) {
      console.error('❌ Failed to initialize Mem0 service:', error);
      throw error;
    }
  }

  /**
   * STEP 2: Add memories after each interaction using addMemories()
   * This method will be called after each chat/voice interaction
   * 
   * @param messages - Array of conversation messages in AI SDK format
   * @param context - Memory context with user_id and optional metadata
   */
  async addMemoriesAfterInteraction(
    messages: any[], // LanguageModelV1Prompt format
    context: MemoryContext
  ): Promise<void> {
    try {
      console.log(`🧠 Adding memories after interaction for user: ${context.user_id}`);
      
      // Use the standalone addMemories function as specified by user
      await addMemories(messages, { user_id: context.user_id });

      console.log(`✅ Successfully added memories for user: ${context.user_id}`);
    } catch (error) {
      console.error('❌ Error adding memories:', error);
      // Don't throw - memory failures shouldn't break the app
    }
  }

  /**
   * STEP 3: Retrieve memories for context using retrieveMemories()
   * This is the custom approach specified by the user
   * 
   * @param prompt - The current prompt/input
   * @param context - Memory context with user_id
   * @returns Formatted memory string for system prompt
   */
  async getMemoryContext(
    prompt: string,
    context: MemoryContext
  ): Promise<string> {
    try {
      console.log(`🔍 Retrieving memory context for user: ${context.user_id}`);
      
      // Use the standalone retrieveMemories function as specified by user
      const memories = await retrieveMemories(prompt, { user_id: context.user_id });

      console.log(`✅ Retrieved memory context for user: ${context.user_id}`);
      return memories;
    } catch (error) {
      console.error('❌ Error retrieving memories:', error);
      // Return empty string on error - don't break the conversation
      return "";
    }
  }

  /**
   * Get all memories for a user using standalone function
   * 
   * @param context - Memory context with user_id
   * @returns Promise with all user memories
   */
  async getAllMemories(context: MemoryContext): Promise<any> {
    try {
      console.log(`📚 Getting all memories for user: ${context.user_id}`);
      
      // Use standalone getMemories function with a proper query
      // Changed from empty string to a general query that should work
      const result = await getMemories('memories', {
        user_id: context.user_id,
        mem0ApiKey: process.env.MEM0_API_KEY,
      });

      console.log(`✅ Retrieved all memories for user: ${context.user_id}`);
      return result;
    } catch (error) {
      console.error('❌ Error getting memories:', error);
      return [];  // Return empty array instead of null for consistency
    }
  }

  /**
   * Create memory context for voice interactions
   * 
   * @param userId - User ID
   * @param runId - Optional run ID for tracking
   * @returns Memory context for voice operations
   */
  createVoiceContext(userId: string, runId?: string): MemoryContext {
    return {
      user_id: userId,
      app_id: 'voxe-voice',
      agent_id: 'voxe-voice-assistant',
      run_id: runId || `voice-${Date.now()}`,
    };
  }

  /**
   * Create memory context for chat interactions
   * 
   * @param userId - User ID
   * @param threadId - Chat thread ID
   * @returns Memory context for chat operations
   */
  createChatContext(userId: string, threadId?: string): MemoryContext {
    return {
      user_id: userId,
      app_id: 'voxe-chat',
      agent_id: 'voxe-chat-assistant',
      run_id: threadId || `chat-${Date.now()}`,
    };
  }

  /**
   * Health check for the service
   */
  async healthCheck(): Promise<{ status: string; initialized: boolean; timestamp: string }> {
    return {
      status: this.isInitialized ? 'healthy' : 'error',
      initialized: this.isInitialized,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Check if the service is properly initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export const mem0Service = new Mem0Service();
export default mem0Service; 