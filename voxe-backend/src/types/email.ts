/**
 * TypeScript interfaces for email processing and Supermemory embedding
 */

/**
 * Raw email data from Gmail API via Composio
 */
export interface RawGmailEmail {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  payload: {
    headers: Array<{
      name: string;
      value: string;
    }>;
    body?: {
      data?: string;
      size: number;
    };
    parts?: Array<{
      partId: string;
      mimeType: string;
      filename?: string;
      body?: {
        data?: string;
        size: number;
      };
    }>;
  };
  internalDate: string;
  historyId?: string;
  sizeEstimate?: number;
}

/**
 * Processed email data ready for embedding
 */
export interface ProcessedEmail {
  id: string;
  subject: string;
  sender: string;
  senderEmail: string;
  senderDomain: string;
  content: string;
  receivedDate: string;
  threadId: string;
  hasAttachments: boolean;
  isImportant: boolean;
  labels: string[];
  snippet: string;
}

/**
 * Email embedding result from Supermemory
 */
export interface EmailEmbeddingResult {
  emailId: string;
  memoryId: string;
  status: 'success' | 'failed';
  error?: string;
  timestamp: string;
}

/**
 * Batch embedding operation result
 */
export interface BatchEmbeddingResult {
  totalEmails: number;
  successful: number;
  failed: number;
  results: EmailEmbeddingResult[];
  timestamp: string;
  processingTimeMs: number;
  errors: string[];
}

/**
 * Email fetching parameters
 */
export interface EmailFetchParams {
  userId: string;
  dateRange?: {
    start: string; // YYYY-MM-DD format
    end: string;   // YYYY-MM-DD format
  };
  maxResults?: number;
  includeSpam?: boolean;
  includeTrash?: boolean;
  query?: string; // Gmail search query
}

/**
 * Supermemory container tags for email organization
 */
export interface EmailContainerTags {
  userId: string;
  senderDomain: string;
  category: string; // 'primary_inbox', 'important', 'automated', etc.
}

/**
 * Email metadata for Supermemory storage
 */
export interface EmailMetadata {
  source: 'gmail';
  type: 'email';
  sender: string;
  senderDomain: string;
  subject: string;
  receivedDate: string; // YYYY-MM-DD format
  threadId: string;
  hasAttachments: boolean;
  isImportant: boolean;
  labelCount: number;
  contentLength: number;
  isAutomated?: boolean;
  category?: string;
}

/**
 * Email processing configuration
 */
export interface EmailProcessingConfig {
  batchSize: number;
  maxRetries: number;
  retryDelayMs: number;
  timeoutMs: number;
  enableRateLimiting: boolean;
  rateLimitDelayMs: number;
}

/**
 * Email content extraction result
 */
export interface EmailContentExtraction {
  plainText: string;
  htmlContent?: string;
  hasImages: boolean;
  hasLinks: boolean;
  wordCount: number;
  isAutomated: boolean;
}

/**
 * Default email processing configuration
 */
export const DEFAULT_EMAIL_CONFIG: EmailProcessingConfig = {
  batchSize: 10,
  maxRetries: 3,
  retryDelayMs: 1000,
  timeoutMs: 30000,
  enableRateLimiting: true,
  rateLimitDelayMs: 500,
};

/**
 * Email processing error types
 */
export enum EmailProcessingError {
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  GMAIL_API_ERROR = 'GMAIL_API_ERROR',
  SUPERMEMORY_API_ERROR = 'SUPERMEMORY_API_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_EMAIL_FORMAT = 'INVALID_EMAIL_FORMAT',
  CONTENT_EXTRACTION_FAILED = 'CONTENT_EXTRACTION_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
}

/**
 * Email processing error details
 */
export interface EmailProcessingErrorDetails {
  type: EmailProcessingError;
  message: string;
  emailId?: string;
  retryable: boolean;
  timestamp: string;
} 