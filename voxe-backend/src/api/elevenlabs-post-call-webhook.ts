import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { addMemories } from '@mem0/vercel-ai-provider';

const postCallRouter = express.Router();

// Middleware to parse raw body from buffer (set up in main app)
function parseRawBody(req: Request, res: Response, next: NextFunction): void {
  if (req.body && Buffer.isBuffer(req.body)) {
    (req as any).rawBody = req.body.toString('utf8');
    try {
      req.body = JSON.parse((req as any).rawBody);
    } catch (error) {
      console.error('❌ Failed to parse JSON body:', error);
      res.status(400).json({ error: 'Invalid JSON' });
      return;
    }
  }
  next();
}

postCallRouter.use(parseRawBody);

// ElevenLabs Post-Call Webhook Format (from docs)
interface ElevenLabsPostCallEvent {
  type: 'post_call_transcription';
  event_timestamp: number;
  data: {
    agent_id: string;
    conversation_id: string;
    status: string;
    transcript: Array<{
      role: 'agent' | 'user';
      message: string;
      tool_calls?: any;
      tool_results?: any;
      feedback?: any;
      time_in_call_secs: number;
      conversation_turn_metrics?: any;
    }>;
    metadata: {
      start_time_unix_secs: number;
      call_duration_secs: number;
      cost: number;
      deletion_settings?: any;
      feedback?: any;
      authorization_method?: string;
      charging?: any;
      termination_reason?: string;
    };
    analysis: {
      evaluation_criteria_results: Record<string, any>;
      data_collection_results: Record<string, any>;
      call_successful: string;
      transcript_summary: string;
    };
    conversation_initiation_client_data?: {
      conversation_config_override?: any;
      custom_llm_extra_body?: any;
      dynamic_variables?: {
        user_id?: string;
        user_name?: string;
        [key: string]: any;
      };
    };
  };
}

// Webhook signature verification - matches ElevenLabs documentation format
function verifyWebhookSignature(req: Request, res: Response, next: NextFunction): void {
  const signature = req.headers['elevenlabs-signature'] as string;
  const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  
  console.log('🔐 Webhook signature verification:', {
    hasSignature: !!signature,
    hasSecret: !!webhookSecret,
    signature: signature ? signature.substring(0, 20) + '...' : 'none'
  });
  
  if (webhookSecret && signature) {
    try {
      const parts = signature.split(',');
      const timestamp = parts.find((e) => e.startsWith('t='))?.substring(2);
      const hmacSignature = parts.find((e) => e.startsWith('v0='));
      
      if (!timestamp || !hmacSignature) {
        console.error('❌ Invalid signature format');
        res.status(401).json({ error: 'Invalid signature format' });
        return;
      }
      
      // Validate timestamp (within 30 minutes tolerance)
      const reqTimestamp = parseInt(timestamp);
      const currentTime = Math.floor(Date.now() / 1000);
      const tolerance = currentTime - 30 * 60; // 30 minutes ago
      
      if (reqTimestamp < tolerance) {
        console.error('❌ Request expired', { reqTimestamp, currentTime, tolerance });
        res.status(403).json({ error: 'Request expired' });
        return;
      }
      
      // Validate HMAC signature using raw body
      const fullPayloadToSign = `${timestamp}.${(req as any).rawBody || JSON.stringify(req.body)}`;
      const expectedDigest = 'v0=' + crypto.createHmac('sha256', webhookSecret)
        .update(fullPayloadToSign, 'utf8')
        .digest('hex');
      
      console.log('🔍 Signature verification details:', {
        timestamp,
        payloadLength: fullPayloadToSign.length,
        expectedDigest: expectedDigest.substring(0, 20) + '...',
        receivedSignature: hmacSignature.substring(0, 20) + '...',
        match: hmacSignature === expectedDigest
      });
      
      if (hmacSignature !== expectedDigest) {
        console.error('❌ Invalid signature');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
      
      console.log('✅ Webhook signature verified');
    } catch (error) {
      console.error('❌ Signature verification error:', error);
      res.status(401).json({ error: 'Signature verification failed' });
      return;
    }
  } else if (webhookSecret) {
    console.error('❌ Missing signature header');
    res.status(401).json({ error: 'Missing signature header' });
    return;
  } else {
    console.log('⚠️ No webhook secret configured - skipping signature verification');
  }
  
  next();
}

async function handlePostCallWebhook(req: Request, res: Response) {
  try {
    console.log('📞 ElevenLabs post-call webhook received');
    console.log('📄 Raw payload:', JSON.stringify(req.body, null, 2));

    const event: ElevenLabsPostCallEvent = req.body;

    // Validate event structure
    if (!event.type || event.type !== 'post_call_transcription') {
      console.log(`ℹ️ Ignoring non-transcription event: ${event.type}`);
      return res.status(200).json({ received: true, message: 'Event type not processed' });
    }

    const { data } = event;
    const { conversation_id, agent_id, transcript, analysis, metadata, conversation_initiation_client_data } = data;

    // Extract user ID from dynamic variables or fallback
    let userId = conversation_initiation_client_data?.dynamic_variables?.user_id ||
                 req.headers['x-user-id'] as string;

    // Development fallback
    if (!userId && (process.env.NODE_ENV === 'development' || process.env.ALLOW_FALLBACK_USER === 'true')) {
      console.log('⚠️ POST-CALL: Using fallback user ID for development');
      userId = 'e58e50aa-fd9d-499e-a977-f9b8b065f8b4';
    }

    if (!userId) {
      console.error('❌ POST-CALL: Missing user_id for conversation:', conversation_id);
      return res.status(400).json({ 
        error: 'Missing user_id',
        conversation_id,
        message: 'User identification required for memory storage'
      });
    }

    console.log(`📝 Processing conversation for user: ${userId}`);
    console.log(`📊 Conversation stats:`, {
      conversation_id,
      messages: transcript?.length || 0,
      duration: metadata.call_duration_secs,
      successful: analysis.call_successful,
      cost: metadata.cost
    });

    // Convert transcript to Mem0 message format
    const memoryMessages = transcript?.filter(msg => 
      msg.message && 
      msg.message.trim().length > 0 && 
      msg.message !== null && 
      msg.message !== undefined
    ).map(msg => ({
      role: msg.role === 'agent' ? 'assistant' as const : 'user' as const,
      content: [{ type: 'text' as const, text: msg.message.trim() }]
    })) || [];

    // Add conversation summary for context
    if (analysis.transcript_summary) {
      memoryMessages.push({
        role: 'assistant' as const,
        content: [{ 
          type: 'text' as const, 
          text: `Voice conversation summary: ${analysis.transcript_summary}. Duration: ${metadata.call_duration_secs}s. Status: ${analysis.call_successful}.`
        }]
      });
    }

    // Store memories in Mem0
    try {
      console.log(`📝 Preparing to store ${memoryMessages.length} memory messages for user ${userId}`);
      console.log('🔍 Sample messages:', JSON.stringify(memoryMessages.slice(0, 2), null, 2));
      
      if (memoryMessages.length === 0) {
        console.log('⚠️ No valid messages to store in memory');
        return res.status(200).json({
          received: true,
          processed: true,
          conversation_id,
          user_id: userId,
          memories_stored: 0,
          status: 'success',
          message: 'No valid messages to store'
        });
      }

      await addMemories(memoryMessages, {
        user_id: userId,
        app_id: 'voxe-voice',
        run_id: conversation_id,
        metadata: {
          conversation_id,
          agent_id,
          source: 'elevenlabs_voice',
          duration_seconds: metadata.call_duration_secs,
          cost: metadata.cost,
          call_successful: analysis.call_successful,
          transcript_summary: analysis.transcript_summary,
          timestamp: new Date(metadata.start_time_unix_secs * 1000).toISOString()
        }
      });

      console.log(`✅ Successfully stored voice conversation memories for user ${userId}`);
      console.log(`💾 Stored ${memoryMessages.length} messages in Mem0`);

    } catch (memoryError) {
      console.error('❌ Failed to store conversation memories:', memoryError);
      
      // Log detailed error information
      if (memoryError instanceof Error) {
        console.error('❌ Memory error details:', {
          message: memoryError.message,
          stack: memoryError.stack,
          userId,
          messageCount: memoryMessages.length
        });
      }
      
      // Don't fail the webhook if memory storage fails - return success anyway
      return res.status(200).json({
        received: true,
        processed: true,
        conversation_id,
        user_id: userId,
        memories_stored: 0,
        status: 'partial_success',
        memory_error: memoryError instanceof Error ? memoryError.message : 'Unknown memory error'
      });
    }

    // Return success response
    return res.status(200).json({
      received: true,
      processed: true,
      conversation_id,
      user_id: userId,
      memories_stored: memoryMessages.length,
      status: 'success'
    });

  } catch (error) {
    console.error('❌ Post-call webhook error:', error);
    
    return res.status(500).json({
      received: true,
      processed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}

// Register the post-call webhook route
postCallRouter.post('/', verifyWebhookSignature, async (req: Request, res: Response): Promise<void> => {
  await handlePostCallWebhook(req, res);
});

// Health check endpoint
postCallRouter.get('/', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy',
    service: 'elevenlabs-post-call-webhook',
    endpoint: '/api/elevenlabs-post-call-webhook',
    timestamp: new Date().toISOString()
  });
});

export default postCallRouter; 