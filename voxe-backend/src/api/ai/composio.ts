import express, { Request, Response } from 'express';
import { composioAgent } from '../../lib/ai/composio-agent.js';

const composioRouter = express.Router();

/**
 * GET /api/ai/composio/status
 * Get agent status and configuration
 */
composioRouter.get('/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const status = composioAgent.getStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get agent status',
    });
  }
});

/**
 * GET /api/ai/composio/test
 * Test agent initialization and tool loading
 */
composioRouter.get('/test', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await composioAgent.testAgent();
    
    if (result.success) {
      res.json({
        success: true,
        data: result,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message,
      });
    }
  } catch (error) {
    console.error('Agent test error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test agent',
    });
  }
});

/**
 * GET /api/ai/composio/tools
 * Get available tools information
 */
composioRouter.get('/tools', async (req: Request, res: Response): Promise<void> => {
  try {
    const tools = await composioAgent.getAvailableTools();
    res.json({
      success: true,
      data: tools,
    });
  } catch (error) {
    console.error('Tools info error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get tools information',
    });
  }
});

/**
 * POST /api/ai/composio/execute
 * Execute a natural language command
 */
composioRouter.post('/execute', async (req: Request, res: Response): Promise<void> => {
  try {
    const { command, userId, maxSteps = 5 } = req.body;
    
    if (!command || typeof command !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Command is required and must be a string',
      });
      return;
    }
    
    if (maxSteps < 1 || maxSteps > 10) {
      res.status(400).json({
        success: false,
        error: 'maxSteps must be between 1 and 10',
      });
      return;
    }
    
    console.log(`🎯 Executing command via API: "${command}"${userId ? ` for user: ${userId}` : ''}`);
    
    const result = await composioAgent.executeCommand(command, userId, maxSteps);
    
    res.json({
      success: result.success,
      data: result,
    });
    
  } catch (error) {
    console.error('Command execution error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute command',
    });
  }
});

/**
 * POST /api/ai/composio/initialize
 * Manually initialize the agent (useful for testing)
 */
composioRouter.post('/initialize', async (req: Request, res: Response): Promise<void> => {
  try {
    await composioAgent.initialize();
    
    const status = composioAgent.getStatus();
    
    res.json({
      success: true,
      message: 'Agent initialized successfully',
      data: status,
    });
  } catch (error) {
    console.error('Agent initialization error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize agent',
    });
  }
});

/**
 * POST /api/ai/composio/workflow
 * Execute a complex multi-step workflow with detailed tracking
 */
composioRouter.post('/workflow', async (req: Request, res: Response): Promise<void> => {
  try {
    const { command, userId, maxSteps = 10 } = req.body;
    
    if (!command || typeof command !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Command is required and must be a string',
      });
      return;
    }
    
    if (maxSteps < 1 || maxSteps > 15) {
      res.status(400).json({
        success: false,
        error: 'maxSteps must be between 1 and 15 for workflows',
      });
      return;
    }
    
    console.log(`🚀 Executing workflow via API: "${command}"${userId ? ` for user: ${userId}` : ''}`);
    
    const result = await composioAgent.executeWorkflow(command, userId, maxSteps);
    
    res.json({
      success: result.success,
      data: result,
    });
    
  } catch (error) {
    console.error('Workflow execution error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute workflow',
    });
  }
});

export default composioRouter; 