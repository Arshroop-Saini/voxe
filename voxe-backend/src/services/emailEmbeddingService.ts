import { VercelAIToolSet } from 'composio-core';
import { supermemoryClient } from '../lib/supermemory.js';
import {
  RawGmailEmail,
  ProcessedEmail,
  EmailEmbeddingResult,
  BatchEmbeddingResult,
  EmailFetchParams,
  EmailContainerTags,
  EmailMetadata,
  EmailProcessingConfig,
  EmailContentExtraction,
  EmailProcessingError,
  EmailProcessingErrorDetails,
  DEFAULT_EMAIL_CONFIG
} from '../types/email.js';

/**
 * EmailEmbeddingService - Handles email fetching and Supermemory embedding
 * Integrates with Composio for Gmail access and Supermemory for semantic storage
 */
export class EmailEmbeddingService {
  private composioToolset: VercelAIToolSet;
  private config: EmailProcessingConfig;

  constructor(config: Partial<EmailProcessingConfig> = {}) {
    this.composioToolset = new VercelAIToolSet();
    this.config = { ...DEFAULT_EMAIL_CONFIG, ...config };
  }

  /**
   * Main method: Embed today's primary inbox emails for a user
   */
  async embedDailyEmails(userId: string): Promise<BatchEmbeddingResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔄 Starting daily email embedding for user: ${userId}`);
      
      // Fetch today's emails from primary inbox
      const emails = await this.fetchTodayEmails(userId);
      console.log(`📧 Found ${emails.length} emails to process`);

      if (emails.length === 0) {
        return {
          totalEmails: 0,
          successful: 0,
          failed: 0,
          results: [],
          timestamp: new Date().toISOString(),
          processingTimeMs: Date.now() - startTime,
          errors: []
        };
      }

      // Process emails in batches
      const batchResults = await this.processBatches(emails, userId);
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ Email embedding completed in ${processingTime}ms`);
      
      return {
        totalEmails: emails.length,
        successful: batchResults.filter(r => r.status === 'success').length,
        failed: batchResults.filter(r => r.status === 'failed').length,
        results: batchResults,
        timestamp: new Date().toISOString(),
        processingTimeMs: processingTime,
        errors: batchResults.filter(r => r.error).map(r => r.error!).filter(Boolean)
      };

    } catch (error: any) {
      console.error('❌ Daily email embedding failed:', error);
      throw this.createProcessingError(
        EmailProcessingError.GMAIL_API_ERROR,
        `Failed to embed daily emails: ${error.message}`,
        false
      );
    }
  }

  /**
   * Fetch today's emails from Gmail primary inbox
   */
  private async fetchTodayEmails(userId: string): Promise<ProcessedEmail[]> {
    try {
      // Calculate date range for today and yesterday
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      console.log(`📅 Fetching emails from yesterday and today: ${yesterdayStr} to ${todayStr}`);
      console.log(`🔍 Testing broader search: in:inbox after:${yesterdayStr} (limit: 5 emails)`);

      // Use Composio to fetch emails from Gmail - any inbox emails, not just primary
      const response = await this.composioToolset.executeAction({
        action: 'GMAIL_FETCH_EMAILS',
        params: {
          query: `in:inbox after:${yesterdayStr}`,
          max_results: 5,
          include_spam_trash: false,
          include_payload: true,
          user_id: "me"
        },
        entityId: userId
      });

      console.log(`🔍 Gmail API Response:`, {
        successful: response.successful,
        hasData: !!response.data,
        hasMessages: !!response.data?.messages,
        messageCount: Array.isArray(response.data?.messages) ? response.data.messages.length : 0
      });

      if (!response.successful || !response.data?.messages) {
        console.log('📭 No emails found for yesterday/today in any inbox category');
        
        // Let's also try without date restriction to see if there are ANY emails
        console.log('🔍 Testing fallback: checking for any recent emails...');
        const fallbackResponse = await this.composioToolset.executeAction({
          action: 'GMAIL_FETCH_EMAILS',
          params: {
            query: `in:inbox`,
            max_results: 3,
            include_spam_trash: false,
            include_payload: true,
            user_id: "me"
          },
          entityId: userId
        });
        
        console.log(`🔍 Fallback search result:`, {
          successful: fallbackResponse.successful,
          messageCount: Array.isArray(fallbackResponse.data?.messages) ? fallbackResponse.data.messages.length : 0
        });
        
        return [];
      }

      const rawEmails = response.data.messages as RawGmailEmail[];
      console.log(`📬 Processing ${rawEmails.length} raw emails from yesterday/today (max 5)`);

      // Log all emails for debugging
      if (rawEmails.length > 0) {
        rawEmails.forEach((email, index) => {
          console.log(`🔍 Email ${index + 1}:`, {
            id: email.id,
            snippet: email.snippet?.substring(0, 80) + '...',
            labelIds: email.labelIds,
            internalDate: email.internalDate
          });
        });
      }

      // Process each email
      const processedEmails: ProcessedEmail[] = [];
      
      for (const rawEmail of rawEmails) {
        try {
          const processed = await this.extractEmailContent(rawEmail);
          console.log(`✅ Processed email: "${processed.subject}" from ${processed.senderEmail}`);
          processedEmails.push(processed);
        } catch (error) {
          console.error(`⚠️ Failed to process email ${rawEmail.id}:`, error);
          // Continue with other emails
        }
      }

      return processedEmails;

    } catch (error: any) {
      console.error('❌ Failed to fetch emails from Gmail:', error);
      throw this.createProcessingError(
        EmailProcessingError.GMAIL_API_ERROR,
        `Gmail API error: ${error.message}`,
        true
      );
    }
  }

  /**
   * Extract and process email content from raw Gmail data
   */
  private async extractEmailContent(rawEmail: RawGmailEmail): Promise<ProcessedEmail> {
    try {
      const headers = rawEmail.payload.headers;
      
      // Extract header information
      const subject = this.getHeaderValue(headers, 'Subject') || 'No Subject';
      const fromHeader = this.getHeaderValue(headers, 'From') || 'Unknown Sender';
      const senderEmail = this.extractEmailFromHeader(fromHeader);
      const senderDomain = this.extractDomainFromEmail(senderEmail);
      
      // Extract email content
      const contentExtraction = this.extractEmailBody(rawEmail.payload);
      
      // Determine email characteristics
      const hasAttachments = this.hasEmailAttachments(rawEmail.payload);
      const isImportant = rawEmail.labelIds?.includes('IMPORTANT') || false;
      const labels = rawEmail.labelIds || [];

      // Parse received date safely
      let receivedDate: string;
      try {
        const timestamp = parseInt(rawEmail.internalDate);
        if (isNaN(timestamp) || timestamp <= 0) {
          console.warn(`⚠️ Invalid timestamp for email ${rawEmail.id}: ${rawEmail.internalDate}`);
          receivedDate = new Date().toISOString(); // fallback to current time
        } else {
          receivedDate = new Date(timestamp).toISOString();
        }
      } catch (dateError) {
        console.warn(`⚠️ Date parsing failed for email ${rawEmail.id}:`, dateError);
        receivedDate = new Date().toISOString(); // fallback to current time
      }

      return {
        id: rawEmail.id,
        subject,
        sender: fromHeader,
        senderEmail,
        senderDomain,
        content: contentExtraction.plainText,
        receivedDate,
        threadId: rawEmail.threadId,
        hasAttachments,
        isImportant,
        labels,
        snippet: rawEmail.snippet || contentExtraction.plainText.substring(0, 150)
      };

    } catch (error: any) {
      console.error(`❌ Failed to extract email content for ${rawEmail.id}:`, error);
      throw this.createProcessingError(
        EmailProcessingError.CONTENT_EXTRACTION_FAILED,
        `Failed to extract email content: ${error.message}`,
        false,
        rawEmail.id
      );
    }
  }

  /**
   * Process emails in batches with rate limiting
   */
  private async processBatches(emails: ProcessedEmail[], userId: string): Promise<EmailEmbeddingResult[]> {
    const results: EmailEmbeddingResult[] = [];
    
    for (let i = 0; i < emails.length; i += this.config.batchSize) {
      const batch = emails.slice(i, i + this.config.batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i / this.config.batchSize) + 1}/${Math.ceil(emails.length / this.config.batchSize)}`);
      
      // Process batch in parallel
      const batchPromises = batch.map(email => this.embedSingleEmail(email, userId));
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Collect results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            emailId: batch[index].id,
            memoryId: '',
            status: 'failed',
            error: result.reason?.message || 'Unknown error',
            timestamp: new Date().toISOString()
          });
        }
      });

      // Rate limiting delay between batches
      if (this.config.enableRateLimiting && i + this.config.batchSize < emails.length) {
        await this.delay(this.config.rateLimitDelayMs);
      }
    }

    return results;
  }

  /**
   * Embed a single email into Supermemory
   */
  private async embedSingleEmail(email: ProcessedEmail, userId: string): Promise<EmailEmbeddingResult> {
    try {
      // Format email content for embedding
      const emailContent = this.formatEmailForEmbedding(email);
      
      // Generate container tags
      const containerTags = this.generateContainerTags(email, userId);
      
      // Generate metadata
      const metadata = this.generateEmailMetadata(email);
      
      // Add to Supermemory
      const response = await supermemoryClient.addMemory(
        emailContent,
        containerTags,
        `email_${email.id}`,
        metadata as unknown as Record<string, string | number | boolean>
      );

      console.log(`✅ Embedded email ${email.id} → Memory ${response.id}`);
      
      return {
        emailId: email.id,
        memoryId: response.id,
        status: 'success',
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      console.error(`❌ Failed to embed email ${email.id}:`, error);
      
      return {
        emailId: email.id,
        memoryId: '',
        status: 'failed',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Format email content for optimal embedding
   */
  private formatEmailForEmbedding(email: ProcessedEmail): string {
    return `
Subject: ${email.subject}
From: ${email.sender}
Date: ${email.receivedDate}
Thread: ${email.threadId}
${email.hasAttachments ? 'Has Attachments: Yes' : ''}
${email.isImportant ? 'Important: Yes' : ''}

${email.content}
    `.trim();
  }

  /**
   * Generate container tags for email organization
   */
  private generateContainerTags(email: ProcessedEmail, userId: string): string[] {
    return [
      `user_${userId}`,
      `sender_${email.senderEmail}`, // Use full email address instead of domain
      'email_primary_inbox',
      ...(email.isImportant ? ['email_important'] : []),
      ...(email.hasAttachments ? ['email_attachments'] : [])
    ];
  }

  /**
   * Generate metadata for Supermemory storage
   */
  private generateEmailMetadata(email: ProcessedEmail): EmailMetadata {
    return {
      source: 'gmail',
      type: 'email',
      sender: email.senderEmail,
      senderDomain: email.senderDomain,
      subject: email.subject,
      receivedDate: email.receivedDate.split('T')[0], // YYYY-MM-DD
      threadId: email.threadId,
      hasAttachments: email.hasAttachments,
      isImportant: email.isImportant,
      labelCount: email.labels.length,
      contentLength: email.content.length,
      isAutomated: this.detectAutomatedEmail(email),
      category: this.categorizeEmail(email)
    };
  }

  /**
   * Helper methods for email processing
   */
  private getHeaderValue(headers: Array<{name: string; value: string}>, name: string): string | undefined {
    return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;
  }

  private extractEmailFromHeader(fromHeader: string): string {
    const emailMatch = fromHeader.match(/<([^>]+)>/);
    return emailMatch ? emailMatch[1] : fromHeader.split(' ')[0];
  }

  private extractDomainFromEmail(email: string): string {
    const domain = email.split('@')[1];
    return domain || 'unknown';
  }

  private extractEmailBody(payload: any): EmailContentExtraction {
    let plainText = '';
    
    // Handle simple body
    if (payload.body?.data) {
      plainText = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }
    
    // Handle multipart
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          plainText += Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }
    }

    // Clean up the text
    plainText = plainText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    
    return {
      plainText,
      hasImages: this.containsImages(payload),
      hasLinks: this.containsLinks(plainText),
      wordCount: plainText.split(/\s+/).length,
      isAutomated: this.detectAutomatedContent(plainText)
    };
  }

  private hasEmailAttachments(payload: any): boolean {
    return payload.parts?.some((part: any) => part.filename && part.filename.length > 0) || false;
  }

  private containsImages(payload: any): boolean {
    return payload.parts?.some((part: any) => part.mimeType?.startsWith('image/')) || false;
  }

  private containsLinks(text: string): boolean {
    return /https?:\/\/[^\s]+/.test(text);
  }

  private detectAutomatedContent(text: string): boolean {
    const automatedKeywords = [
      'unsubscribe', 'automated', 'do not reply', 'noreply',
      'notification', 'alert', 'reminder', 'system generated'
    ];
    const lowerText = text.toLowerCase();
    return automatedKeywords.some(keyword => lowerText.includes(keyword));
  }

  private detectAutomatedEmail(email: ProcessedEmail): boolean {
    const automatedDomains = ['noreply', 'no-reply', 'donotreply', 'notifications'];
    const isAutomatedDomain = automatedDomains.some(domain => 
      email.senderEmail.toLowerCase().includes(domain)
    );
    
    return isAutomatedDomain || this.detectAutomatedContent(email.content);
  }

  private categorizeEmail(email: ProcessedEmail): string {
    if (email.isImportant) return 'important';
    if (this.detectAutomatedEmail(email)) return 'automated';
    if (email.hasAttachments) return 'attachments';
    return 'general';
  }

  private createProcessingError(
    type: EmailProcessingError,
    message: string,
    retryable: boolean,
    emailId?: string
  ): EmailProcessingErrorDetails {
    return {
      type,
      message,
      emailId,
      retryable,
      timestamp: new Date().toISOString()
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get service status
   */
  getStatus(): {
    configured: boolean;
    supermemoryConnected: boolean;
    composioConfigured: boolean;
    config: EmailProcessingConfig;
  } {
    return {
      configured: !!process.env.SUPERMEMORY_API_KEY && !!process.env.COMPOSIO_API_KEY,
      supermemoryConnected: supermemoryClient.isClientConnected(),
      composioConfigured: !!process.env.COMPOSIO_API_KEY,
      config: this.config
    };
  }
}

// Export singleton instance
export const emailEmbeddingService = new EmailEmbeddingService(); 