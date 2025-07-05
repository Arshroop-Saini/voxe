import express, { Request, Response } from 'express';
import { elevenLabsVoiceService } from '../lib/ai/elevenlabs-voice.js';
import redisService, { StreamingSession } from '../lib/redis.js';

const elevenLabsPostCallRouter = express.Router();

// Global WebSocket server instance (to be set during initialization)
let webSocketServer: any = null;

// Function to set the WebSocket server instance
export function setWebSocketServer(server: any) {
  webSocketServer = server;
}

// Handle ElevenLabs post-call webhook
async function handlePostCallWebhook(req: Request, res: Response): Promise<void> {
  try {
    console.log('🎤 ElevenLabs post-call webhook received:', JSON.stringify(req.body, null, 2));

    // Validate webhook signature if needed
    // const signature = req.headers['x-elevenlabs-signature'];
    // if (!validateSignature(req.body, signature)) {
    //   return res.status(401).json({ error: 'Invalid signature' });
    // }

    // Process the webhook data
    const conversationSummary = await elevenLabsVoiceService.processPostCallWebhook(req.body);

    if (!conversationSummary) {
      console.log('📝 No conversation summary to process');
      res.status(200).json({ success: true, message: 'No processing needed' });
      return;
    }

    const { conversationId, agentId, transcript, metadata, analysis, toolCalls } = conversationSummary;

    console.log('📄 Processing conversation summary:', {
      conversationId,
      agentId,
      transcriptLength: transcript?.length || 0,
      toolCallsCount: toolCalls?.length || 0,
      metadata
    });

    // Find the related streaming session
    const streamingSession = await findStreamingSessionByConversationId(conversationId);
    
    if (streamingSession) {
      // Update the streaming session with conversation results
      await redisService.updateStreamingSession(streamingSession.sessionId, {
        transcription: extractTranscriptionText(transcript),
        aiResponse: extractAIResponse(transcript),
        toolsUsed: toolCalls,
        processingTime: calculateProcessingTime(streamingSession.startTime),
        status: 'completed',
        error: undefined
      });

      // Notify the mobile app about the completion
      if (webSocketServer) {
        const io = webSocketServer.getIO();
        if (io) {
          io.to(`user:${streamingSession.userId}`).emit('glasses:conversation_completed', {
            deviceId: streamingSession.deviceId,
            sessionId: streamingSession.sessionId,
            conversationId,
            transcription: extractTranscriptionText(transcript),
            aiResponse: extractAIResponse(transcript),
            toolsUsed: toolCalls,
            processingTime: calculateProcessingTime(streamingSession.startTime),
            timestamp: new Date().toISOString()
          });

          // Send summary to the glasses device if still connected
          const userGlasses = webSocketServer.getConnectedGlasses(streamingSession.userId);
          const glassesSocket = userGlasses.find((g: any) => g.deviceId === streamingSession.deviceId);
          if (glassesSocket) {
            io.to(glassesSocket.id).emit('conversation:summary', {
              sessionId: streamingSession.sessionId,
              conversationId,
              summary: extractConversationSummary(analysis),
              timestamp: new Date().toISOString()
            });
          }
        }
      }

      console.log('✅ Post-call processing completed for session:', streamingSession.sessionId);
    } else {
      console.warn('⚠️ No streaming session found for conversation:', conversationId);
    }

    res.status(200).json({ 
      success: true, 
      message: 'Post-call webhook processed successfully',
      conversationId,
      sessionId: streamingSession?.sessionId
    });

  } catch (error) {
    console.error('❌ ElevenLabs post-call webhook error:', error);
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process post-call webhook',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// Helper function to find streaming session by conversation ID
async function findStreamingSessionByConversationId(conversationId: string): Promise<StreamingSession | null> {
  try {
    // This is a simplified approach - in a real implementation, you might want to:
    // 1. Store conversation ID to session ID mapping in Redis
    // 2. Or search through active sessions
    
    // For now, we'll need to implement a proper mapping system
    // This is a placeholder that would need to be implemented based on your Redis structure
    
    console.log('🔍 Looking for streaming session with conversation ID:', conversationId);
    
    // TODO: Implement proper session lookup by conversation ID
    // This would require storing the mapping when the conversation starts
    // For now, we'll return null as we need to implement the mapping logic
    
    return null;
  } catch (error) {
    console.error('❌ Error finding streaming session:', error);
    return null;
  }
}

// Helper function to extract transcription text from transcript
function extractTranscriptionText(transcript: any[]): string {
  if (!Array.isArray(transcript)) return '';
  
  return transcript
    .filter(entry => entry.role === 'user' && entry.content_type === 'text')
    .map(entry => entry.content)
    .join(' ');
}

// Helper function to extract AI response from transcript
function extractAIResponse(transcript: any[]): string {
  if (!Array.isArray(transcript)) return '';
  
  return transcript
    .filter(entry => entry.role === 'assistant' && entry.content_type === 'text')
    .map(entry => entry.content)
    .join(' ');
}

// Helper function to extract conversation summary from analysis
function extractConversationSummary(analysis: any): string {
  if (!analysis || typeof analysis !== 'object') return '';
  
  return analysis.summary || analysis.key_points || analysis.overview || '';
}

// Helper function to calculate processing time
function calculateProcessingTime(startTime: number): number {
  return Date.now() - startTime;
}

// Register the webhook route
elevenLabsPostCallRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  await handlePostCallWebhook(req, res);
});

export default elevenLabsPostCallRouter; 