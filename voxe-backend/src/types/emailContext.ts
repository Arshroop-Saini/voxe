/**
 * TypeScript interfaces for Email Context Enhancement
 * Used for Gmail trigger context enrichment with Supermemory search
 */

export interface EmailHistoryResult {
  documentId: string;
  content: string;
  score: number;
  metadata: Record<string, any>;
  title: string | null;
  summary: string | null;
  createdAt: string;
}

export interface EnhancedEmailContext {
  emailHistory: EmailHistoryResult[];
  mem0Memories: any[];
  contextSummary: string;
  totalHistoryFound: number;
  searchTiming: number;
}

export interface EmailContextResponse {
  success: boolean;
  enhancedContext: EnhancedEmailContext;
  error?: string;
}

export interface SupermemorySearchResult {
  success: boolean;
  results: EmailHistoryResult[];
  total: number;
  timing: number;
  error?: string;
}

export interface TriggerContextData {
  userId: string;
  senderEmail: string;
  triggerPayload: any;
  appName?: string;
  triggerName?: string;
  source?: string;
}

export interface GmailTriggerPayload {
  from?: string;
  sender?: string;
  message?: {
    from?: string;
  };
  email?: {
    from?: string;
  };
  data?: {
    from?: string;
  };
  payload?: {
    headers?: Array<{
      name: string;
      value: string;
    }>;
  };
}

export interface ContextFormattingOptions {
  includeEmailHistory: boolean;
  includeMem0Memories: boolean;
  includePerformanceMetrics: boolean;
  maxEmailPreviewLength: number;
  maxEmailsToShow: number;
}

export const DEFAULT_FORMATTING_OPTIONS: ContextFormattingOptions = {
  includeEmailHistory: true,
  includeMem0Memories: true,
  includePerformanceMetrics: true,
  maxEmailPreviewLength: 200,
  maxEmailsToShow: 5
}; 