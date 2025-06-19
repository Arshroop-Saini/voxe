import { Request, Response } from 'express';
import { supabaseService } from '../../lib/supabase.js';
import { generateId } from 'ai';

/**
 * Chat Thread Management API
 * Handles CRUD operations for chat threads with auto-generated titles,
 * pagination, and proper user isolation via RLS policies.
 */

export interface ChatThread {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

export interface CreateThreadRequest {
  title?: string;
  initialMessage?: string;
}

export interface UpdateThreadRequest {
  title: string;
}

export interface ThreadListResponse {
  threads: ChatThread[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Type for database thread with message count
interface ThreadWithMessageCount {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  chat_messages: any[];
}

/**
 * POST /api/chat/threads - Create new thread
 */
export async function createThread(req: Request, res: Response): Promise<void> {
  try {
    const { title, initialMessage } = req.body as CreateThreadRequest;
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User ID is required'
      });
      return;
    }

    // Generate title from initial message if not provided
    const threadTitle = title || generateThreadTitle(initialMessage) || 'New Chat';

    // Create thread in database (let Supabase generate UUID)
    const { data: thread, error } = await supabaseService
      .from('chat_threads')
      .insert({
        user_id: userId,
        title: threadTitle
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating thread:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create thread'
      });
      return;
    }

    // If initial message provided, create system message
    if (initialMessage && thread) {
      const { error: messageError } = await supabaseService
        .from('chat_messages')
        .insert({
          thread_id: thread.id,
          role: 'user',
          content: { type: 'text', text: initialMessage }
        });

      if (messageError) {
        console.warn('Failed to create initial message:', messageError);
      }
    }

    console.log(`Created new chat thread: ${thread?.id} for user: ${userId}`);

    res.status(201).json({
      success: true,
      data: thread
    });

  } catch (error) {
    console.error('Error in createThread:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

/**
 * GET /api/chat/threads - List user's threads with pagination
 */
export async function listThreads(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.headers['x-user-id'] as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User ID is required'
      });
      return;
    }

    // Get total count
    const { count, error: countError } = await supabaseService
      .from('chat_threads')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      console.error('Error counting threads:', countError);
      res.status(500).json({
        success: false,
        error: 'Failed to count threads'
      });
      return;
    }

    // Get threads with message count
    const { data: threads, error } = await supabaseService
      .from('chat_threads')
      .select(`
        id,
        user_id,
        title,
        created_at,
        updated_at,
        chat_messages(count)
      `)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching threads:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch threads'
      });
      return;
    }

    // Format response with message counts
    const formattedThreads: ChatThread[] = threads.map((thread: ThreadWithMessageCount) => ({
      id: thread.id,
      user_id: thread.user_id,
      title: thread.title,
      created_at: thread.created_at,
      updated_at: thread.updated_at,
      message_count: Array.isArray(thread.chat_messages) ? thread.chat_messages.length : 0
    }));

    const response: ThreadListResponse = {
      threads: formattedThreads,
      total: count || 0,
      page,
      limit,
      hasMore: offset + limit < (count || 0)
    };

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Error in listThreads:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

/**
 * GET /api/chat/threads/:id - Get specific thread
 */
export async function getThread(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User ID is required'
      });
      return;
    }

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Thread ID is required'
      });
      return;
    }

    // Get thread with message count
    const { data: thread, error } = await supabaseService
      .from('chat_threads')
      .select(`
        id,
        user_id,
        title,
        created_at,
        updated_at,
        chat_messages(count)
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({
          success: false,
          error: 'Thread not found'
        });
        return;
      }
      console.error('Error fetching thread:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch thread'
      });
      return;
    }

    const formattedThread: ChatThread = {
      id: thread.id,
      user_id: thread.user_id,
      title: thread.title,
      created_at: thread.created_at,
      updated_at: thread.updated_at,
      message_count: Array.isArray(thread.chat_messages) ? thread.chat_messages.length : 0
    };

    res.json({
      success: true,
      data: formattedThread
    });

  } catch (error) {
    console.error('Error in getThread:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

/**
 * PUT /api/chat/threads/:id - Update thread (title)
 */
export async function updateThread(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { title } = req.body as UpdateThreadRequest;
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User ID is required'
      });
      return;
    }

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Thread ID is required'
      });
      return;
    }

    if (!title || title.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: 'Title is required'
      });
      return;
    }

    // Update thread
    const { data: thread, error } = await supabaseService
      .from('chat_threads')
      .update({
        title: title.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({
          success: false,
          error: 'Thread not found'
        });
        return;
      }
      console.error('Error updating thread:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update thread'
      });
      return;
    }

    console.log(`Updated thread: ${id} for user: ${userId}`);

    res.json({
      success: true,
      data: thread
    });

  } catch (error) {
    console.error('Error in updateThread:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

/**
 * DELETE /api/chat/threads/:id - Delete thread
 */
export async function deleteThread(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User ID is required'
      });
      return;
    }

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Thread ID is required'
      });
      return;
    }

    // Delete thread (messages will be cascade deleted due to foreign key)
    const { error } = await supabaseService
      .from('chat_threads')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting thread:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete thread'
      });
      return;
    }

    console.log(`Deleted thread: ${id} for user: ${userId}`);

    res.json({
      success: true,
      message: 'Thread deleted successfully'
    });

  } catch (error) {
    console.error('Error in deleteThread:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

/**
 * Helper function to generate thread title from initial message
 */
function generateThreadTitle(message?: string): string | null {
  if (!message || message.trim().length === 0) {
    return null;
  }

  // Take first 50 characters and add ellipsis if longer
  const title = message.trim();
  if (title.length <= 50) {
    return title;
  }

  // Find last space before 50 characters to avoid cutting words
  const truncated = title.substring(0, 50);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > 30) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}

/**
 * Health check endpoint
 */
export async function healthCheck(req: Request, res: Response) {
  res.json({
    success: true,
    service: 'Chat Threads API',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
} 