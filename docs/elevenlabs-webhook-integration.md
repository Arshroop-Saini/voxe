# ElevenLabs Webhook Integration with Composio Tools

> Complete integration guide for ElevenLabs Conversational AI with Composio-powered backend tools

## Overview

This document outlines the integration between ElevenLabs Conversational AI and our Composio-powered backend, enabling voice agents to execute authenticated actions like sending emails, managing calendars, and more.

## Architecture

```
ElevenLabs Agent → Webhook → Backend → Composio OAuth → External APIs (Gmail, etc.)
```

### Key Components

1. **ElevenLabs Agent**: Voice conversational AI interface
2. **Webhook Handler**: Backend endpoint that processes tool calls
3. **Composio Integration**: Handles OAuth and API interactions
4. **Tool Execution**: Actual API calls to external services

## Setup Requirements

### Environment Variables

```bash
# ElevenLabs
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_AGENT_ID=agent_01jy2a1j4rfthsywk014emsggj

# Composio
COMPOSIO_API_KEY=your_composio_api_key

# Backend
PORT=3002
```

### Dependencies

```bash
# Backend dependencies
npm install composio-core express cors dotenv
npm install @types/express @types/cors typescript ts-node
```

## Webhook Implementation

### Endpoint Configuration

**URL**: `https://your-domain.com/api/elevenlabs-webhook`
**Method**: `POST`
**Content-Type**: `application/json`

### Request Format

ElevenLabs sends tool calls in this format:

```json
{
  "tool_name": "send_email",
  "parameters": {
    "to": "recipient@example.com",
    "subject": "Meeting Tomorrow",
    "body": "Hi, let's reschedule our meeting for tomorrow.",
    "cc": "optional@example.com",
    "bcc": "optional@example.com"
  }
}
```

### Response Format

The webhook must respond with:

```json
{
  "success": true,
  "message": "Email sent successfully to recipient@example.com",
  "data": {
    "messageId": "msg_123456",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## Tool Configuration Guide

### 1. Gmail Send Email Tool

#### ElevenLabs Agent Configuration

**Tool Settings:**
- **Name**: `send_email`
- **Description**: `Send an email using Gmail to a specified recipient`
- **Method**: `POST`
- **URL**: `https://your-ngrok-url.ngrok-free.app/api/elevenlabs-webhook`
- **Wait for Response**: `true`
- **Response Timeout**: `30 seconds`

**Headers:**
```
Content-Type: application/json
```

**Body Parameters:**
```json
{
  "type": "object",
  "properties": {
    "tool_name": {
      "type": "string",
      "description": "Name of the tool being called"
    },
    "parameters": {
      "type": "object",
      "properties": {
        "to": {
          "type": "string",
          "description": "Email recipient address"
        },
        "subject": {
          "type": "string",
          "description": "Email subject line"
        },
        "body": {
          "type": "string",
          "description": "Email content/message"
        },
        "cc": {
          "type": "string",
          "description": "CC recipients (comma-separated, optional)"
        },
        "bcc": {
          "type": "string",
          "description": "BCC recipients (comma-separated, optional)"
        }
      },
      "required": ["to", "subject", "body"]
    }
  },
  "required": ["tool_name", "parameters"]
}
```

#### Backend Implementation

```typescript
// src/api/elevenlabs-webhook.ts
import { Request, Response } from 'express';
import { ComposioToolSet } from 'composio-core';

const toolset = new ComposioToolSet();

export async function handleElevenLabsWebhook(req: Request, res: Response) {
  try {
    const { tool_name, parameters } = req.body;

    switch (tool_name) {
      case 'send_email':
        const result = await toolset.execute_action(
          'GMAIL_SEND_EMAIL',
          {
            to: parameters.to,
            subject: parameters.subject,
            body: parameters.body,
            cc: parameters.cc,
            bcc: parameters.bcc
          },
          'user-entity-id' // Replace with actual user ID
        );

        if (result.successful) {
          return res.json({
            success: true,
            message: `Email sent successfully to ${parameters.to}`,
            data: result.data
          });
        } else {
          return res.status(400).json({
            success: false,
            message: `Failed to send email: ${result.error}`
          });
        }

      default:
        return res.status(400).json({
          success: false,
          message: `Unknown tool: ${tool_name}`
        });
    }
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}
```

## System Prompt Configuration

### Recommended System Prompt

```plaintext
You are a helpful AI assistant with access to email capabilities. When users ask you to send emails, use the send_email tool to send emails via Gmail.

Email Tool Usage:
- Use send_email when users request to send emails
- Always ask for recipient email if not provided
- Ask for subject if not clear from context
- Use conversation content for email body
- Confirm details before sending
- Notify user when email is sent successfully

Email Format Guidelines:
- Keep emails professional and clear
- Include proper greetings and signatures when appropriate
- Ask for clarification if email content is ambiguous

For email requests:
1. Collect recipient email address
2. Determine or ask for subject line
3. Compose email body based on user's intent
4. Call send_email tool with parameters
5. Confirm successful delivery to user

Always be helpful, accurate, and respect user privacy.
```

## Error Handling

### Common Error Scenarios

1. **Authentication Failures**
   - User not connected to Gmail
   - Expired OAuth tokens
   - Invalid credentials

2. **Validation Errors**
   - Invalid email addresses
   - Missing required parameters
   - Malformed requests

3. **API Errors**
   - Gmail API rate limits
   - Network connectivity issues
   - Service unavailable

### Error Response Format

```json
{
  "success": false,
  "message": "Human-readable error message",
  "error_code": "SPECIFIC_ERROR_CODE",
  "details": {
    "field": "specific_field_with_error",
    "reason": "detailed_reason"
  }
}
```

## Testing

### Manual Testing

1. **Test Basic Email Sending**:
   ```bash
   curl -X POST https://your-ngrok-url.ngrok-free.app/api/elevenlabs-webhook \
     -H "Content-Type: application/json" \
     -d '{
       "tool_name": "send_email",
       "parameters": {
         "to": "test@example.com",
         "subject": "Test Email",
         "body": "This is a test email from the webhook."
       }
     }'
   ```

2. **Test Error Handling**:
   ```bash
   curl -X POST https://your-ngrok-url.ngrok-free.app/api/elevenlabs-webhook \
     -H "Content-Type: application/json" \
     -d '{
       "tool_name": "invalid_tool",
       "parameters": {}
     }'
   ```

### Voice Testing Commands

- "Send an email to john@example.com saying we need to reschedule tomorrow's meeting"
- "Email the team about the project update with subject 'Weekly Update'"
- "Send a thank you email to sarah@company.com for the great presentation"

## Security Considerations

### Authentication
- All Composio OAuth connections are handled server-side
- User authentication tokens are securely stored
- No sensitive credentials exposed to ElevenLabs

### Data Privacy
- Email content is processed temporarily
- No persistent storage of email content
- User data handled according to privacy policies

### Rate Limiting
- Implement rate limiting on webhook endpoints
- Monitor API usage to prevent abuse
- Set appropriate timeouts for tool execution

## Monitoring and Logging

### Key Metrics
- Webhook response times
- Tool execution success rates
- Error frequency and types
- User engagement with voice tools

### Logging Format
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "INFO",
  "event": "tool_execution",
  "tool_name": "send_email",
  "user_id": "user_123",
  "success": true,
  "duration_ms": 1250,
  "parameters": {
    "to": "recipient@example.com",
    "subject": "Meeting Tomorrow"
  }
}
```

## Troubleshooting

### Common Issues

1. **Webhook Not Responding**
   - Check ngrok tunnel is active
   - Verify webhook URL in ElevenLabs dashboard
   - Check server logs for errors

2. **Tool Not Being Called**
   - Review tool name and description
   - Check system prompt includes tool usage instructions
   - Verify tool parameters are correctly configured

3. **Authentication Errors**
   - Ensure user has connected Gmail account
   - Check Composio OAuth connection status
   - Verify API keys are valid

### Debug Mode

Enable debug logging:
```typescript
const DEBUG_WEBHOOK = process.env.NODE_ENV === 'development';

if (DEBUG_WEBHOOK) {
  console.log('Webhook request:', req.body);
  console.log('Tool execution result:', result);
}
```

## Future Enhancements

1. **Additional Tools**
   - Calendar management
   - Task creation
   - File operations
   - CRM integrations

2. **Advanced Features**
   - Email templates
   - Scheduled sending
   - Email tracking
   - Attachment support

3. **Performance Optimizations**
   - Response caching
   - Async processing
   - Batch operations
   - Connection pooling

## Resources

- [ElevenLabs Conversational AI Documentation](https://elevenlabs.io/docs/conversational-ai)
- [Composio Integration Guide](https://docs.composio.dev)
- [Gmail API Reference](https://developers.google.com/gmail/api)
- [OAuth 2.0 Best Practices](https://tools.ietf.org/html/rfc6749) 