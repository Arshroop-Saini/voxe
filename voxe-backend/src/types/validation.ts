/**
 * Validation types and schemas for email embedding API
 */

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Email embedding request validation schema
 */
export interface EmbedEmailsRequest {
  user_id?: string; // Optional if provided in header
}

/**
 * Email embedding response schema
 */
export interface EmbedEmailsResponse {
  success: boolean;
  message: string;
  data?: {
    totalEmails: number;
    successful: number;
    failed: number;
    results: Array<{
      emailId: string;
      memoryId: string;
      status: 'success' | 'failed';
      error?: string;
      timestamp: string;
    }>;
    timestamp: string;
    processingTimeMs: number;
  };
  error?: string;
  code?: string;
  details?: any;
  retryAfter?: number;
}

/**
 * Validation error codes
 */
export enum ValidationErrorCode {
  MISSING_FIELD = 'MISSING_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  INVALID_LENGTH = 'INVALID_LENGTH',
  INVALID_TYPE = 'INVALID_TYPE',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN'
}

/**
 * Request validation utilities
 */
export class RequestValidator {
  /**
   * Validate user ID from various sources
   */
  static validateUserId(userId: string | null | undefined): ValidationResult {
    const errors: ValidationError[] = [];

    if (!userId) {
      errors.push({
        field: 'user_id',
        message: 'User ID is required. Provide via x-user-id header or user_id in request body.',
        code: ValidationErrorCode.MISSING_FIELD
      });
    } else if (typeof userId !== 'string') {
      errors.push({
        field: 'user_id',
        message: 'User ID must be a string',
        code: ValidationErrorCode.INVALID_TYPE,
        value: userId
      });
    } else if (userId.trim().length === 0) {
      errors.push({
        field: 'user_id',
        message: 'User ID cannot be empty',
        code: ValidationErrorCode.INVALID_LENGTH,
        value: userId
      });
    } else if (userId.length > 255) {
      errors.push({
        field: 'user_id',
        message: 'User ID is too long (max 255 characters)',
        code: ValidationErrorCode.INVALID_LENGTH,
        value: userId.length
      });
    } else if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
      errors.push({
        field: 'user_id',
        message: 'User ID contains invalid characters. Only alphanumeric, underscore, and hyphen allowed.',
        code: ValidationErrorCode.INVALID_FORMAT,
        value: userId
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate request body structure
   */
  static validateRequestBody(body: any): ValidationResult {
    const errors: ValidationError[] = [];

    if (body && typeof body !== 'object') {
      errors.push({
        field: 'body',
        message: 'Request body must be a valid JSON object',
        code: ValidationErrorCode.INVALID_TYPE,
        value: typeof body
      });
    }

    // Check for unexpected fields
    if (body && typeof body === 'object') {
      const allowedFields = ['user_id'];
      const providedFields = Object.keys(body);
      const unexpectedFields = providedFields.filter(field => !allowedFields.includes(field));

      if (unexpectedFields.length > 0) {
        errors.push({
          field: 'body',
          message: `Unexpected fields: ${unexpectedFields.join(', ')}. Allowed fields: ${allowedFields.join(', ')}`,
          code: ValidationErrorCode.INVALID_FORMAT,
          value: unexpectedFields
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate request headers
   */
  static validateHeaders(headers: any): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate Content-Type if body is provided
    const contentType = headers['content-type'];
    if (contentType && !contentType.includes('application/json')) {
      errors.push({
        field: 'content-type',
        message: 'Content-Type must be application/json',
        code: ValidationErrorCode.INVALID_FORMAT,
        value: contentType
      });
    }

    // Validate x-user-id header format if provided
    const userIdHeader = headers['x-user-id'];
    if (userIdHeader) {
      const userIdValidation = this.validateUserId(userIdHeader);
      if (!userIdValidation.isValid) {
        errors.push(...userIdValidation.errors.map(error => ({
          ...error,
          field: 'x-user-id'
        })));
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Comprehensive request validation
   */
  static validateEmbedEmailsRequest(req: any): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate headers
    const headerValidation = this.validateHeaders(req.headers);
    errors.push(...headerValidation.errors);

    // Validate body structure
    const bodyValidation = this.validateRequestBody(req.body);
    errors.push(...bodyValidation.errors);

    // Extract and validate user ID
    const userId = req.headers['x-user-id'] || req.body?.user_id || req.query?.user_id;
    const userIdValidation = this.validateUserId(userId);
    errors.push(...userIdValidation.errors);

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Response formatting utilities
 */
export class ResponseFormatter {
  /**
   * Format validation error response
   */
  static validationError(errors: ValidationError[]): EmbedEmailsResponse {
    return {
      success: false,
      message: `Validation failed: ${errors.map(e => e.message).join('; ')}`,
      error: 'Request validation failed',
      code: 'VALIDATION_ERROR',
      details: {
        errors,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Format success response
   */
  static success(
    data: EmbedEmailsResponse['data'],
    message?: string
  ): EmbedEmailsResponse {
    return {
      success: true,
      message: message || `Successfully processed ${data?.totalEmails || 0} emails`,
      data
    };
  }

  /**
   * Format error response
   */
  static error(
    message: string,
    code: string,
    statusCode: number = 500,
    details?: any
  ): EmbedEmailsResponse & { statusCode: number } {
    return {
      success: false,
      message,
      error: message,
      code,
      details,
      statusCode
    };
  }

  /**
   * Format partial success response
   */
  static partialSuccess(
    data: EmbedEmailsResponse['data'],
    message?: string
  ): EmbedEmailsResponse {
    return {
      success: true,
      message: message || `Partially successful: ${data?.successful || 0} succeeded, ${data?.failed || 0} failed`,
      data
    };
  }
} 