# Composio Trigger Webhooks - Internal Documentation

> **Internal Guide**: Monitor external app events through Composio trigger webhooks

## Overview

Composio triggers act as a notification system that enables our application to respond dynamically to external events occurring within user's connected integrations. When events occur in external apps (like Slack messages, GitHub commits, Gmail emails), triggers capture the information and deliver structured payloads to our system via webhooks.

### Key Concepts

- **Triggers**: Event listeners configured for specific apps and event types
- **Webhooks**: HTTP POST requests sent to our application when events occur
- **Payloads**: Structured data containing event information
- **Listeners**: Our application endpoints that process incoming webhook data

### Architecture Flow

```
External App Event → Composio Trigger → Webhook → Our Backend → User Notification/Action
```

## Webhook Delivery Methods

Composio supports two delivery methods:

1. **Webhooks** (Recommended for our use case)
   - HTTP POST requests to publicly accessible URLs
   - Asynchronous event handling
   - Suitable for our backend architecture

2. **WebSockets**
   - Real-time persistent connections
   - Lower latency but requires persistent connections
   - Not ideal for our current serverless architecture

## Feature Implementation Plan

### User Journey

1. **App Selection**: User selects which connected app to monitor (Gmail, Slack, GitHub, etc.)
2. **Event Configuration**: User specifies what events to monitor (new emails, messages, commits, etc.)
3. **Webhook Creation**: System creates a Composio trigger with our webhook endpoint
4. **Event Monitoring**: User receives notifications when events occur
5. **Management**: User can view, edit, or disable triggers

### Required Components

#### 1. Trigger Management Service

```typescript
// services/triggerService.ts
export class TriggerService {
  private composio = new ComposioToolSet();

  async createTrigger(params: {
    userId: string;
    appName: string;
    triggerName: string;
    config: Record<string, any>;
  }) {
    const entity = await this.composio.getEntity(params.userId);
    
    return await entity.setupTrigger({
      triggerName: params.triggerName,
      app: params.appName,
      config: params.config
    });
  }

  async listAvailableTriggers(appName: string) {
    return await this.composio.triggers.list({
      appNames: [appName]
    });
  }

  async getTriggerConfig(triggerId: string) {
    const trigger = await this.composio.triggers.get({
      triggerId
    });
    return trigger.config;
  }
}
```

#### 2. Webhook Handler

```typescript
// api/composio-webhook.ts
export async function handleComposioWebhook(req: Request, res: Response) {
  try {
    const payload = req.body;
    
    // Verify webhook signature
    const isValid = await verifyWebhookSignature(req);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Process the trigger event
    await processTriggerEvent(payload);
    
    return res.json({ status: 'success' });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ error: 'Processing failed' });
  }
}

async function processTriggerEvent(payload: any) {
  const { type, data, metadata } = payload;
  
  // Find user based on entity_id
  const userId = metadata.entity_id;
  
  // Create notification or trigger action
  await notificationService.create({
    userId,
    type: 'trigger_event',
    title: getEventTitle(type),
    message: getEventMessage(data),
    data: payload
  });
}
```

#### 3. Frontend Trigger Setup

```typescript
// components/TriggerSetup.tsx
export function TriggerSetup() {
  const [selectedApp, setSelectedApp] = useState('');
  const [availableTriggers, setAvailableTriggers] = useState([]);
  const [selectedTrigger, setSelectedTrigger] = useState('');
  const [triggerConfig, setTriggerConfig] = useState({});

  const handleAppSelection = async (appName: string) => {
    setSelectedApp(appName);
    const triggers = await triggerService.getAvailableTriggers(appName);
    setAvailableTriggers(triggers);
  };

  const handleTriggerSelection = async (triggerId: string) => {
    setSelectedTrigger(triggerId);
    const config = await triggerService.getTriggerConfig(triggerId);
    setTriggerConfig(config);
  };

  const createTrigger = async () => {
    await triggerService.createTrigger({
      userId,
      appName: selectedApp,
      triggerName: selectedTrigger,
      config: triggerConfig
    });
  };

  return (
    <div>
      <AppSelector onSelect={handleAppSelection} />
      <TriggerSelector 
        triggers={availableTriggers}
        onSelect={handleTriggerSelection}
      />
      <TriggerConfigForm 
        config={triggerConfig}
        onChange={setTriggerConfig}
      />
      <button onClick={createTrigger}>Create Trigger</button>
    </div>
  );
}
```

## Common Trigger Types by App

### Gmail
- `GMAIL_NEW_EMAIL_RECEIVED`: New email received
- `GMAIL_NEW_LABELED_EMAIL`: Email with specific label

**Configuration Example**:
```json
{
  "labelIds": ["INBOX", "IMPORTANT"]
}
```

### Slack
- `SLACK_RECEIVE_MESSAGE`: New message in channel
- `SLACK_NEW_CHANNEL_CREATED`: New channel created

**Configuration Example**:
```json
{
  "channel": "C1234567890"
}
```

### GitHub
- `GITHUB_COMMIT_EVENT`: New commit pushed
- `GITHUB_PULL_REQUEST_EVENT`: PR opened/closed
- `GITHUB_STAR_ADDED_EVENT`: Repository starred

**Configuration Example**:
```json
{
  "owner": "composiohq",
  "repo": "composio"
}
```

### Google Calendar
- `GOOGLECALENDAR_EVENT_CREATED`: New event created
- `GOOGLECALENDAR_EVENT_UPDATED`: Event modified

**Configuration Example**:
```json
{
  "calendarId": "primary"
}
```

## Database Schema

```sql
-- Trigger configurations table
CREATE TABLE trigger_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  app_name VARCHAR(50) NOT NULL,
  trigger_name VARCHAR(100) NOT NULL,
  trigger_id VARCHAR(100) NOT NULL, -- Composio trigger ID
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Trigger events log
CREATE TABLE trigger_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_config_id UUID REFERENCES trigger_configs(id),
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints

### Create Trigger
```http
POST /api/triggers
Content-Type: application/json

{
  "appName": "gmail",
  "triggerName": "GMAIL_NEW_EMAIL_RECEIVED",
  "config": {
    "labelIds": ["INBOX"]
  }
}
```

### List User Triggers
```http
GET /api/triggers
```

### Update Trigger
```http
PUT /api/triggers/:id
Content-Type: application/json

{
  "config": {
    "labelIds": ["INBOX", "IMPORTANT"]
  }
}
```

### Delete Trigger
```http
DELETE /api/triggers/:id
```

### Get Available Triggers for App
```http
GET /api/triggers/available/:appName
```

## Webhook Security

### Signature Verification
```typescript
function verifyWebhookSignature(req: Request): boolean {
  const signature = req.headers['x-composio-signature'];
  const payload = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', process.env.COMPOSIO_WEBHOOK_SECRET!)
    .update(payload)
    .digest('hex');
  
  return signature === expectedSignature;
}
```

### Rate Limiting
- Implement rate limiting on webhook endpoint
- Max 100 requests per minute per user
- Use Redis for rate limit storage

## Error Handling

### Common Error Scenarios

1. **Invalid Trigger Configuration**
   - Missing required config fields
   - Invalid app permissions
   - Solution: Validate config before creation

2. **Webhook Delivery Failures**
   - Network issues
   - Server downtime
   - Solution: Implement retry mechanism with exponential backoff

3. **Authentication Errors**
   - Expired OAuth tokens
   - Revoked permissions
   - Solution: Detect auth errors and prompt user to reconnect

### Error Response Format
```json
{
  "error": "TRIGGER_CONFIG_INVALID",
  "message": "Missing required field: repository",
  "details": {
    "field": "repository",
    "expected": "string"
  }
}
```

## Testing Strategy

### Unit Tests
- Test trigger creation/deletion
- Validate webhook signature verification
- Test configuration validation

### Integration Tests
- End-to-end trigger setup flow
- Webhook delivery and processing
- Error handling scenarios

### Manual Testing Checklist
- [ ] Create trigger for each supported app
- [ ] Verify webhook delivery
- [ ] Test configuration validation
- [ ] Test trigger deletion
- [ ] Verify error handling

## Performance Considerations

### Webhook Processing
- Process webhooks asynchronously
- Use message queues for high-volume events
- Implement idempotency to handle duplicate events

### Database Optimization
- Index on user_id and app_name
- Partition trigger_events table by date
- Archive old events after 90 days

### Monitoring
- Track webhook response times
- Monitor trigger creation/deletion rates
- Alert on webhook delivery failures

## Security Best Practices

1. **Webhook Endpoint Security**
   - Always verify signatures
   - Use HTTPS only
   - Implement rate limiting

2. **Data Privacy**
   - Store minimal necessary data
   - Encrypt sensitive config data
   - Implement data retention policies

3. **Access Control**
   - Users can only manage their own triggers
   - Validate app permissions before trigger creation
   - Audit trigger creation/deletion events

## Deployment Checklist

- [ ] Set up webhook endpoint with proper security
- [ ] Configure Composio webhook URL in dashboard
- [ ] Set up database tables and indexes
- [ ] Deploy trigger management APIs
- [ ] Implement frontend trigger setup UI
- [ ] Set up monitoring and alerts
- [ ] Create user documentation
- [ ] Test with real external app events

## Future Enhancements

### Advanced Features
- **Trigger Conditions**: Add filters to trigger only on specific conditions
- **Trigger Actions**: Automatically execute actions when triggers fire
- **Batch Processing**: Group multiple events for efficient processing
- **Analytics**: Show trigger statistics and event history

### UI Improvements
- **Trigger Templates**: Pre-configured triggers for common use cases
- **Event Preview**: Show sample payloads for each trigger type
- **Trigger Testing**: Test triggers with mock events
- **Visual Trigger Builder**: Drag-and-drop trigger configuration

## Resources

- [Composio Triggers Official Documentation](https://docs.composio.dev/framework/triggers)
- [Webhook Best Practices](https://webhooks.fyi/)
- [Composio Dashboard Trigger Logs](https://app.composio.dev/trigger_logs)
- [ngrok for Local Development](https://ngrok.com/docs) 