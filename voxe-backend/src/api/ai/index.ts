import express, { Request, Response } from 'express';
import { z } from 'zod';
import { aiService } from '../../lib/ai/index.js';
import composioRouter from './composio.js';

const aiRouter = express.Router();

// Mount Composio agent routes
aiRouter.use('/composio', composioRouter);

// Schema for test completion request
const testCompletionSchema = z.object({
  prompt: z.string().min(1).max(500),
});

// Health check endpoint
aiRouter.get('/health', (req: Request, res: Response) => {
  const modelInfo = aiService.getModelInfo();
  
  res.json({ 
    status: 'ok', 
    message: 'AI service is running',
    model: modelInfo.model,
    configured: modelInfo.configured,
    timestamp: new Date().toISOString()
  });
});

// Test basic AI completion
aiRouter.post('/test-completion', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = testCompletionSchema.safeParse(req.body);
    
    if (!result.success) {
      res.status(400).json({ 
        error: 'Invalid request body',
        details: result.error.errors
      });
      return;
    }

    const { prompt } = result.data;

    console.log('Testing AI completion with prompt:', prompt);

    const completion = await aiService.testCompletion(prompt);

    res.json({
      success: true,
      prompt,
      completion,
      model: aiService.getModelInfo().model,
      configured: aiService.isConfigured(),
    });

  } catch (error) {
    console.error('AI test completion error:', error);
    res.status(500).json({ 
      error: 'Failed to test AI completion',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test structured generation
aiRouter.post('/test-structured', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!aiService.isConfigured()) {
      res.status(503).json({
        error: 'AI service not configured',
        message: 'OpenAI API key is required for structured generation'
      });
      return;
    }

    // Test schema for email intent
    const emailIntentSchema = z.object({
      intent: z.literal('send_email'),
      recipient: z.string(),
      subject: z.string(),
      body: z.string(),
      confidence: z.number().min(0).max(1),
    });

    const testPrompt = "Send an email to john@example.com about tomorrow's meeting with subject 'Meeting Reminder'";
    
    const result = await aiService.generateStructured(
      testPrompt,
      emailIntentSchema,
      "You are a command parser. Extract email intent from user commands."
    );

    res.json({
      success: true,
      prompt: testPrompt,
      structured_result: result,
      model: aiService.getModelInfo().model,
    });

  } catch (error) {
    console.error('AI structured test error:', error);
    res.status(500).json({ 
      error: 'Failed to test structured generation',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default aiRouter; 