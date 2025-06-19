import { Request, Response } from 'express';
import { openai } from '@ai-sdk/openai';
import { streamText, appendResponseMessages, Message, generateId } from 'ai';
import { v4 as uuidv4 } from 'uuid';
import { supabaseService } from '../../lib/supabase.js';
import { ComposioAgentService } from '../../lib/ai/composio-agent.js';
import { mem0Service } from '../../lib/mem0/mem0Service.js';

/**
 * Chat Messages API with Streaming and Mem0 Integration
 * Following User's Specified 3-Step Mem0 Pattern:
 * 1. Initialize with createMem0() (done in mem0Service)
 * 2. Use retrieveMemories() + OpenAI provider for context
 * 3. Use addMemories() after each interaction
 */

export interface ChatMessage {
  id: string;
  thread_id: string;
  role: 'user' | 'assistant' | 'system';
  content: any; // JSONB - Vercel AI SDK message format
  tools_used: string[];
  created_at: string;
}

export interface SendMessageRequest {
  messages: Message[];
  id: string; // thread ID
}

// Initialize Composio agent service
const composioAgent = new ComposioAgentService();

/**
 * POST /api/chat/messages - Send message and stream response
 * Following user's specified mem0 integration pattern
 */
export async function sendMessage(req: Request, res: Response): Promise<void> {
  try {
    const { messages, id: threadId } = req.body as SendMessageRequest;
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User ID is required'
      });
      return;
    }

    if (!threadId) {
      res.status(400).json({
        success: false,
        error: 'Thread ID is required'
      });
      return;
    }

    console.log(`Processing chat message for thread: ${threadId}, user: ${userId}`);

    // Load previous messages from database
    const previousMessages = await loadChatMessages(threadId);
    
    // 🔧 FIX: Only process the last (new) message from the client
    // The useChat hook sends ALL messages, but we only want the latest user message
    const lastMessage = messages[messages.length - 1];
    
    if (!lastMessage || lastMessage.role !== 'user') {
      res.status(400).json({
        success: false,
        error: 'No new user message found'
      });
      return;
    }

    // 🔧 FIX: Generate proper UUID for the new user message
    const newUserMessage = {
      ...lastMessage,
      id: uuidv4(),
      content: normalizeMessageContent(lastMessage.content),
      createdAt: new Date()
    };
    
    // Combine previous messages with the new user message
    const allMessages = [...previousMessages, newUserMessage];

    // Get the user's current input for memory context
    const currentPrompt = newUserMessage.content;

    // 🎯 STEP 2: Use retrieveMemories() for context (User's specified pattern)
    const memoryContext = mem0Service.createChatContext(userId, threadId);
    const memories = await mem0Service.getMemoryContext(currentPrompt, memoryContext);

    console.log(`🧠 Memory context retrieved for user ${userId}:`, memories ? 'Found relevant memories' : 'No memories found');

    // Get Composio tools for user (with entity context)
    const tools = await composioAgent.getToolsForUser(userId);

    // 🎯 STEP 3: Use OpenAI provider with memory as system context (User's specified pattern)
    const systemPrompt = `You are Voxe, an AI-powered productivity assistant with access to Gmail, Google Calendar, Google Docs, Google Drive, Google Sheets, and Notion.

CORE CAPABILITIES:
- Email management via Gmail tools
- Calendar scheduling via Google Calendar tools  
- Document creation via Google Docs tools
- File management via Google Drive tools
- Spreadsheet operations via Google Sheets tools
- Note-taking via Notion tools

CHAT INTERACTION PRINCIPLES:
- Maintain conversational flow and context
- Ask clarifying questions when needed
- Provide step-by-step guidance for complex tasks
- Use tools proactively to help users
- Learn from user preferences and patterns

${memories ? `RELEVANT MEMORIES FROM PREVIOUS CONVERSATIONS:\n${memories}\n` : ''}

Use the above memories to provide personalized and contextual responses.`;

    // Stream response with OpenAI provider and memory context
    const result = streamText({
      model: openai('gpt-4o-mini'), // 🎯 Using OpenAI provider as specified
      messages: allMessages,
      tools,
      maxSteps: 1, // 🔧 FIX: Reduce to 1 to prevent multiple response cycles
      system: systemPrompt, // 🎯 Memory context in system prompt
      experimental_generateMessageId: () => uuidv4(), // 🔧 FIX: Generate proper UUIDs

      // Save messages and add memories on completion
      async onFinish({ response }) {
        try {
          // 🔧 FIX: Only save the new user message and AI response
          // Don't re-save all previous messages
          const newMessages = [newUserMessage];
          
          // Add AI response messages with proper UUIDs
          response.messages.forEach(msg => {
            // Only save standard message roles, skip tool messages
            if (msg.role !== 'tool') {
              newMessages.push({
                id: uuidv4(),
                role: msg.role as 'user' | 'assistant' | 'system',
                content: normalizeMessageContent(msg.content),
                createdAt: new Date()
              });
            }
          });

          // Save only the new messages to database
          await saveChatMessages(threadId, newMessages);

          // 🎯 STEP 4: Add memories after interaction (User's specified pattern)
          // Convert only new messages to the format expected by addMemories
          const memoryMessages = newMessages.map(msg => ({
            role: msg.role,
            content: [{ type: "text", text: msg.content }]
          }));

          await mem0Service.addMemoriesAfterInteraction(memoryMessages, memoryContext);

          console.log(`✅ Saved ${newMessages.length} new messages for thread: ${threadId}`);
        } catch (error) {
          console.error('Error saving chat messages or adding memories:', error);
        }
      },
    });

    // 🔧 FIX: Ensure proper streaming response without duplication
    const streamResponse = result.toDataStreamResponse();
    
    // Return the stream response directly to prevent double processing
    res.setHeader('Content-Type', streamResponse.headers.get('Content-Type') || 'text/plain');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Stream the response body directly
    const reader = streamResponse.body?.getReader();
    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } finally {
        reader.releaseLock();
      }
    }
    
    res.end();

  } catch (error) {
    console.error('Error in sendMessage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process message'
    });
  }
}

/**
 * GET /api/chat/messages/:threadId - Get thread messages
 * Following docs: vercel-ai-sdk-chatbot-message-persistence.md
 */
export async function getMessages(req: Request, res: Response): Promise<void> {
  try {
    const { threadId } = req.params;
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User ID is required'
      });
      return;
    }

    if (!threadId) {
      res.status(400).json({
        success: false,
        error: 'Thread ID is required'
      });
      return;
    }

    // Verify thread belongs to user
    const { data: thread, error: threadError } = await supabaseService
      .from('chat_threads')
      .select('id')
      .eq('id', threadId)
      .eq('user_id', userId)
      .single();

    if (threadError || !thread) {
      res.status(404).json({
        success: false,
        error: 'Thread not found'
      });
      return;
    }

    // Load messages
    const messages = await loadChatMessages(threadId);

    res.json({
      success: true,
      data: {
        threadId,
        messages
      }
    });

  } catch (error) {
    console.error('Error in getMessages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load messages'
    });
  }
}

/**
 * Load chat messages from database with proper format normalization
 * Following docs: vercel-ai-sdk-chatbot-message-persistence.md
 */
async function loadChatMessages(threadId: string): Promise<Message[]> {
  try {
    const { data: messages, error } = await supabaseService
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading chat messages:', error);
      return [];
    }

    // Convert database format to AI SDK Message format with UUID validation
    const convertedMessages: Message[] = (messages || []).map((msg: ChatMessage) => ({
      id: msg.id || uuidv4(), // 🔧 FIX: Ensure all messages have proper UUIDs
      role: msg.role as 'user' | 'assistant' | 'system',
      content: normalizeMessageContent(msg.content),
      createdAt: new Date(msg.created_at),
    }));

    return convertedMessages;
  } catch (error) {
    console.error('Error in loadChatMessages:', error);
    return [];
  }
}

/**
 * Normalize message content to ensure consistent format for AI SDK
 * Fixes InvalidPromptError by ensuring content is always a string
 */
function normalizeMessageContent(content: any): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object') {
          return part.text || part.content || JSON.stringify(part);
        }
        return String(part || '');
      })
      .join(' ');
  }
  
  if (content && typeof content === 'object') {
    if (content.text && content.type) {
      return content.text;
    }
    const text = content.text || content.content || content.message || JSON.stringify(content);
    return typeof text === 'string' ? text : JSON.stringify(content);
  }

  return String(content || '');
}

/**
 * Save chat messages to database with proper UUID handling
 * Following docs: vercel-ai-sdk-chatbot-message-persistence.md
 */
async function saveChatMessages(threadId: string, messages: Message[]): Promise<void> {
  try {
    // Convert AI SDK Messages to database format with proper UUIDs
    const dbMessages = messages.map((msg) => ({
      id: msg.id || uuidv4(), // 🔧 FIX: Ensure all messages have proper UUIDs
      thread_id: threadId,
      role: msg.role,
      content: msg.content, // Store as string in JSONB
      tools_used: [], // TODO: Extract from message if needed
      created_at: msg.createdAt ? new Date(msg.createdAt).toISOString() : new Date().toISOString(),
    }));

    // Use upsert to handle both new and updated messages
    const { error } = await supabaseService
      .from('chat_messages')
      .upsert(dbMessages, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      });

    if (error) {
      console.error('Error saving chat messages:', error);
      throw error;
    }

    console.log(`Saved ${dbMessages.length} messages for thread: ${threadId}`);
  } catch (error) {
    console.error('Error in saveChatMessages:', error);
    throw error;
  }
}

/**
 * Health check endpoint
 */
export async function healthCheck(req: Request, res: Response): Promise<void> {
  try {
    // Check mem0 service health
    const mem0Health = await mem0Service.healthCheck();
    
  res.json({
    success: true,
      service: 'chat-messages',
      timestamp: new Date().toISOString(),
      dependencies: {
        mem0: mem0Health,
        composio: 'ready' // TODO: Add composio health check
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed'
    });
  }
} 