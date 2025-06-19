# Composio Triggers & Event Handling - Technical Reference

> **Technical Guide**: Complete reference for implementing Composio triggers and event handling in Voxe

## Overview

Composio's Trigger system enables applications to respond to external events occurring in integrated services like GitHub, Slack, Gmail, and more. This system transforms applications from reactive (user asks → AI responds) to proactive (external event occurs → AI responds automatically).

### Architecture Flow

```
External App Event → Composio Platform → Trigger System → Event Delivery → Voxe Backend → User Notification/AI Action
```

## Core Components

### 1. Trigger Architecture

The trigger system consists of several interconnected components:

- **Trigger Types**: Predefined event types (e.g., `SLACK_RECEIVE_MESSAGE`, `GITHUB_COMMIT_EVENT`)
- **Trigger Config**: Configuration settings specific to each trigger type
- **Active Triggers**: Enabled trigger instances associated with connected accounts
- **Trigger Subscriptions**: Websocket or webhook connections that receive event notifications
- **Callback Functions**: Application code that runs when events are received

### 2. Data Models

#### TriggerModel
```typescript
interface TriggerModel {
  name: string;
  display_name: string;
  description: string;
  payload: TriggerPayloadModel;
  config: TriggerConfigModel;
  appId: string;
  appName: string;
}
```

#### TriggerConfigModel
```typescript
interface TriggerConfigModel {
  properties: Record<string, any>;
  title: string;
  type: string;
  required: string[];
}
```

#### TriggerEventData
```typescript
interface TriggerEventData {
  appName: string;
  payload: Record<string, any>;
  metadata: {
    connectionId: string;
    entityId: string;
    integrationId: string;
    triggerId: string;
  };
}
```

#### ActiveTriggerModel
```typescript
interface ActiveTriggerModel {
  id: string;
  connectionId: string;
  triggerName: string;
  active: boolean;
}
```

## Enabling Triggers

### Method 1: Using ComposioToolSet API

```typescript
import { ComposioToolSet } from 'composio-core';

const toolset = new ComposioToolSet();

// Get an entity (user/connection)
const entity = await toolset.getEntity("default"); // Or specific entity ID

// Enable a trigger for a connected service
const response = await entity.setupTrigger({
  app: "github",
  triggerName: "GITHUB_PULL_REQUEST_EVENT",
  config: { 
    owner: "username", 
    repo: "repository-name" 
  }
});
```

### Method 2: Using Command Line

```bash
# List available triggers
composio triggers

# Enable a specific trigger
composio triggers enable SLACK_RECEIVE_MESSAGE
```

### Method 3: Using Composio Dashboard

Navigate to the specific app in the Composio dashboard and enable triggers through the UI.

## Trigger Configuration

Many triggers require specific configuration parameters. You can inspect the required configuration:

```typescript
// Get trigger configuration schema
const trigger = await toolset.triggers.get({
  triggerId: "GITHUB_STAR_ADDED_EVENT"
});

console.log(JSON.stringify(trigger.config, null, 2));
```

### Common Configuration Examples

#### GitHub Triggers
```json
{
  "owner": "composiohq",
  "repo": "composio"
}
```

#### Slack Triggers
```json
{
  "channel": "C1234567890"
}
```

#### Gmail Triggers
```json
{
  "labelIds": ["INBOX", "IMPORTANT"]
}
```

#### Google Calendar Triggers
```json
{
  "calendarId": "primary"
}
```

## Event Listening

Composio supports two delivery methods for events:

### 1. Websocket Listeners (Recommended for Real-time)

Websockets provide real-time delivery through persistent connections:

```typescript
import { ComposioToolSet } from 'composio-core';

const toolset = new ComposioToolSet();

// Create a trigger listener
const listener = toolset.triggers.subscribe(
  (event: TriggerEventData) => {
    // Process the event data
    console.log(`Received event: ${event.payload}`);
    console.log(`From app: ${event.appName}`);
    console.log(`Connection ID: ${event.metadata.connectionId}`);
  },
  {
    triggerName: "SLACK_RECEIVE_MESSAGE"
    // Optional: Additional filters
  }
);
```

### 2. Webhook Listeners (For Our Backend)

For server-side applications, webhooks are more suitable:

```typescript
// Backend webhook endpoint
import { Request, Response } from 'express';

export async function handleComposioTriggerWebhook(req: Request, res: Response) {
  try {
    const payload: TriggerEventData = req.body;
    
    // Verify webhook signature
    const isValid = await verifyWebhookSignature(req);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Process the event
    await processTriggerEvent(payload);
    
    return res.json({ status: 'success' });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ error: 'Processing failed' });
  }
}

async function processTriggerEvent(event: TriggerEventData) {
  const { appName, payload, metadata } = event;
  
  // Route to appropriate handler based on app and trigger type
  switch (appName) {
    case 'SLACK':
      await handleSlackEvent(payload, metadata);
      break;
    case 'GITHUB':
      await handleGitHubEvent(payload, metadata);
      break;
    case 'GMAIL':
      await handleGmailEvent(payload, metadata);
      break;
    default:
      console.log(`Unhandled app: ${appName}`);
  }
}
```

## Event Filtering

Filter events based on various criteria:

```typescript
interface EventFilters {
  app_name?: string;        // "SLACK", "GITHUB"
  trigger_name?: string;    // "SLACK_RECEIVE_MESSAGE"
  trigger_id?: string;      // "trig_123456"
  connection_id?: string;   // "conn_123456"
  entity_id?: string;       // "default" or user ID
  integration_id?: string;  // "int_123456"
}

// Example: Multiple filtered listeners
const slackListener = toolset.triggers.subscribe(
  handleSlackEvents,
  { app_name: "SLACK" }
);

const githubCommitListener = toolset.triggers.subscribe(
  handleGitHubCommits,
  { trigger_name: "GITHUB_COMMIT_EVENT" }
);

const specificConnectionListener = toolset.triggers.subscribe(
  handleSpecificConnection,
  { connection_id: "conn_123456" }
);
```

## Event Processing Workflow

The event flow follows this sequence:

1. **External Event Occurs** (new message, commit, etc.)
2. **Composio Captures Event** and formats into `TriggerEventData`
3. **Event Delivery** via webhook or websocket
4. **Filter Matching** against registered filters
5. **Callback Execution** of matching handlers
6. **Business Logic** processing based on event

### Processing Implementation

```typescript
class TriggerEventProcessor {
  private handlers: Map<string, (event: TriggerEventData) => Promise<void>>;

  constructor() {
    this.handlers = new Map();
    this.setupHandlers();
  }

  private setupHandlers() {
    // Slack message handler
    this.handlers.set('SLACK_RECEIVE_MESSAGE', async (event) => {
      const message = event.payload.text;
      const channel = event.payload.channel;
      const user = event.payload.user;
      
      // Process with AI agent
      await this.processSlackMessage(message, channel, user, event.metadata);
    });

    // GitHub PR handler
    this.handlers.set('GITHUB_PULL_REQUEST_EVENT', async (event) => {
      const pr = event.payload.pull_request;
      const action = event.payload.action; // opened, closed, etc.
      
      // Process PR event
      await this.processGitHubPR(pr, action, event.metadata);
    });

    // Gmail handler
    this.handlers.set('GMAIL_NEW_EMAIL_RECEIVED', async (event) => {
      const email = event.payload;
      
      // Process new email
      await this.processNewEmail(email, event.metadata);
    });
  }

  async processEvent(event: TriggerEventData) {
    const handler = this.handlers.get(event.payload.trigger_name);
    if (handler) {
      await handler(event);
    } else {
      console.log(`No handler for trigger: ${event.payload.trigger_name}`);
    }
  }

  private async processSlackMessage(message: string, channel: string, user: string, metadata: any) {
    // Integrate with existing AI agent
    const response = await aiService.processMessage({
      content: message,
      context: {
        platform: 'slack',
        channel,
        user,
        triggerId: metadata.triggerId
      }
    });

    // Optionally respond back to Slack
    if (response.shouldReply) {
      await slackService.sendMessage(channel, response.message);
    }
  }
}
```

## Managing Active Triggers

### Listing Active Triggers

```typescript
// Get all active triggers for an entity
const entity = await toolset.getEntity(userId);
const activeTriggers = await entity.getActiveTriggers();

// Or filter by specific criteria
const filteredTriggers = await toolset.getActiveTriggers({
  triggerNames: ["GITHUB_COMMIT_EVENT"],
  connectedAccountIds: ["conn_123456"]
});

for (const trigger of activeTriggers) {
  console.log(`Trigger: ${trigger.triggerName}, Active: ${trigger.active}`);
}
```

### Disabling Triggers

```typescript
// Disable a specific trigger
const triggerIdToDisable = activeTriggers[0].id;
const success = await toolset.deleteTrigger(triggerIdToDisable);

// Or using entity
const success = await entity.disableTrigger(triggerIdToDisable);
```

### Updating Trigger Configuration

```typescript
// Update trigger config
await entity.updateTrigger(triggerId, {
  config: {
    labelIds: ["INBOX", "IMPORTANT", "URGENT"]
  }
});
```

## Common Use Cases & Implementations

### 1. Slack Bot Integration

```typescript
// Real-time Slack message processing
const slackTrigger = await entity.setupTrigger({
  app: "slack",
  triggerName: "SLACK_RECEIVE_MESSAGE",
  config: { channel: "C1234567890" }
});

toolset.triggers.subscribe(
  async (event) => {
    const message = event.payload.text;
    const channel = event.payload.channel;
    
    // Process with AI
    const aiResponse = await aiService.chat({
      message,
      userId: event.metadata.entityId,
      context: { platform: 'slack', channel }
    });
    
    // Send response back
    await composioService.executeAction({
      action: 'SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL',
      params: {
        channel,
        text: aiResponse,
        thread_ts: event.payload.ts
      },
      entityId: event.metadata.entityId
    });
  },
  { trigger_name: "SLACK_RECEIVE_MESSAGE" }
);
```

### 2. GitHub PR Review Bot

```typescript
// Automated PR reviews
await entity.setupTrigger({
  app: "github",
  triggerName: "GITHUB_PULL_REQUEST_EVENT",
  config: { owner: "your-org", repo: "your-repo" }
});

toolset.triggers.subscribe(
  async (event) => {
    if (event.payload.action === 'opened') {
      const pr = event.payload.pull_request;
      
      // Generate AI review
      const review = await aiService.reviewPR({
        title: pr.title,
        body: pr.body,
        diff: pr.diff_url
      });
      
      // Post review comment
      await composioService.executeAction({
        action: 'GITHUB_CREATE_ISSUE_COMMENT',
        params: {
          owner: "your-org",
          repo: "your-repo",
          issue_number: pr.number,
          body: review
        },
        entityId: event.metadata.entityId
      });
    }
  },
  { trigger_name: "GITHUB_PULL_REQUEST_EVENT" }
);
```

### 3. Email Processing Assistant

```typescript
// Automated email processing
await entity.setupTrigger({
  app: "gmail",
  triggerName: "GMAIL_NEW_EMAIL_RECEIVED",
  config: { labelIds: ["INBOX"] }
});

toolset.triggers.subscribe(
  async (event) => {
    const email = event.payload;
    
    // Analyze email with AI
    const analysis = await aiService.analyzeEmail({
      from: email.from,
      subject: email.subject,
      body: email.body
    });
    
    // Take appropriate action
    if (analysis.isUrgent) {
      await notificationService.sendUrgentAlert(
        event.metadata.entityId,
        `Urgent email from ${email.from}: ${email.subject}`
      );
    }
    
    if (analysis.requiresResponse) {
      const draft = await aiService.generateEmailResponse(email);
      // Save as draft or send notification to user
      await gmailService.createDraft(draft, event.metadata.entityId);
    }
  },
  { trigger_name: "GMAIL_NEW_EMAIL_RECEIVED" }
);
```

## Integration with Voxe Architecture

### Database Schema Extensions

```sql
-- Add to existing schema
CREATE TABLE trigger_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  app_name VARCHAR(50) NOT NULL,
  trigger_name VARCHAR(100) NOT NULL,
  composio_trigger_id VARCHAR(100) NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_trigger_configs_user_app ON trigger_configs (user_id, app_name);
CREATE INDEX idx_trigger_configs_active ON trigger_configs (is_active);

-- Event processing log
CREATE TABLE trigger_events_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_config_id UUID REFERENCES trigger_configs(id),
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMP DEFAULT NOW(),
  processing_status VARCHAR(20) DEFAULT 'success', -- success, failed, pending
  error_message TEXT
);

-- Partition by date for performance
CREATE INDEX idx_trigger_events_log_date ON trigger_events_log (processed_at);
```

### Service Integration

```typescript
// services/triggerEventService.ts
export class TriggerEventService {
  constructor(
    private composioService: ComposioService,
    private aiService: AIService,
    private notificationService: NotificationService,
    private memoryService: MemoryService
  ) {}

  async processEvent(event: TriggerEventData) {
    try {
      // Log the event
      await this.logEvent(event);
      
      // Find user
      const userId = await this.getUserFromEntityId(event.metadata.entityId);
      
      // Process based on trigger type
      await this.routeEventToHandler(event, userId);
      
      // Update user memory with event context
      await this.memoryService.addContext(userId, {
        type: 'trigger_event',
        app: event.appName,
        summary: this.generateEventSummary(event)
      });
      
    } catch (error) {
      console.error('Event processing failed:', error);
      await this.handleProcessingError(event, error);
    }
  }

  private async routeEventToHandler(event: TriggerEventData, userId: string) {
    const handlerKey = `${event.appName}_${event.payload.trigger_name}`;
    
    switch (handlerKey) {
      case 'SLACK_SLACK_RECEIVE_MESSAGE':
        await this.handleSlackMessage(event, userId);
        break;
      case 'GITHUB_GITHUB_COMMIT_EVENT':
        await this.handleGitHubCommit(event, userId);
        break;
      case 'GMAIL_GMAIL_NEW_EMAIL_RECEIVED':
        await this.handleNewEmail(event, userId);
        break;
      default:
        await this.handleGenericEvent(event, userId);
    }
  }

  private async handleSlackMessage(event: TriggerEventData, userId: string) {
    const message = event.payload.text;
    const channel = event.payload.channel;
    
    // Check if this should trigger an AI response
    const shouldRespond = await this.shouldRespondToSlackMessage(message, userId);
    
    if (shouldRespond) {
      // Generate AI response
      const response = await this.aiService.chat({
        message,
        userId,
        context: {
          platform: 'slack',
          channel,
          triggerEvent: true
        }
      });
      
      // Send response
      await this.composioService.executeAction({
        action: 'SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL',
        params: {
          channel,
          text: response,
          thread_ts: event.payload.ts
        },
        entityId: event.metadata.entityId
      });
    }
    
    // Always notify user
    await this.notificationService.create({
      userId,
      type: 'slack_message',
      title: 'New Slack Message',
      message: `Message in ${channel}: ${message.substring(0, 100)}...`,
      data: event.payload
    });
  }
}
```

## Error Handling

### Common Error Types

```typescript
import { 
  TriggerSubscriptionError, 
  InvalidTriggerFilters, 
  SDKTimeoutError 
} from 'composio-core';

export class TriggerErrorHandler {
  static async handleTriggerSetup(triggerSetup: () => Promise<void>) {
    try {
      await triggerSetup();
    } catch (error) {
      if (error instanceof InvalidTriggerFilters) {
        console.error('Invalid filter configuration:', error.message);
        throw new Error('Trigger configuration is invalid');
      } else if (error instanceof TriggerSubscriptionError) {
        console.error('Subscription error:', error.message);
        throw new Error('Failed to subscribe to events');
      } else if (error instanceof SDKTimeoutError) {
        console.error('Connection timed out:', error.message);
        throw new Error('Connection timeout');
      } else {
        console.error('Unknown trigger error:', error);
        throw error;
      }
    }
  }

  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        
        console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
    
    throw new Error('Max retries exceeded');
  }
}
```

### Connection Monitoring

```typescript
export class TriggerConnectionMonitor {
  private listeners: Map<string, any> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();

  async monitorConnection(listenerId: string, listener: any) {
    this.listeners.set(listenerId, listener);
    
    // Check connection health periodically
    const healthCheck = setInterval(() => {
      if (listener.hasErrored && listener.hasErrored()) {
        console.log(`Connection ${listenerId} has errored, attempting restart...`);
        this.handleConnectionError(listenerId, listener);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(healthCheck);
  }

  private async handleConnectionError(listenerId: string, listener: any) {
    const attempts = this.reconnectAttempts.get(listenerId) || 0;
    
    if (attempts >= 5) {
      console.error(`Max reconnection attempts reached for ${listenerId}`);
      this.notifyConnectionFailure(listenerId);
      return;
    }

    this.reconnectAttempts.set(listenerId, attempts + 1);
    
    try {
      await listener.restart();
      this.reconnectAttempts.set(listenerId, 0); // Reset on success
      console.log(`Successfully reconnected ${listenerId}`);
    } catch (error) {
      console.error(`Reconnection failed for ${listenerId}:`, error);
      // Try again with exponential backoff
      setTimeout(() => {
        this.handleConnectionError(listenerId, listener);
      }, Math.pow(2, attempts) * 1000);
    }
  }

  private notifyConnectionFailure(listenerId: string) {
    // Notify relevant services about connection failure
    console.error(`Connection ${listenerId} permanently failed`);
  }
}
```

## Performance Considerations

### Event Processing Optimization

```typescript
export class TriggerEventQueue {
  private queue: TriggerEventData[] = [];
  private processing = false;
  private batchSize = 10;
  private processingDelay = 1000;

  async addEvent(event: TriggerEventData) {
    this.queue.push(event);
    
    if (!this.processing) {
      this.processBatch();
    }
  }

  private async processBatch() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, this.batchSize);
        
        // Process events in parallel
        await Promise.all(
          batch.map(event => this.processEventSafely(event))
        );
        
        // Small delay between batches
        if (this.queue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, this.processingDelay));
        }
      }
    } finally {
      this.processing = false;
    }
  }

  private async processEventSafely(event: TriggerEventData) {
    try {
      await triggerEventService.processEvent(event);
    } catch (error) {
      console.error('Event processing failed:', error);
      // Could implement dead letter queue here
    }
  }
}
```

## Security Best Practices

### Webhook Signature Verification

```typescript
import crypto from 'crypto';

export function verifyComposioWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(`sha256=${expectedSignature}`)
  );
}

export function sanitizeEventPayload(payload: any): any {
  // Remove sensitive fields that shouldn't be logged
  const sanitized = { ...payload };
  
  // Remove potential sensitive data
  delete sanitized.access_token;
  delete sanitized.refresh_token;
  delete sanitized.api_key;
  
  return sanitized;
}
```

## Testing Strategy

### Unit Tests

```typescript
describe('TriggerEventService', () => {
  it('should process Slack message events', async () => {
    const mockEvent: TriggerEventData = {
      appName: 'SLACK',
      payload: {
        trigger_name: 'SLACK_RECEIVE_MESSAGE',
        text: 'Hello world',
        channel: 'C123456',
        user: 'U123456',
        ts: '1234567890.123456'
      },
      metadata: {
        entityId: 'user-123',
        connectionId: 'conn-123',
        integrationId: 'int-123',
        triggerId: 'trig-123'
      }
    };

    await triggerEventService.processEvent(mockEvent);
    
    expect(notificationService.create).toHaveBeenCalledWith({
      userId: 'user-123',
      type: 'slack_message',
      title: 'New Slack Message',
      message: expect.stringContaining('Hello world')
    });
  });
});
```

### Integration Tests

```typescript
describe('Trigger Integration', () => {
  it('should handle end-to-end trigger flow', async () => {
    // Enable trigger
    const trigger = await entity.setupTrigger({
      app: 'github',
      triggerName: 'GITHUB_COMMIT_EVENT',
      config: { owner: 'test', repo: 'test' }
    });
    
    // Simulate webhook event
    const response = await request(app)
      .post('/api/composio-webhook')
      .send(mockGitHubCommitEvent)
      .expect(200);
    
    // Verify processing
    expect(response.body.status).toBe('success');
  });
});
```

## Monitoring & Observability

### Metrics to Track

- Trigger setup success/failure rates
- Event processing latency
- Webhook delivery success rates
- Connection health status
- Event queue length
- Error rates by trigger type

### Implementation

```typescript
export class TriggerMetrics {
  static trackTriggerSetup(appName: string, success: boolean) {
    metrics.increment('trigger.setup', {
      app: appName,
      success: success.toString()
    });
  }

  static trackEventProcessing(triggerName: string, duration: number) {
    metrics.timing('trigger.event.processing_time', duration, {
      trigger: triggerName
    });
  }

  static trackWebhookDelivery(success: boolean, statusCode?: number) {
    metrics.increment('trigger.webhook.delivery', {
      success: success.toString(),
      status_code: statusCode?.toString() || 'unknown'
    });
  }
}
```

## Deployment Checklist

- [ ] Set up webhook endpoint with proper security
- [ ] Configure Composio webhook URL in dashboard
- [ ] Set up database tables and indexes
- [ ] Deploy trigger management APIs
- [ ] Implement trigger event processing service
- [ ] Set up event queue and processing
- [ ] Configure monitoring and alerting
- [ ] Test with real external app events
- [ ] Set up error handling and retry logic
- [ ] Configure rate limiting and security
- [ ] Document trigger setup process for users

## Future Enhancements

### Advanced Features
- **Conditional Triggers**: Add filters to trigger only on specific conditions
- **Trigger Chains**: Chain multiple triggers for complex workflows
- **Event Aggregation**: Batch similar events for efficient processing
- **Custom Webhooks**: Allow users to add their own webhook URLs
- **Event Replay**: Ability to replay failed events
- **Trigger Analytics**: Show statistics and insights about trigger usage

### Performance Improvements
- **Event Deduplication**: Prevent duplicate event processing
- **Smart Filtering**: Client-side event filtering to reduce load
- **Horizontal Scaling**: Distribute event processing across multiple instances
- **Event Streaming**: Use streaming protocols for high-volume events

## Resources

- [Composio Triggers Official Documentation](https://docs.composio.dev/framework/triggers)
- [Webhook Security Best Practices](https://webhooks.fyi/)
- [Event-Driven Architecture Patterns](https://microservices.io/patterns/data/event-driven-architecture.html)
- [Composio Dashboard Trigger Logs](https://app.composio.dev/trigger_logs) 