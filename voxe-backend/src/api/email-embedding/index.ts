import express from 'express';
import { embedDailyEmails, getEmbeddingStatus } from './emailEmbedding.js';

const router = express.Router();

// Basic validation middleware for email embedding
function validateEmbedEmailsRequest(req: express.Request, res: express.Response, next: express.NextFunction): void {
  // Extract user ID from header or body
  const userId = req.headers['x-user-id'] as string || req.body?.user_id;
  
  if (!userId) {
    res.status(400).json({
      success: false,
      message: 'User ID is required. Provide via x-user-id header or user_id in request body.',
      error: 'Missing user ID',
      code: 'VALIDATION_ERROR'
    });
    return;
  }

  if (typeof userId !== 'string' || userId.trim().length === 0) {
    res.status(400).json({
      success: false,
      message: 'User ID must be a non-empty string',
      error: 'Invalid user ID format',
      code: 'VALIDATION_ERROR'
    });
    return;
  }

  // Check for unexpected fields in body
  if (req.body && typeof req.body === 'object') {
    const allowedFields = ['user_id'];
    const unexpectedFields = Object.keys(req.body).filter(field => !allowedFields.includes(field));
    
    if (unexpectedFields.length > 0) {
      res.status(400).json({
        success: false,
        message: `Unexpected fields: ${unexpectedFields.join(', ')}. Only 'user_id' is allowed.`,
        error: 'Invalid request body',
        code: 'VALIDATION_ERROR'
      });
      return;
    }
  }

  next();
}

// Security headers middleware
function addSecurityHeaders(req: express.Request, res: express.Response, next: express.NextFunction) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  });
  next();
}

// Apply security headers to all routes
router.use(addSecurityHeaders);

// POST /api/email-embedding - Embed today's emails for a user
router.post('/', validateEmbedEmailsRequest, embedDailyEmails);

// GET /api/email-embedding/status/:userId - Get embedding status
router.get('/status/:userId', getEmbeddingStatus);
router.get('/status', getEmbeddingStatus);

export default router; 