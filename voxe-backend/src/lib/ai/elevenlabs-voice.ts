const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID;

// Log warnings instead of throwing errors for missing environment variables
if (!ELEVENLABS_API_KEY) {
  console.warn('⚠️ ELEVENLABS_API_KEY environment variable not configured. ElevenLabs features will be limited.');
}

if (!ELEVENLABS_AGENT_ID) {
  console.warn('⚠️ ELEVENLABS_AGENT_ID environment variable not configured. ElevenLabs features will be limited.');
}

interface ElevenLabsConversationConfig {
  signedUrl: string;
  agentId: string;
  dynamicVariables: Record<string, any>;
  conversationConfig: {
    agent: {
      prompt: string;
      firstMessage: string;
    };
  };
}

interface ConversationSummary {
  conversationId: string;
  agentId: string;
  transcript: any[];
  metadata: any;
  analysis: any;
  toolCalls: any[];
}

interface ElevenLabsConversation {
  conversation_id: string;
  agent_id: string;
  status: string;
  transcript: any[];
  metadata: any;
  analysis: any;
}

export class ElevenLabsVoiceService {
  /**
   * Get signed URL for WebSocket connection to ElevenLabs agent
   */
  async getSignedUrl(userId: string): Promise<string> {
    try {
      if (!ELEVENLABS_API_KEY) {
        throw new Error('ElevenLabs API key not configured');
      }

      if (!ELEVENLABS_AGENT_ID) {
        throw new Error('ElevenLabs Agent ID not configured');
      }

      console.log('🎙️ Getting ElevenLabs signed URL', { userId, agentId: ELEVENLABS_AGENT_ID });

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${ELEVENLABS_AGENT_ID}`,
        {
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get signed URL: ${response.statusText}`);
      }

      const data = await response.json() as { signed_url: string };
      console.log('✅ Successfully obtained ElevenLabs signed URL', { userId });

      return data.signed_url;
    } catch (error) {
      console.error('❌ Error getting ElevenLabs signed URL', { 
        error: error instanceof Error ? error.message : String(error),
        userId 
      });
      throw error;
    }
  }

  /**
   * Start a conversation session with dynamic variables
   */
  async startConversation(userId: string, deviceId: string, dynamicVariables?: Record<string, any>): Promise<ElevenLabsConversationConfig> {
    try {
      if (!ELEVENLABS_API_KEY) {
        throw new Error('ElevenLabs API key not configured');
      }

      if (!ELEVENLABS_AGENT_ID) {
        throw new Error('ElevenLabs Agent ID not configured');
      }

      console.log('🎙️ Starting ElevenLabs conversation', { 
        userId, 
        deviceId, 
        agentId: ELEVENLABS_AGENT_ID,
        dynamicVariables 
      });

      const signedUrl = await this.getSignedUrl(userId);
      
      // Return configuration for client-side WebSocket connection
      return {
        signedUrl,
        agentId: ELEVENLABS_AGENT_ID,
        dynamicVariables: {
          user_id: userId,
          device_id: deviceId,
          ...dynamicVariables,
        },
        conversationConfig: {
          // Override agent settings for glasses-specific behavior
          agent: {
            prompt: `You are a helpful AI assistant integrated with AI glasses. You have access to 90 productivity tools through Composio. 
            You can help users with tasks like managing emails, calendars, notes, and various productivity workflows.
            Keep responses concise and conversational since this is a voice interface.
            
            User ID: {{user_id}}
            Device ID: {{device_id}}`,
            firstMessage: "Hi! I'm your AI assistant. How can I help you today?",
          },
        },
      };
    } catch (error) {
      console.error('❌ Error starting ElevenLabs conversation', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        deviceId,
      });
      throw error;
    }
  }

  /**
   * End a conversation session
   */
  async endConversation(conversationId: string): Promise<void> {
    try {
      console.log('🎙️ Ending ElevenLabs conversation', { conversationId });
      
      // ElevenLabs conversations end automatically when WebSocket closes
      // This is mainly for logging and cleanup
      
      console.log('✅ ElevenLabs conversation ended', { conversationId });
    } catch (error) {
      console.error('❌ Error ending ElevenLabs conversation', {
        error: error instanceof Error ? error.message : String(error),
        conversationId,
      });
      throw error;
    }
  }

  /**
   * Get conversation details and transcript
   */
  async getConversation(conversationId: string): Promise<ElevenLabsConversation> {
    try {
      if (!ELEVENLABS_API_KEY) {
        throw new Error('ElevenLabs API key not configured');
      }

      console.log('🎙️ Getting ElevenLabs conversation', { conversationId });

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
        {
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get conversation: ${response.statusText}`);
      }

      const conversation = await response.json() as ElevenLabsConversation;
      console.log('✅ Successfully retrieved ElevenLabs conversation', { 
        conversationId,
        status: conversation.status 
      });

      return conversation;
    } catch (error) {
      console.error('❌ Error getting ElevenLabs conversation', {
        error: error instanceof Error ? error.message : String(error),
        conversationId,
      });
      throw error;
    }
  }

  /**
   * Process post-call webhook data
   */
  async processPostCallWebhook(webhookData: any): Promise<ConversationSummary | null> {
    try {
      console.log('🎙️ Processing ElevenLabs post-call webhook', { 
        conversationId: webhookData.data?.conversation_id,
        type: webhookData.type 
      });

      const { data } = webhookData;
      
      if (webhookData.type === 'post_call_transcription') {
        // Extract conversation details
        const conversationSummary: ConversationSummary = {
          conversationId: data.conversation_id,
          agentId: data.agent_id,
          transcript: data.transcript,
          metadata: data.metadata,
          analysis: data.analysis,
          toolCalls: this.extractToolCalls(data.transcript),
        };

        console.log('✅ Processed conversation summary', {
          conversationId: conversationSummary.conversationId,
          transcriptLength: conversationSummary.transcript?.length || 0,
          toolCallsCount: conversationSummary.toolCalls?.length || 0,
        });

        return conversationSummary;
      }

      return null;
    } catch (error) {
      console.error('❌ Error processing post-call webhook', {
        error: error instanceof Error ? error.message : String(error),
        webhookData,
      });
      throw error;
    }
  }

  /**
   * Extract tool calls from transcript
   */
  private extractToolCalls(transcript: any[]): any[] {
    if (!Array.isArray(transcript)) return [];

    return transcript
      .filter(entry => entry.tool_calls && entry.tool_calls.length > 0)
      .flatMap(entry => entry.tool_calls);
  }

  /**
   * Check if ElevenLabs is properly configured
   */
  isConfigured(): boolean {
    return !!(ELEVENLABS_API_KEY && ELEVENLABS_AGENT_ID);
  }

  /**
   * Get configuration status
   */
  getStatus(): {
    configured: boolean;
    hasApiKey: boolean;
    hasAgentId: boolean;
  } {
    return {
      configured: this.isConfigured(),
      hasApiKey: !!ELEVENLABS_API_KEY,
      hasAgentId: !!ELEVENLABS_AGENT_ID,
    };
  }
}

export const elevenLabsVoiceService = new ElevenLabsVoiceService(); 