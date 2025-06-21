import { SupermemoryClient } from '../lib/supermemory.js';
import { mem0Service } from '../lib/mem0/mem0Service.js';

interface CacheEntry {
  data: any;
  timestamp: number;
  expiresAt: number;
}

interface PerformanceMetrics {
  totalTime: number;
  supermemoryTime: number;
  mem0Time: number;
  cacheHit: boolean;
  emailsFound: number;
  memoriesFound: number;
}

/**
 * Email Context Service for Gmail Trigger Enhancement
 * Provides intelligent email history context by searching Supermemory
 * and combining results with Mem0 memories for comprehensive LLM context
 * 
 * Features:
 * - Performance optimization with caching
 * - Timeout handling for API calls
 * - Comprehensive error handling
 * - Performance metrics tracking
 */
export class EmailContextService {
  private supermemoryClient: SupermemoryClient;
  private mem0Service: any;
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly SEARCH_TIMEOUT_MS = 5000; // 5 seconds
  private readonly MEM0_TIMEOUT_MS = 3000; // 3 seconds

  constructor() {
    this.supermemoryClient = SupermemoryClient.getInstance();
    this.mem0Service = mem0Service;
    
    // Clean up expired cache entries every 10 minutes
    setInterval(() => this.cleanupCache(), 10 * 60 * 1000);
  }

  /**
   * Get enhanced context for Gmail triggers
   * Searches for email history from the sender and combines with Mem0 memories
   * @param userId - User ID for filtering
   * @param senderEmail - Email address of the sender
   * @param triggerPayload - The trigger payload containing email data
   * @returns Enhanced context for LLM agent
   */
  public async getGmailTriggerContext(
    userId: string,
    senderEmail: string,
    triggerPayload: any
  ): Promise<{
    success: boolean;
    enhancedContext: {
      emailHistory: any[];
      mem0Memories: any[];
      contextSummary: string;
      totalHistoryFound: number;
      searchTiming: number;
      performanceMetrics: PerformanceMetrics;
    };
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      console.log(`📧 Getting Gmail trigger context for user ${userId} from sender ${senderEmail}`);

      // Check cache first
      const cacheKey = `${userId}:${senderEmail}`;
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        console.log(`⚡ Cache hit for ${cacheKey}`);
        return {
          success: true,
          enhancedContext: {
            ...cached,
            performanceMetrics: {
              ...cached.performanceMetrics,
              cacheHit: true
            }
          }
        };
      }

      // Execute searches in parallel with timeout protection
      const supermemoryStart = Date.now();
      const mem0Start = Date.now();

      // Re-enabled Mem0 with the fix for 400 errors
      const searchPromises = [
        this.withTimeout(
          this.searchEmailHistory(userId, senderEmail),
          this.SEARCH_TIMEOUT_MS,
          'Supermemory search timeout'
        ),
        this.withTimeout(
          this.getMem0Memories(userId),
          this.MEM0_TIMEOUT_MS,
          'Mem0 retrieval timeout'
        )
      ];

      const [supermemoryResults, mem0Results] = await Promise.allSettled(searchPromises);

      // Process Supermemory results
      let emailHistory: any[] = [];
      let searchTiming = 0;
      let totalHistoryFound = 0;
      const supermemoryTime = Date.now() - supermemoryStart;

      if (supermemoryResults.status === 'fulfilled') {
        const result = supermemoryResults.value;
        // Check if it's the actual search result (not empty array)
        if (result && typeof result === 'object' && 'success' in result) {
          if (result.success) {
            emailHistory = result.results;
            searchTiming = result.timing;
            totalHistoryFound = result.total;
            console.log(`✅ Supermemory search successful: ${emailHistory.length} emails found in ${supermemoryTime}ms`);
          } else {
            console.warn(`⚠️ Supermemory search failed:`, result.error);
          }
        }
      } else {
        console.warn(`⚠️ Supermemory search failed:`, supermemoryResults.reason);
      }

      // Process Mem0 results (re-enabled)
      let mem0Memories: any[] = [];
      const mem0Time = Date.now() - mem0Start;
      
      if (mem0Results.status === 'fulfilled') {
        const result = mem0Results.value;
        // Mem0 returns an array directly, not a result object
        if (Array.isArray(result)) {
          mem0Memories = result;
        } else {
          mem0Memories = [];
        }
        console.log(`✅ Mem0 memories retrieved: ${mem0Memories.length} memories in ${mem0Time}ms`);
      } else {
        console.warn(`⚠️ Mem0 retrieval failed:`, mem0Results.reason);
        mem0Memories = []; // Graceful fallback to empty array
      }

      // Generate context summary
      const contextSummary = this.generateContextSummary(
        emailHistory,
        mem0Memories,
        senderEmail,
        totalHistoryFound
      );

      const enhancedContext = {
        emailHistory,
        mem0Memories,
        contextSummary,
        totalHistoryFound,
        searchTiming
      };

      // Cache the result for future requests
      this.setCachedResult(cacheKey, enhancedContext);

      const totalTime = Date.now() - startTime;
      const performanceMetrics: PerformanceMetrics = {
        totalTime,
        supermemoryTime,
        mem0Time,
        cacheHit: false,
        emailsFound: emailHistory.length,
        memoriesFound: mem0Memories.length
      };

      console.log(`🎯 Enhanced context prepared: ${emailHistory.length} emails, ${mem0Memories.length} memories in ${totalTime}ms`);
      console.log(`📊 Performance: Supermemory ${supermemoryTime}ms, Mem0 ${mem0Time}ms`);

      return {
        success: true,
        enhancedContext: {
          ...enhancedContext,
          performanceMetrics
        }
      };

    } catch (error: any) {
      const totalTime = Date.now() - startTime;
      console.error('❌ Failed to get Gmail trigger context:', error);
      
      return {
        success: false,
        enhancedContext: {
          emailHistory: [],
          mem0Memories: [],
          contextSummary: 'Context enhancement failed',
          totalHistoryFound: 0,
          searchTiming: 0,
          performanceMetrics: {
            totalTime,
            supermemoryTime: 0,
            mem0Time: 0,
            cacheHit: false,
            emailsFound: 0,
            memoriesFound: 0
          }
        },
        error: error.message
      };
    }
  }

  /**
   * Search email history using Supermemory
   * @private
   */
  private async searchEmailHistory(userId: string, senderEmail: string) {
    return await this.supermemoryClient.searchEmailHistory(userId, senderEmail);
  }

  /**
   * Get Mem0 memories for the user
   * @private
   */
  private async getMem0Memories(userId: string): Promise<any[]> {
    try {
      // Use existing Mem0 service to get user memories
      const context = { user_id: userId };
      const memories = await this.mem0Service.getAllMemories(context);
      return memories || [];
    } catch (error) {
      console.error('Failed to get Mem0 memories:', error);
      return [];
    }
  }

  /**
   * Generate a contextual summary for the LLM agent
   * @private
   */
  private generateContextSummary(
    emailHistory: any[],
    mem0Memories: any[],
    senderEmail: string,
    totalFound: number
  ): string {
    const parts: string[] = [];

    // Email history summary
    if (emailHistory.length > 0) {
      parts.push(`📧 EMAIL HISTORY: Found ${emailHistory.length} recent emails from ${senderEmail} (${totalFound} total in history).`);
      
      // Add brief summary of recent emails
      const recentSubjects = emailHistory
        .slice(0, 3)
        .map(email => email.title || 'No subject')
        .filter(Boolean);
      
      if (recentSubjects.length > 0) {
        parts.push(`Recent email subjects: ${recentSubjects.join(', ')}`);
      }
    } else {
      parts.push(`📧 EMAIL HISTORY: No previous emails found from ${senderEmail}.`);
    }

    // Mem0 memories summary
    if (mem0Memories.length > 0) {
      parts.push(`🧠 USER MEMORIES: ${mem0Memories.length} relevant memories available for context.`);
    } else {
      parts.push(`🧠 USER MEMORIES: No specific memories found.`);
    }

    // Context guidance
    parts.push(`💡 CONTEXT GUIDANCE: Use email history to understand conversation patterns, previous interactions, and relationship context with ${senderEmail}. Consider user memories for personalized responses.`);

    return parts.join(' ');
  }

  /**
   * Format enhanced context for LLM consumption
   * Creates a structured context that the agent can easily understand
   */
  public formatContextForAgent(enhancedContext: any): string {
    const sections: string[] = [];

    // Add context summary at the top
    sections.push(`## EMAIL CONTEXT ENHANCEMENT`);
    sections.push(enhancedContext.contextSummary);
    sections.push('');

    // Add email history if available
    if (enhancedContext.emailHistory.length > 0) {
      sections.push(`## RELEVANT EMAIL HISTORY (${enhancedContext.emailHistory.length} emails)`);
      
      enhancedContext.emailHistory.forEach((email: any, index: number) => {
        sections.push(`### Email ${index + 1} (Score: ${email.score.toFixed(2)})`);
        sections.push(`**Subject:** ${email.title || 'No subject'}`);
        sections.push(`**Date:** ${email.createdAt}`);
        if (email.summary) {
          sections.push(`**Summary:** ${email.summary}`);
        }
        sections.push(`**Content Preview:** ${email.content.substring(0, 200)}...`);
        sections.push('');
      });
    }

    // Add Mem0 memories if available
    if (enhancedContext.mem0Memories.length > 0) {
      sections.push(`## USER MEMORIES (${enhancedContext.mem0Memories.length} memories)`);
      enhancedContext.mem0Memories.forEach((memory: any, index: number) => {
        sections.push(`**Memory ${index + 1}:** ${JSON.stringify(memory)}`);
      });
      sections.push('');
    }

    sections.push(`## PERFORMANCE METRICS`);
    sections.push(`- Search completed in ${enhancedContext.searchTiming}ms`);
    sections.push(`- Total emails in history: ${enhancedContext.totalHistoryFound}`);

    return sections.join('\n');
  }

  /**
   * Check if this is a Gmail trigger
   * @param triggerData - The trigger data to check
   * @returns boolean indicating if this is a Gmail trigger
   */
  public isGmailTrigger(triggerData: any): boolean {
    // Check various ways to identify Gmail triggers
    const appName = triggerData?.appName?.toLowerCase();
    const triggerName = triggerData?.triggerName?.toLowerCase();
    const source = triggerData?.source?.toLowerCase();

    return (
      appName === 'gmail' ||
      triggerName?.includes('gmail') ||
      source === 'gmail' ||
      triggerData?.app === 'gmail'
    );
  }

  /**
   * Extract sender email from trigger payload
   * @param triggerPayload - The Gmail trigger payload
   * @returns string - The sender email address
   */
  public extractSenderEmail(triggerPayload: any): string | null {
    try {
      // Try different possible locations for sender email in Gmail trigger payload
      const possiblePaths = [
        triggerPayload?.from,
        triggerPayload?.sender,
        triggerPayload?.message?.from,
        triggerPayload?.email?.from,
        triggerPayload?.data?.from,
        triggerPayload?.payload?.headers?.find((h: any) => h.name === 'From')?.value
      ];

      for (const path of possiblePaths) {
        if (path && typeof path === 'string') {
          // Extract email from "Name <email@domain.com>" format
          const emailMatch = path.match(/<([^>]+)>/);
          if (emailMatch) {
            return emailMatch[1];
          }
          
          // Check if it's already just an email
          if (path.includes('@')) {
            return path.trim();
          }
        }
      }

      console.warn('Could not extract sender email from trigger payload');
      return null;
    } catch (error) {
      console.error('Error extracting sender email:', error);
      return null;
    }
  }

  /**
   * Cache management methods for performance optimization
   */
  private getCachedResult(cacheKey: string): any | null {
    const entry = this.cache.get(cacheKey);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(cacheKey);
      return null;
    }

    return entry.data;
  }

  private setCachedResult(cacheKey: string, data: any): void {
    const now = Date.now();
    this.cache.set(cacheKey, {
      data,
      timestamp: now,
      expiresAt: now + this.CACHE_TTL_MS
    });
  }

  private cleanupCache(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  /**
   * Timeout wrapper for API calls
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Get performance and cache statistics
   */
  public getPerformanceStats(): {
    cacheSize: number;
    cacheHitRate: number;
    averageResponseTime: number;
    uptime: number;
  } {
    // Basic stats - could be enhanced with more detailed metrics
    return {
      cacheSize: this.cache.size,
      cacheHitRate: 0, // Would need to track hits/misses
      averageResponseTime: 0, // Would need to track response times
      uptime: process.uptime()
    };
  }

  /**
   * Clear cache manually (useful for testing)
   */
  public clearCache(): void {
    this.cache.clear();
    console.log('🧹 Cache cleared manually');
  }
} 