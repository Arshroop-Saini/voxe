import { Request, Response } from 'express';
import { emailEmbeddingService } from '../../services/emailEmbeddingService.js';
import { 
  EmailEmbeddingResult,
  BatchEmbeddingResult,
  EmailProcessingError,
  EmailProcessingErrorDetails 
} from '../../types/email.js';
import { 
  ResponseFormatter, 
  EmbedEmailsResponse 
} from '../../types/validation.js';

// Helper function to get user ID from request (consistent with existing patterns)
function getUserId(req: Request): string | null {
  const userIdFromHeader = req.headers['x-user-id'] as string;
  const userIdFromBody = req.body?.user_id;
  const userIdFromQuery = req.query?.user_id as string;
  
  return userIdFromHeader || userIdFromBody || userIdFromQuery || null;
}

/**
 * POST /api/email-embedding - Embed today's emails for a user
 * 
 * Request body:
 * {
 *   user_id?: string  // Optional if provided in header
 * }
 * 
 * Headers:
 * x-user-id: string   // Preferred method for user identification
 * 
 * Response:
 * {
 *   success: boolean,
 *   message: string,
 *   data: {
 *     totalEmails: number,
 *     successful: number,
 *     failed: number,
 *     results: EmailEmbeddingResult[],
 *     timestamp: string
 *   }
 * }
 */
export async function embedDailyEmails(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const requestId = (req as any).requestId || 'unknown';
  
  try {
    const userId = getUserId(req);
    
    // This validation is now handled by middleware, but keeping as fallback
    if (!userId) {
      const errorResponse = ResponseFormatter.error(
        'User authentication required. Please provide user_id in x-user-id header or request body.',
        'MISSING_USER_ID',
        401
      );
      res.status(errorResponse.statusCode).json(errorResponse);
      return;
    }

    console.log(`🔄 [${requestId}] Starting email embedding for user: ${userId}`);
    
    // Execute the email embedding process
    const result: BatchEmbeddingResult = await emailEmbeddingService.embedDailyEmails(userId);
    
    // Add processing time to result
    const processingTimeMs = Date.now() - startTime;
    const enhancedResult = {
      ...result,
      processingTimeMs
    };
    
    console.log(`✅ [${requestId}] Email embedding completed for user ${userId}:`, {
      total: result.totalEmails,
      successful: result.successful,
      failed: result.failed,
      processingTime: `${processingTimeMs}ms`
    });

    // Determine response type and status based on results
    const hasFailures = result.failed > 0;
    const hasSuccesses = result.successful > 0;
    
    let response: EmbedEmailsResponse;
    let statusCode: number;
    
    if (hasSuccesses && !hasFailures) {
      // Complete success
      response = ResponseFormatter.success(
        enhancedResult,
        `Successfully embedded all ${result.successful} emails`
      );
      statusCode = 200;
    } else if (hasSuccesses && hasFailures) {
      // Partial success
      response = ResponseFormatter.partialSuccess(
        enhancedResult,
        `Embedded ${result.successful} emails successfully, ${result.failed} failed`
      );
      statusCode = 207; // Multi-status
    } else if (!hasSuccesses && hasFailures) {
      // Complete failure
      response = ResponseFormatter.error(
        `Failed to embed all ${result.failed} emails`,
        'EMBEDDING_FAILED',
        500,
        enhancedResult
      );
      statusCode = 500;
    } else {
      // No emails to process
      response = ResponseFormatter.success(
        enhancedResult,
        'No emails found to embed'
      );
      statusCode = 200;
    }

    res.status(statusCode).json(response);

  } catch (error: any) {
    const processingTimeMs = Date.now() - startTime;
    console.error(`❌ [${requestId}] Email embedding API error:`, {
      error: error.message,
      code: error.code,
      processingTime: `${processingTimeMs}ms`,
      userId: getUserId(req)
    });
    
    // Handle specific error types with proper response formatting
    let errorResponse: EmbedEmailsResponse & { statusCode: number };
    
    if (error.code === EmailProcessingError.GMAIL_API_ERROR) {
      errorResponse = ResponseFormatter.error(
        'Gmail service temporarily unavailable. Please try again later.',
        'GMAIL_SERVICE_ERROR',
        503,
        { ...error.details, processingTimeMs }
      );
    } else if (error.code === EmailProcessingError.AUTHENTICATION_FAILED) {
      errorResponse = ResponseFormatter.error(
        'Gmail connection expired. Please reconnect your Gmail account.',
        'OAUTH_EXPIRED',
        401,
        { ...error.details, processingTimeMs }
      );
    } else if (error.code === EmailProcessingError.SUPERMEMORY_API_ERROR) {
      errorResponse = ResponseFormatter.error(
        'Memory service temporarily unavailable. Please try again later.',
        'MEMORY_SERVICE_ERROR',
        503,
        { ...error.details, processingTimeMs }
      );
    } else if (error.code === EmailProcessingError.RATE_LIMIT_EXCEEDED) {
      errorResponse = {
        ...ResponseFormatter.error(
          'Rate limit exceeded. Please wait before trying again.',
          'RATE_LIMIT_EXCEEDED',
          429,
          { ...error.details, processingTimeMs }
        ),
        retryAfter: error.retryAfter || 60
      };
    } else {
      // Generic error handling
      errorResponse = ResponseFormatter.error(
        'Internal server error occurred while embedding emails',
        'INTERNAL_ERROR',
        500,
        {
          processingTimeMs,
          timestamp: new Date().toISOString(),
          requestId,
          ...(process.env.NODE_ENV === 'development' && { 
            originalError: error.message,
            stack: error.stack 
          })
        }
      );
    }

    res.status(errorResponse.statusCode).json(errorResponse);
  }
}

/**
 * GET /api/email-embedding/status/:userId - Get embedding status for a user
 * This could be used for polling or checking last embedding time
 */
export async function getEmbeddingStatus(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.params.userId || getUserId(req);
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User ID required'
      });
      return;
    }

    // This could be extended to check last embedding time from database
    // For now, return basic status
    res.json({
      success: true,
      data: {
        userId,
        lastEmbedding: null, // Could be fetched from database
        status: 'ready'
      }
    });

  } catch (error) {
    console.error('Error getting embedding status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get embedding status'
    });
  }
} 