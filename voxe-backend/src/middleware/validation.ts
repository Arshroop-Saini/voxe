import { Request, Response, NextFunction } from 'express';
import { RequestValidator, ResponseFormatter } from '../types/validation.js';

/**
 * Express middleware for validating email embedding requests
 */
export function validateEmbedEmailsRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    // Perform comprehensive validation
    const validation = RequestValidator.validateEmbedEmailsRequest(req);

    if (!validation.isValid) {
      // Return validation error response
      const errorResponse = ResponseFormatter.validationError(validation.errors);
      res.status(400).json(errorResponse);
      return;
    }

    // Validation passed, continue to next middleware/handler
    next();
  } catch (error) {
    console.error('Validation middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal validation error',
      error: 'Validation system error',
      code: 'VALIDATION_SYSTEM_ERROR'
    });
  }
}

/**
 * Middleware for request logging and timing
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Add request ID to request object for tracking
  (req as any).requestId = requestId;
  
  console.log(`📥 [${requestId}] ${req.method} ${req.path}`, {
    headers: {
      'content-type': req.headers['content-type'],
      'x-user-id': req.headers['x-user-id'],
      'user-agent': req.headers['user-agent']
    },
    body: req.method === 'POST' ? req.body : undefined,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    timestamp: new Date().toISOString()
  });

  // Override res.json to log responses
  const originalJson = res.json;
  res.json = function(body: any) {
    const duration = Date.now() - startTime;
    
    console.log(`📤 [${requestId}] Response ${res.statusCode}`, {
      duration: `${duration}ms`,
      success: body?.success,
      message: body?.message,
      dataSize: body?.data ? Object.keys(body.data).length : 0,
      timestamp: new Date().toISOString()
    });
    
    return originalJson.call(this, body);
  };

  next();
}

/**
 * Middleware for rate limiting (basic implementation)
 */
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10; // 10 requests per minute per user

export function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const userId = req.headers['x-user-id'] as string || req.body?.user_id || 'anonymous';
    const now = Date.now();
    
    // Clean up expired entries
    for (const [key, value] of requestCounts.entries()) {
      if (now > value.resetTime) {
        requestCounts.delete(key);
      }
    }
    
    // Get or create user's request count
    let userRequests = requestCounts.get(userId);
    
    if (!userRequests || now > userRequests.resetTime) {
      userRequests = {
        count: 0,
        resetTime: now + RATE_LIMIT_WINDOW
      };
    }
    
    userRequests.count++;
    requestCounts.set(userId, userRequests);
    
    // Check if rate limit exceeded
    if (userRequests.count > MAX_REQUESTS_PER_WINDOW) {
      const resetInSeconds = Math.ceil((userRequests.resetTime - now) / 1000);
      
      res.status(429).json({
        success: false,
        message: `Rate limit exceeded. Maximum ${MAX_REQUESTS_PER_WINDOW} requests per minute allowed.`,
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: resetInSeconds,
        details: {
          limit: MAX_REQUESTS_PER_WINDOW,
          window: '1 minute',
          resetIn: `${resetInSeconds} seconds`
        }
      });
      return;
    }
    
    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': MAX_REQUESTS_PER_WINDOW.toString(),
      'X-RateLimit-Remaining': (MAX_REQUESTS_PER_WINDOW - userRequests.count).toString(),
      'X-RateLimit-Reset': Math.ceil(userRequests.resetTime / 1000).toString()
    });
    
    next();
  } catch (error) {
    console.error('Rate limit middleware error:', error);
    // Continue on error to avoid breaking the API
    next();
  }
}

/**
 * Middleware for security headers
 */
export function securityHeaders(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Add security headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });
  
  next();
}

/**
 * Error handling middleware
 */
export function errorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = (req as any).requestId || 'unknown';
  
  console.error(`❌ [${requestId}] Unhandled error:`, {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    userId: req.headers['x-user-id'] || req.body?.user_id,
    timestamp: new Date().toISOString()
  });
  
  // Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(error.status || 500).json({
    success: false,
    message: isDevelopment ? error.message : 'Internal server error',
    error: 'Unhandled server error',
    code: 'INTERNAL_ERROR',
    requestId,
    details: isDevelopment ? {
      stack: error.stack,
      timestamp: new Date().toISOString()
    } : undefined
  });
} 