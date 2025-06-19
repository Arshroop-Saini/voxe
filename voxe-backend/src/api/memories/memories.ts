import { Request, Response } from 'express';
import { supabaseService } from '../../lib/supabase.js';
import { addMemories } from '@mem0/vercel-ai-provider';

// Types for user memories
export interface UserMemory {
  id?: string;
  user_id: string;
  heading: string;
  description: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateMemoryRequest {
  heading: string;
  description: string;
}

// Helper function to get user ID from request
function getUserId(req: Request): string | null {
  // Check multiple sources for user ID (consistent with existing patterns)
  const userIdFromHeader = req.headers['x-user-id'] as string;
  const userIdFromBody = req.body?.user_id;
  const userIdFromQuery = req.query?.user_id as string;
  
  return userIdFromHeader || userIdFromBody || userIdFromQuery || null;
}

/**
 * GET /api/memories - Get all memories for a user
 */
export async function getMemories(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User authentication required. Please provide user_id in x-user-id header.'
      });
      return;
    }

    // Fetch user memories from Supabase
    const { data: memories, error } = await supabaseService
      .from('user_memories')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching memories:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch memories'
      });
      return;
    }

    res.json({
      success: true,
      data: memories || [],
      count: memories?.length || 0
    });

  } catch (error) {
    console.error('Error in getMemories:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

/**
 * POST /api/memories - Create a new memory
 */
export async function createMemory(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User authentication required. Please provide user_id in x-user-id header.'
      });
      return;
    }

    const { heading, description }: CreateMemoryRequest = req.body;

    // Validate required fields
    if (!heading || !description) {
      res.status(400).json({
        success: false,
        error: 'Both heading and description are required'
      });
      return;
    }

    if (heading.trim().length === 0 || description.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: 'Heading and description cannot be empty'
      });
      return;
    }

    // Create memory in Supabase
    const { data: newMemory, error: supabaseError } = await supabaseService
      .from('user_memories')
      .insert([
        {
          user_id: userId,
          heading: heading.trim(),
          description: description.trim()
        }
      ])
      .select()
      .single();

    if (supabaseError) {
      console.error('Error creating memory in Supabase:', supabaseError);
      res.status(500).json({
        success: false,
        error: 'Failed to save memory to database'
      });
      return;
    }

    // Add to Mem0 for AI context enhancement
    try {
      const memoryText = `${heading}: ${description}`;
      const messages = [
        { role: 'user' as const, content: [{ type: 'text' as const, text: memoryText }] }
      ];

      await addMemories(messages, { 
        user_id: userId,
        app_id: 'voxe-memories'
      });

      console.log(`✅ Memory added to Mem0 for user: ${userId}`);
    } catch (mem0Error) {
      console.error('Warning: Failed to add memory to Mem0:', mem0Error);
      // Don't fail the request if Mem0 fails - the memory is still saved in Supabase
    }

    res.status(201).json({
      success: true,
      data: newMemory,
      message: 'Memory created successfully'
    });

  } catch (error) {
    console.error('Error in createMemory:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

/**
 * PUT /api/memories/:id - Update a memory
 */
export async function updateMemory(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
    const memoryId = req.params.id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
      return;
    }

    const { heading, description }: CreateMemoryRequest = req.body;

    // Validate required fields
    if (!heading || !description) {
      res.status(400).json({
        success: false,
        error: 'Both heading and description are required'
      });
      return;
    }

    // Update memory in Supabase (RLS ensures user can only update their own memories)
    const { data: updatedMemory, error } = await supabaseService
      .from('user_memories')
      .update({
        heading: heading.trim(),
        description: description.trim()
      })
      .eq('id', memoryId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating memory:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update memory'
      });
      return;
    }

    if (!updatedMemory) {
      res.status(404).json({
        success: false,
        error: 'Memory not found or you do not have permission to update it'
      });
      return;
    }

    res.json({
      success: true,
      data: updatedMemory,
      message: 'Memory updated successfully'
    });

  } catch (error) {
    console.error('Error in updateMemory:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

/**
 * DELETE /api/memories/:id - Delete a memory
 */
export async function deleteMemory(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
    const memoryId = req.params.id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
      return;
    }

    // Delete memory from Supabase (RLS ensures user can only delete their own memories)
    const { error } = await supabaseService
      .from('user_memories')
      .delete()
      .eq('id', memoryId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting memory:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete memory'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Memory deleted successfully'
    });

  } catch (error) {
    console.error('Error in deleteMemory:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
} 