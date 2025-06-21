# Supermemory Email Embedding System

> **Internal Guide**: Automated email embedding system for enhanced Gmail trigger automation using Supermemory SDK

## Overview

The Supermemory Email Embedding System automatically processes and embeds daily inbox emails to enhance trigger automation capabilities. This system enables intelligent email filtering and contextual understanding for Gmail-based triggers by leveraging Supermemory's memory storage and retrieval capabilities.

### Key Benefits

- **Enhanced Context**: Emails are embedded with semantic understanding for better trigger matching
- **Intelligent Filtering**: Filter emails by sender address and content patterns
- **User-Specific Storage**: Each user's emails are containerized with their auth ID
- **Daily Automation**: Batch process emails from primary inbox daily
- **Trigger Enhancement**: Improved Gmail trigger accuracy through contextual email understanding

## Architecture Flow

```
User Clicks Button → Fetch Gmail Primary Inbox → Process Daily Emails → 
Extract Email Content → Add to Supermemory → Tag with User ID & Sender → 
Enable Enhanced Trigger Filtering
```

## Supermemory SDK Setup

### Installation

```bash
npm install supermemory
```

### Environment Configuration

```bash
# Add to .env files
SUPERMEMORY_API_KEY=your_supermemory_api_key_here
```

### Client Initialization

```typescript
import Supermemory from 'supermemory';

const supermemoryClient = new Supermemory({
  apiKey: process.env.SUPERMEMORY_API_KEY,
});
```

## API Reference

### Add Memory Endpoint

**Endpoint**: `POST /v3/memories`
**Base URL**: `https://api.supermemory.ai`
**Authentication**: Bearer Token

### Request Parameters

#### Required Parameters
- **content** (string): The email content to process into memory
  - Supports plaintext, URLs, PDFs, images, videos
  - Auto-detects content type from format

#### Optional Parameters
- **containerTags** (array): Tags for memory containerization
  - Used for user ID and email sender grouping
  - Example: `["user_123", "sender_gmail.com"]`

- **customId** (string): Custom identifier for the memory
  - Unique ID from database
  - Example: `"email_msg_abc123"`

- **metadata** (object): Additional memory information
  - Key-value pairs (string keys, string/number/boolean values)
  - Used for filtering and categorization
  - No nested objects allowed

### Request Example

```typescript
const response = await supermemoryClient.memories.add({
  content: "Subject: Meeting Tomorrow\n\nHi team, let's reschedule our meeting for tomorrow at 2 PM...",
  containerTags: [
    "user_auth_id_123",
    "sender_john@company.com"
  ],
  customId: "email_msg_20240115_001",
  metadata: {
    source: "gmail",
    type: "email",
    sender: "john@company.com",
    subject: "Meeting Tomorrow",
    receivedDate: "2024-01-15",
    isImportant: true,
    hasAttachments: false,
    threadId: "thread_abc123"
  }
});
```

### Response Format

#### Success Response (200)
```json
{
  "id": "mem_xyz789",
  "status": "success"
}
```

#### Error Responses

**401 Unauthorized**
```json
{
  "error": "Invalid request parameters",
  "details": "Authentication failed"
}
```

**500 Internal Server Error**
```json
{
  "error": "Internal server error",
  "details": "Failed to process memory"
}
```

## Email Processing Workflow

### 1. Email Fetching Process

```typescript
// Fetch emails from Gmail primary inbox for today
const today = new Date().toISOString().split('T')[0];
const emails = await composioService.executeAction({
  action: 'GMAIL_LIST_EMAILS',
  params: {
    query: `in:primary after:${today}`,
    maxResults: 100
  },
  entityId: userId
});
```

### 2. Email Content Extraction

```typescript
interface ProcessedEmail {
  id: string;
  subject: string;
  sender: string;
  content: string;
  receivedDate: string;
  threadId: string;
  hasAttachments: boolean;
  isImportant: boolean;
  labels: string[];
}

const extractEmailContent = (rawEmail: any): ProcessedEmail => {
  return {
    id: rawEmail.id,
    subject: rawEmail.payload.headers.find(h => h.name === 'Subject')?.value || '',
    sender: rawEmail.payload.headers.find(h => h.name === 'From')?.value || '',
    content: parseEmailBody(rawEmail.payload),
    receivedDate: new Date(parseInt(rawEmail.internalDate)).toISOString(),
    threadId: rawEmail.threadId,
    hasAttachments: rawEmail.payload.parts?.some(part => part.filename) || false,
    isImportant: rawEmail.labelIds?.includes('IMPORTANT') || false,
    labels: rawEmail.labelIds || []
  };
};
```

### 3. Memory Addition Process

```typescript
const addEmailToSupermemory = async (
  email: ProcessedEmail, 
  userId: string
): Promise<string> => {
  try {
    // Extract sender domain for containerTag
    const senderDomain = email.sender.split('@')[1] || 'unknown';
    
    // Format email content for embedding
    const emailContent = `
Subject: ${email.subject}
From: ${email.sender}
Date: ${email.receivedDate}

${email.content}
    `.trim();

    const response = await supermemoryClient.memories.add({
      content: emailContent,
      containerTags: [
        `user_${userId}`,
        `sender_${senderDomain}`,
        `email_primary_inbox`
      ],
      customId: `email_${email.id}`,
      metadata: {
        source: 'gmail',
        type: 'email',
        sender: email.sender,
        senderDomain: senderDomain,
        subject: email.subject,
        receivedDate: email.receivedDate.split('T')[0],
        threadId: email.threadId,
        hasAttachments: email.hasAttachments,
        isImportant: email.isImportant,
        labelCount: email.labels.length
      }
    });

    return response.id;
  } catch (error) {
    console.error('Failed to add email to Supermemory:', error);
    throw error;
  }
};
```

## Implementation Components

### 1. Email Embedding Service

```typescript
// services/emailEmbeddingService.ts
export class EmailEmbeddingService {
  private supermemoryClient: Supermemory;
  private composioService: ComposioService;

  constructor() {
    this.supermemoryClient = new Supermemory({
      apiKey: process.env.SUPERMEMORY_API_KEY,
    });
    this.composioService = new ComposioService();
  }

  async embedDailyEmails(userId: string): Promise<EmbeddingResult> {
    try {
      // Fetch today's emails from primary inbox
      const emails = await this.fetchTodayEmails(userId);
      
      // Process and embed each email
      const results = await Promise.allSettled(
        emails.map(email => this.addEmailToSupermemory(email, userId))
      );

      // Count successes and failures
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      return {
        totalEmails: emails.length,
        successful,
        failed,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Email embedding failed:', error);
      throw error;
    }
  }

  private async fetchTodayEmails(userId: string): Promise<ProcessedEmail[]> {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const response = await this.composioService.executeAction({
      action: 'GMAIL_LIST_EMAILS',
      params: {
        query: `in:primary after:${yesterday} before:${today}`,
        maxResults: 100
      },
      entityId: userId
    });

    return response.data?.messages?.map(this.extractEmailContent) || [];
  }
}

interface EmbeddingResult {
  totalEmails: number;
  successful: number;
  failed: number;
  timestamp: string;
}
```

### 2. Backend API Endpoint

```typescript
// src/api/email-embedding.ts
import { Request, Response } from 'express';
import { EmailEmbeddingService } from '../services/emailEmbeddingService';

export async function embedDailyEmails(req: Request, res: Response) {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const embeddingService = new EmailEmbeddingService();
    const result = await embeddingService.embedDailyEmails(userId);

    return res.json({
      success: true,
      message: `Successfully embedded ${result.successful} out of ${result.totalEmails} emails`,
      data: result
    });
  } catch (error) {
    console.error('Email embedding API error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to embed emails',
      error: error.message
    });
  }
}
```

### 3. Frontend Button Integration

```typescript
// components/EmailEmbeddingButton.tsx
import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';

interface EmailEmbeddingButtonProps {
  userId: string;
  onSuccess?: (result: EmbeddingResult) => void;
  onError?: (error: string) => void;
}

export const EmailEmbeddingButton: React.FC<EmailEmbeddingButtonProps> = ({
  userId,
  onSuccess,
  onError
}) => {
  const [isEmbedding, setIsEmbedding] = useState(false);

  const handleEmbedEmails = async () => {
    if (isEmbedding) return;

    setIsEmbedding(true);
    
    try {
      const response = await fetch('/api/email-embedding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      const result = await response.json();

      if (result.success) {
        Alert.alert(
          'Success',
          `Embedded ${result.data.successful} emails successfully!`
        );
        onSuccess?.(result.data);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Email embedding failed:', error);
      Alert.alert('Error', 'Failed to embed emails. Please try again.');
      onError?.(error.message);
    } finally {
      setIsEmbedding(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, isEmbedding && styles.buttonDisabled]}
      onPress={handleEmbedEmails}
      disabled={isEmbedding}
    >
      <Text style={styles.buttonText}>
        {isEmbedding ? 'Embedding Emails...' : 'Embed Today\'s Emails'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 8,
  },
  buttonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
```

## Container Tags Strategy

### User-Based Tagging
- **Format**: `user_{userId}`
- **Purpose**: Separate memories by user account
- **Example**: `user_auth_123456`

### Sender-Based Tagging
- **Format**: `sender_{domain}`
- **Purpose**: Group emails by sender domain for filtering
- **Example**: `sender_gmail.com`, `sender_company.com`

### Category-Based Tagging
- **Format**: `email_{category}`
- **Purpose**: Categorize email types
- **Example**: `email_primary_inbox`, `email_important`, `email_automated`

## Metadata Schema

### Standard Email Metadata
```typescript
interface EmailMetadata {
  source: 'gmail';
  type: 'email';
  sender: string;           // Full sender email
  senderDomain: string;     // Sender domain only
  subject: string;          // Email subject line
  receivedDate: string;     // YYYY-MM-DD format
  threadId: string;         // Gmail thread ID
  hasAttachments: boolean;  // Attachment indicator
  isImportant: boolean;     // Important label flag
  labelCount: number;       // Number of Gmail labels
}
```

## Error Handling

### Common Error Scenarios

1. **Authentication Failures**
   - Invalid Supermemory API key
   - Expired Gmail OAuth tokens
   - Insufficient permissions

2. **Rate Limiting**
   - Supermemory API rate limits
   - Gmail API quotas exceeded
   - Concurrent request limits

3. **Data Processing Errors**
   - Malformed email content
   - Missing required fields
   - Encoding issues

### Error Handling Strategy

```typescript
const handleEmbeddingError = (error: any, email: ProcessedEmail) => {
  if (error.status === 401) {
    console.error('Authentication failed for Supermemory');
    // Handle auth refresh
  } else if (error.status === 429) {
    console.error('Rate limit exceeded, queueing for retry');
    // Implement retry logic
  } else {
    console.error(`Failed to embed email ${email.id}:`, error);
    // Log for monitoring
  }
};
```

## Performance Considerations

### Batch Processing
- Process emails in batches of 10-20
- Implement delay between batches to respect rate limits
- Use Promise.allSettled for parallel processing

### Memory Optimization
- Stream large email content instead of loading into memory
- Clean up processed email data promptly
- Use efficient email parsing algorithms

### Rate Limit Management
- Implement exponential backoff for retries
- Monitor API usage and adjust batch sizes
- Queue failed requests for later processing

## Security Best Practices

### API Key Management
- Store Supermemory API key securely
- Use environment variables
- Implement key rotation procedures

### Data Privacy
- Process emails temporarily without persistent storage
- Sanitize sensitive information before embedding
- Comply with email privacy regulations

### Access Control
- Verify user ownership of Gmail account
- Validate user authentication before processing
- Log all embedding activities for audit

## Monitoring and Analytics

### Key Metrics
- Daily embedding success rates
- Processing time per email
- API error rates and types
- User engagement with embedded emails

### Logging Strategy
```typescript
const logEmbeddingActivity = {
  timestamp: new Date().toISOString(),
  userId: 'user_123',
  emailCount: 25,
  successCount: 23,
  failureCount: 2,
  processingTimeMs: 15000,
  errors: ['rate_limit_exceeded', 'invalid_email_format']
};
```

## Future Enhancements

### Advanced Features
1. **Smart Email Filtering**: AI-powered email categorization before embedding
2. **Incremental Updates**: Only embed new/changed emails
3. **Email Summarization**: Generate summaries for long emails
4. **Attachment Processing**: Extract and embed email attachments
5. **Real-time Processing**: Process emails as they arrive via webhooks

### Integration Improvements
1. **Multiple Email Providers**: Support for Outlook, Yahoo, etc.
2. **Custom Embedding Models**: Use domain-specific embedding models
3. **Semantic Search**: Enhanced search capabilities across embedded emails
4. **Email Templates**: Identify and categorize email templates

## Testing Strategy

### Unit Tests
- Test email content extraction
- Validate metadata generation
- Mock Supermemory API responses

### Integration Tests
- End-to-end email embedding flow
- Gmail API integration
- Error handling scenarios

### Performance Tests
- Batch processing performance
- Memory usage during large email processing
- API rate limit handling

## Deployment Checklist

- [ ] Configure Supermemory API key
- [ ] Set up Gmail OAuth permissions
- [ ] Deploy backend API endpoints
- [ ] Add frontend button to monitoring page
- [ ] Configure error monitoring and alerting
- [ ] Set up usage analytics tracking
- [ ] Test with real user accounts
- [ ] Create user documentation
- [ ] Implement backup and recovery procedures

## Resources

- [Supermemory API Documentation](https://docs.supermemory.ai/)
- [Gmail API Reference](https://developers.google.com/gmail/api)
- [Composio Gmail Integration](https://docs.composio.dev/apps/gmail)
- [Email Processing Best Practices](https://developers.google.com/gmail/api/guides/batch) 