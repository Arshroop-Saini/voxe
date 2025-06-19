/**
 * Unified Memory Service
 * Provides seamless memory operations for both voice and chat modes
 * Handles context switching and cross-mode preference learning
 */

// Note: Memory API endpoints will be implemented in backend
// For now, using placeholder implementation that can be connected later

export interface MemoryContext {
  userId: string;
  mode: 'voice' | 'chat';
  threadId?: string;
  sessionId?: string;
}

export interface Memory {
  id: string;
  content: string;
  context: string;
  relevance: number;
  createdAt: string;
  mode: 'voice' | 'chat';
  metadata?: Record<string, any>;
}

export interface MemoryPreferences {
  preferredTools: string[];
  communicationStyle: 'formal' | 'casual' | 'technical';
  responseLength: 'brief' | 'detailed' | 'comprehensive';
  voicePreferences: {
    speed: number;
    confirmations: boolean;
  };
  chatPreferences: {
    showToolDetails: boolean;
    autoScroll: boolean;
  };
}

class MemoryService {
  private currentContext: MemoryContext | null = null;
  private memoryCache: Map<string, Memory[]> = new Map();
  private preferencesCache: Map<string, MemoryPreferences> = new Map();

  /**
   * Set the current memory context for operations
   */
  setContext(context: MemoryContext): void {
    this.currentContext = context;
    console.log('Memory context set:', context);
  }

  /**
   * Get the current memory context
   */
  getContext(): MemoryContext | null {
    return this.currentContext;
  }

  /**
   * Switch between voice and chat modes while maintaining context
   */
  async switchMode(newMode: 'voice' | 'chat', threadId?: string): Promise<void> {
    if (!this.currentContext) {
      throw new Error('No memory context set');
    }

    const previousMode = this.currentContext.mode;
    
    // Update context
    this.currentContext = {
      ...this.currentContext,
      mode: newMode,
      threadId: threadId || this.currentContext.threadId,
    };

    // Log mode switch for learning
    await this.logModeSwitch(previousMode, newMode);
    
    console.log(`Memory mode switched from ${previousMode} to ${newMode}`);
  }

  /**
   * Retrieve relevant memories for current context
   */
  async getRelevantMemories(query: string, limit: number = 5): Promise<Memory[]> {
    if (!this.currentContext) {
      throw new Error('No memory context set');
    }

    const cacheKey = `${this.currentContext.userId}-${query}`;
    
    // Check cache first
    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey)!.slice(0, limit);
    }

    try {
      // TODO: Implement actual API call when backend memory endpoints are ready
      // For now, return empty array as placeholder
      console.log('Memory retrieval requested:', { query, limit, context: this.currentContext });
      return [];
    } catch (error) {
      console.error('Error retrieving memories:', error);
      return [];
    }
  }

  /**
   * Add new memory from interaction
   */
  async addMemory(content: string, metadata?: Record<string, any>): Promise<void> {
    if (!this.currentContext) {
      throw new Error('No memory context set');
    }

    try {
      const memory = {
        content,
        context: this.generateContextString(),
        mode: this.currentContext.mode,
        metadata: {
          ...metadata,
          threadId: this.currentContext.threadId,
          sessionId: this.currentContext.sessionId,
        },
      };

      // TODO: Implement actual API call when backend memory endpoints are ready
      console.log('Memory add requested:', { memory });

      // Clear relevant cache entries
      this.clearMemoryCache(this.currentContext.userId);
      
      console.log('Memory added:', content.substring(0, 50) + '...');
    } catch (error) {
      console.error('Error adding memory:', error);
    }
  }

  /**
   * Learn from user interaction patterns
   */
  async learnFromInteraction(interaction: {
    input: string;
    output: string;
    toolsUsed: string[];
    satisfaction?: number;
    duration?: number;
  }): Promise<void> {
    if (!this.currentContext) {
      throw new Error('No memory context set');
    }

    try {
      // TODO: Implement actual API call when backend memory endpoints are ready
      console.log('Learning from interaction requested:', { 
        interaction: { ...interaction, mode: this.currentContext.mode }
      });

      // Update preferences based on learning
      await this.updatePreferences(interaction);
      
      console.log('Learning from interaction:', interaction.toolsUsed);
    } catch (error) {
      console.error('Error learning from interaction:', error);
    }
  }

  /**
   * Get user preferences for current mode
   */
  async getPreferences(): Promise<MemoryPreferences | null> {
    if (!this.currentContext) {
      return null;
    }

    const cacheKey = this.currentContext.userId;
    
    // Check cache first
    if (this.preferencesCache.has(cacheKey)) {
      return this.preferencesCache.get(cacheKey)!;
    }

    try {
      // TODO: Implement actual API call when backend memory endpoints are ready
      console.log('Preferences retrieval requested for user:', this.currentContext.userId);
      
      // Return default preferences as placeholder
      const defaultPreferences: MemoryPreferences = {
        preferredTools: [],
        communicationStyle: 'casual',
        responseLength: 'detailed',
        voicePreferences: {
          speed: 1.0,
          confirmations: true,
        },
        chatPreferences: {
          showToolDetails: true,
          autoScroll: true,
        },
      };
      
      this.preferencesCache.set(cacheKey, defaultPreferences);
      return defaultPreferences;
    } catch (error) {
      console.error('Error getting preferences:', error);
      return null;
    }
  }

  /**
   * Get memory-enhanced suggestions for current context
   */
  async getSuggestions(currentInput?: string): Promise<string[]> {
    if (!this.currentContext) {
      return [];
    }

    try {
      // TODO: Implement actual API call when backend memory endpoints are ready
      console.log('Suggestions requested:', { context: this.currentContext, currentInput });
      
      // Return placeholder suggestions based on context
      const suggestions = this.currentContext.mode === 'voice' 
        ? ['Check my Gmail', 'Create a meeting', 'What can you do?']
        : ['Send an email', 'Schedule appointment', 'Create document'];
      
      return suggestions;
    } catch (error) {
      console.error('Error getting suggestions:', error);
      return [];
    }
  }

  /**
   * Get cross-mode conversation history
   */
  async getUnifiedHistory(limit: number = 20): Promise<any[]> {
    if (!this.currentContext) {
      return [];
    }

    try {
      // TODO: Implement actual API call when backend memory endpoints are ready
      console.log('Unified history requested:', { userId: this.currentContext.userId, limit });
      
      // Return placeholder history
      return [];
    } catch (error) {
      console.error('Error getting unified history:', error);
      return [];
    }
  }

  /**
   * Clear memory cache for user
   */
  private clearMemoryCache(userId: string): void {
    const keysToDelete = Array.from(this.memoryCache.keys()).filter(key => 
      key.startsWith(userId)
    );
    keysToDelete.forEach(key => this.memoryCache.delete(key));
  }

  /**
   * Generate context string for current state
   */
  private generateContextString(): string {
    if (!this.currentContext) {
      return '';
    }

    const parts = [
      `mode:${this.currentContext.mode}`,
      this.currentContext.threadId ? `thread:${this.currentContext.threadId}` : '',
      this.currentContext.sessionId ? `session:${this.currentContext.sessionId}` : '',
    ].filter(Boolean);

    return parts.join('|');
  }

  /**
   * Log mode switch for learning patterns
   */
  private async logModeSwitch(from: string, to: string): Promise<void> {
    try {
      // TODO: Implement actual API call when backend memory endpoints are ready
      console.log('Mode switch logged:', {
        userId: this.currentContext?.userId,
        from,
        to,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error logging mode switch:', error);
    }
  }

  /**
   * Update user preferences based on interaction
   */
  private async updatePreferences(interaction: any): Promise<void> {
    if (!this.currentContext) {
      return;
    }

    // Clear preferences cache to force refresh
    this.preferencesCache.delete(this.currentContext.userId);

    // Update preferences based on interaction patterns
    const preferences = await this.getPreferences();
    if (preferences && interaction.toolsUsed.length > 0) {
      // Learn preferred tools
      interaction.toolsUsed.forEach((tool: string) => {
        if (!preferences.preferredTools.includes(tool)) {
          preferences.preferredTools.push(tool);
        }
      });

      // Update cache
      this.preferencesCache.set(this.currentContext.userId, preferences);
    }
  }

  /**
   * Reset memory service state
   */
  reset(): void {
    this.currentContext = null;
    this.memoryCache.clear();
    this.preferencesCache.clear();
    console.log('Memory service reset');
  }
}

// Export singleton instance
export const memoryService = new MemoryService();
export default memoryService; 