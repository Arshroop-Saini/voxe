# Supermemory Search API Reference

> **Internal Guide**: Comprehensive reference for searching embedded memories using Supermemory's advanced search capabilities

## Overview

The Supermemory Search API enables semantic search across all embedded memories with advanced filtering, containerization, and relevance scoring. This is essential for retrieving specific emails, finding content by sender, and powering intelligent trigger automation.

### Key Features

- **Semantic Search**: Natural language queries to find relevant content
- **Container Filtering**: Search within specific user or project contexts
- **Advanced Filtering**: Filter by metadata, timestamps, and custom fields
- **Relevance Scoring**: Adjustable sensitivity for precision vs. recall
- **Chunk-level Results**: Get specific content sections with context
- **Performance Optimized**: Sub-second search with reranking options

## API Endpoint

**Base URL**: `https://api.supermemory.ai`
**Endpoint**: `POST /v3/search`
**Authentication**: Bearer Token (API Key)

## Request Parameters

### Required Parameters

#### `q` (string, required)
- **Description**: Search query string
- **Minimum Length**: 1 character
- **Example**: `"emails from john about meeting"`
- **Use Cases**: 
  - Natural language queries
  - Specific content searches
  - Sender-based searches
  - Subject line searches

### Core Search Parameters

#### `limit` (integer)
- **Default**: 10
- **Range**: 1-100
- **Description**: Maximum number of results to return
- **Example**: `20`
- **Recommendation**: Use 5-20 for UI display, 50+ for bulk processing

#### `documentThreshold` (number)
- **Default**: 0
- **Range**: 0-1
- **Description**: Document selection sensitivity
  - `0`: Least sensitive (more results, broader matches)
  - `1`: Most sensitive (fewer results, precise matches)
- **Example**: `0.5`
- **Email Use Case**: `0.3` for broad email searches, `0.7` for specific content

#### `chunkThreshold` (number)
- **Default**: 0
- **Range**: 0-1
- **Description**: Chunk selection sensitivity
  - `0`: Returns more content chunks with context
  - `1`: Returns only highly relevant chunks
- **Example**: `0.4`
- **Email Use Case**: `0.2` for full email context, `0.6` for specific snippets

### Container Filtering (Critical for Email Search)

#### `containerTags` (array of strings)
- **Description**: Filter search by container tags
- **Email Use Cases**:
  - User-specific searches: `["user_123"]`
  - Sender filtering: `["sender_gmail.com"]`
  - Combined filtering: `["user_123", "sender_company.com"]`
- **Example**: `["user_131a9b94-2be4-4b19-9219-d944d6ade7af", "sender_gmail.com"]`

### Advanced Filtering

#### `filters` (object)
- **Description**: Advanced metadata filtering with AND/OR logic
- **Structure**:
  ```javascript
  {
    "AND": [
      {
        "key": "source",
        "value": "gmail",
        "negate": false
      },
      {
        "filterType": "numeric",
        "key": "receivedDate",
        "value": "2025-06-20",
        "negate": false,
        "numericOperator": ">"
      }
    ]
  }
  ```
- **Email Filtering Examples**:
  - Recent emails: `{"key": "receivedDate", "value": "2025-06-20", "numericOperator": ">"}`
  - Important emails: `{"key": "isImportant", "value": true}`
  - With attachments: `{"key": "hasAttachments", "value": true}`

### Performance & Context Options

#### `rewriteQuery` (boolean)
- **Default**: false
- **Description**: AI-powered query rewriting for better results
- **Latency Impact**: +400ms
- **Use Case**: Complex or ambiguous queries
- **Example**: `true` for natural language queries

#### `rerank` (boolean)
- **Default**: false
- **Description**: Re-rank results for optimal relevance
- **Use Case**: When precision is critical
- **Email Use Case**: `true` for important searches, `false` for fast browsing

#### `onlyMatchingChunks` (boolean)
- **Default**: false
- **Description**: Return only matching chunks without surrounding context
- **Use Case**: `false` for email display (need full context), `true` for snippet extraction

#### `includeSummary` (boolean)
- **Default**: false
- **Description**: Include document summary in response
- **Use Case**: Email thread summaries, quick overviews

#### `includeFullDocs` (boolean)
- **Default**: false
- **Description**: Include complete document content
- **Use Case**: Full email content retrieval

### Specialized Parameters

#### `docId` (string)
- **Description**: Search within a specific document
- **Max Length**: 255 characters
- **Email Use Case**: Search within a specific email thread
- **Example**: `"email_abc123"`

#### `categoriesFilter` (array)
- **Options**: `["technology", "science", "business", "health"]`
- **Description**: Filter by content categories
- **Email Use Case**: Limited applicability for emails

## Response Format

### Success Response (200)

```javascript
{
  "results": [
    {
      "documentId": "email_abc123",
      "chunks": [
        {
          "content": "Subject: Meeting Tomorrow\n\nHi team, let's reschedule...",
          "isRelevant": true,
          "score": 0.85
        }
      ],
      "score": 0.95,
      "metadata": {
        "source": "gmail",
        "type": "email",
        "sender": "john@company.com",
        "subject": "Meeting Tomorrow",
        "receivedDate": "2025-06-21",
        "isImportant": true,
        "hasAttachments": false
      },
      "title": "Meeting Tomorrow",
      "createdAt": "2025-06-21T10:30:00.000Z",
      "updatedAt": "2025-06-21T10:30:00.000Z",
      "summary": "Email about rescheduling team meeting"
    }
  ],
  "total": 5,
  "timing": 245
}
```

### Response Fields

#### `results` (array)
- **documentId**: Unique identifier for the email/document
- **chunks**: Array of matching content sections
- **score**: Overall relevance score (0-1)
- **metadata**: Email metadata (sender, subject, dates, etc.)
- **title**: Email subject or document title
- **createdAt/updatedAt**: Timestamp information
- **summary**: AI-generated summary (if `includeSummary: true`)

#### `total` (number)
- Total number of matching documents found

#### `timing` (number)
- Search execution time in milliseconds

### Error Responses

#### 400 - Invalid Request
```javascript
{
  "error": "Invalid request parameters",
  "details": "Query must be at least 1 character long"
}
```

#### 401 - Unauthorized
```javascript
{
  "error": "Authentication failed",
  "details": "Invalid API key"
}
```

#### 404 - Not Found
```javascript
{
  "error": "Document not found",
  "details": "Specified docId does not exist"
}
```

#### 500 - Server Error
```javascript
{
  "error": "Internal server error",
  "details": "Search service temporarily unavailable"
}
```

## Implementation Examples

### Basic Email Search

```javascript
import Supermemory from 'supermemory';

const client = new Supermemory({
  apiKey: process.env.SUPERMEMORY_API_KEY,
});

// Search user's emails for meeting-related content
const response = await client.search.execute({
  q: "meeting tomorrow",
  containerTags: ["user_131a9b94-2be4-4b19-9219-d944d6ade7af"],
  limit: 10,
  documentThreshold: 0.3,
  chunkThreshold: 0.3
});

console.log(`Found ${response.total} emails`);
response.results.forEach(result => {
  console.log(`Email: ${result.title} (Score: ${result.score})`);
});
```

### Search by Sender

```javascript
// Find all emails from a specific sender
const senderSearch = await client.search.execute({
  q: "project updates",
  containerTags: [
    "user_131a9b94-2be4-4b19-9219-d944d6ade7af",
    "sender_company.com"
  ],
  filters: {
    AND: [
      {
        key: "sender",
        value: "john@company.com",
        negate: false
      }
    ]
  },
  limit: 20
});
```

### Advanced Email Filtering

```javascript
// Find recent important emails with attachments
const advancedSearch = await client.search.execute({
  q: "urgent report",
  containerTags: ["user_131a9b94-2be4-4b19-9219-d944d6ade7af"],
  filters: {
    AND: [
      {
        key: "isImportant",
        value: true,
        negate: false
      },
      {
        key: "hasAttachments",
        value: true,
        negate: false
      },
      {
        filterType: "numeric",
        key: "receivedDate",
        value: "2025-06-20",
        negate: false,
        numericOperator: ">"
      }
    ]
  },
  rerank: true,
  includeSummary: true,
  limit: 15
});
```

### Email Thread Search

```javascript
// Search within a specific email thread
const threadSearch = await client.search.execute({
  q: "final decision",
  docId: "email_thread_xyz789",
  onlyMatchingChunks: true,
  limit: 5
});
```

## Email-Specific Search Patterns

### 1. User Email Search
```javascript
const userEmails = await client.search.execute({
  q: searchQuery,
  containerTags: [`user_${userId}`],
  limit: 20,
  documentThreshold: 0.3
});
```

### 2. Sender-Based Search
```javascript
const senderEmails = await client.search.execute({
  q: searchQuery,
  containerTags: [
    `user_${userId}`,
    `sender_${senderDomain}`
  ],
  limit: 15
});
```

### 3. Recent Email Search
```javascript
const recentEmails = await client.search.execute({
  q: searchQuery,
  containerTags: [`user_${userId}`],
  filters: {
    AND: [
      {
        filterType: "numeric",
        key: "receivedDate",
        value: yesterdayDate,
        negate: false,
        numericOperator: ">"
      }
    ]
  },
  limit: 10
});
```

### 4. Important Email Search
```javascript
const importantEmails = await client.search.execute({
  q: searchQuery,
  containerTags: [`user_${userId}`],
  filters: {
    AND: [
      {
        key: "isImportant",
        value: true,
        negate: false
      }
    ]
  },
  rerank: true,
  limit: 10
});
```

## Performance Optimization

### Search Speed Guidelines
- **Fast Search**: `rewriteQuery: false`, `rerank: false` (~100-200ms)
- **Balanced Search**: `rewriteQuery: false`, `rerank: true` (~200-400ms)
- **Accurate Search**: `rewriteQuery: true`, `rerank: true` (~400-600ms)

### Threshold Recommendations
- **Broad Discovery**: `documentThreshold: 0.2`, `chunkThreshold: 0.2`
- **Balanced Results**: `documentThreshold: 0.4`, `chunkThreshold: 0.3`
- **Precise Matching**: `documentThreshold: 0.7`, `chunkThreshold: 0.6`

### Container Tag Strategy
- Always include user container tag for data isolation
- Use sender domain tags for efficient filtering
- Combine multiple tags for precise scoping

## Error Handling

### Common Error Scenarios
1. **Empty Query**: Ensure query has minimum 1 character
2. **Invalid Thresholds**: Validate range 0-1 for thresholds
3. **Rate Limiting**: Implement exponential backoff
4. **Large Results**: Use pagination with limit parameter

### Error Handling Pattern
```javascript
try {
  const response = await client.search.execute(searchParams);
  return response.results;
} catch (error) {
  if (error.status === 400) {
    console.error('Invalid search parameters:', error.details);
  } else if (error.status === 401) {
    console.error('Authentication failed:', error.details);
  } else if (error.status === 500) {
    console.error('Search service error:', error.details);
  }
  throw error;
}
```

## Integration with Email Embedding System

### Search Embedded Emails
```javascript
// Search emails that were embedded using our email embedding system
const emailSearch = await client.search.execute({
  q: userQuery,
  containerTags: [
    `user_${userId}`,
    "email_primary_inbox"  // Tag used during embedding
  ],
  filters: {
    AND: [
      {
        key: "source",
        value: "gmail",
        negate: false
      },
      {
        key: "type",
        value: "email",
        negate: false
      }
    ]
  },
  includeSummary: true,
  limit: 15
});
```

### Trigger-Based Search
```javascript
// Search for emails matching trigger conditions
const triggerSearch = await client.search.execute({
  q: triggerKeywords,
  containerTags: [`user_${userId}`],
  filters: {
    AND: [
      {
        key: "sender",
        value: triggerSender,
        negate: false
      },
      {
        filterType: "numeric",
        key: "receivedDate",
        value: triggerDate,
        negate: false,
        numericOperator: ">"
      }
    ]
  },
  documentThreshold: 0.5,
  rerank: true,
  limit: 5
});
```

## Use Cases for Email Automation

### 1. Smart Email Filtering
- Search for emails matching specific criteria
- Automatically categorize based on content
- Identify priority emails for immediate attention

### 2. Trigger Enhancement
- Find emails that should trigger specific actions
- Provide context for trigger execution
- Enable intelligent trigger conditions

### 3. Email Analytics
- Analyze email patterns and trends
- Identify frequent senders and topics
- Generate email usage insights

### 4. Content Discovery
- Help users find specific emails quickly
- Provide semantic search across email history
- Enable natural language email queries

## Security and Privacy

### Data Isolation
- Always use user-specific container tags
- Implement proper access controls
- Validate user permissions before search

### Search Logging
- Log search queries for debugging
- Monitor search performance and usage
- Track popular search patterns

### Rate Limiting
- Implement client-side rate limiting
- Handle API rate limit responses gracefully
- Use caching for repeated searches

## Future Enhancements

### Planned Features
1. **Real-time Search**: Live search as user types
2. **Search Suggestions**: Auto-complete based on email content
3. **Saved Searches**: Store and reuse common search patterns
4. **Search Analytics**: Track search effectiveness and usage
5. **Advanced NLP**: Better query understanding and rewriting

### Integration Opportunities
1. **Voice Search**: Natural language voice queries
2. **Smart Filters**: AI-powered filter suggestions
3. **Email Clustering**: Group similar emails automatically
4. **Predictive Search**: Suggest relevant emails proactively

## Resources

- [Supermemory Search API Documentation](https://api.supermemory.ai/docs)
- [Email Embedding System Documentation](./supermemory-email-embedding-system.md)
- [Container Tags Strategy Guide](./supermemory-email-embedding-system.md#container-tags-strategy)
- [Error Handling Best Practices](./supermemory-email-embedding-system.md#error-handling) 