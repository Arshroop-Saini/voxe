import express, { Request, Response } from 'express';
import { ComposioAgentService } from '../lib/ai/composio-agent.js';

const composioAgent = new ComposioAgentService();
const elevenLabsRouter = express.Router();

// Map ElevenLabs tool names to our internal tool names
function mapToolName(elevenLabsToolName: string): string {
  const toolNameMap: Record<string, string> = {
    'gmail_send_email': 'send_email',
    'google_calendar_create_event': 'create_calendar_event',
    'notion_create_page': 'create_notion_page',
    // Add more mappings as needed
  };
  
  return toolNameMap[elevenLabsToolName] || elevenLabsToolName;
}

function buildCommandFromTool(toolName: string, parameters: any): string {
  switch (toolName) {
    case 'send_email':
    case 'gmail_send_email':
      const { to, recipient_email, subject, body, cc, bcc } = parameters;
      const emailTo = to || recipient_email;
      return `Send an email to ${emailTo} with subject "${subject}" and body: ${body}${cc ? ` CC: ${cc}` : ''}${bcc ? ` BCC: ${bcc}` : ''}`;
    
    case 'create_calendar_event':
    case 'google_calendar_create_event':
      const { title, start_time, end_time, description, attendees } = parameters;
      return `Create a calendar event titled "${title}" from ${start_time} to ${end_time}${description ? ` with description: ${description}` : ''}${attendees ? ` and invite: ${attendees}` : ''}`;
    
    default:
      // Convert tool name and parameters to natural language command
      const paramString = Object.entries(parameters)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      return `Execute ${toolName} with parameters: ${paramString}`;
  }
}

async function handleElevenLabsWebhook(req: Request, res: Response) {
  try {
    console.log('🎤 ElevenLabs webhook received:', JSON.stringify(req.body, null, 2));

    // Handle both direct format and nested request_body format
    let requestData = req.body;
    
    // Check if ElevenLabs is sending data wrapped in request_body
    if (req.body.request_body && typeof req.body.request_body === 'object') {
      console.log('📦 Detected nested request_body format');
      requestData = req.body.request_body;
    }

    const { tool_name, parameters, user_id } = requestData;
    
    // 🔧 FIX: Get userId from multiple sources with comprehensive debugging
    let userId = req.headers['x-user-id'] as string || 
                 user_id || 
                 requestData.user_id ||
                 req.body.user_id ||
                 requestData.dynamic_variables?.user_id ||
                 req.body.dynamic_variables?.user_id;

    // Log complete request structure for debugging
    console.log('🔍 Full request analysis:', {
      headers: {
        'x-user-id': req.headers['x-user-id'],
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent']
      },
      body_structure: {
        direct_keys: Object.keys(req.body || {}),
        request_body_keys: Object.keys(req.body?.request_body || {}),
        has_dynamic_variables: !!req.body.dynamic_variables,
        dynamic_variables_content: req.body.dynamic_variables,
        nested_dynamic_variables: req.body?.request_body?.dynamic_variables
      }
    });

    // TEMPORARY: For development/testing, allow fallback user ID
    if (!userId && (process.env.NODE_ENV === 'development' || process.env.ALLOW_FALLBACK_USER === 'true')) {
      console.log('⚠️ DEVELOPMENT MODE: Using fallback user ID for testing');
      console.log('⚠️ This should be removed in production!');
      userId = 'e58e50aa-fd9d-499e-a977-f9b8b065f8b4'; // Your actual user ID
    }

    console.log('🔧 Parsed request data:', {
      tool_name,
      parameters: JSON.stringify(parameters),
      userId: userId || 'NOT_FOUND',
      originalFormat: req.body.request_body ? 'nested' : 'direct',
      using_fallback: !req.headers['x-user-id'] && !user_id && !requestData.user_id && !req.body.user_id
    });

    if (!tool_name) {
      console.error('❌ Missing tool_name in request');
      return res.status(400).json({ 
        success: false, 
        message: 'Missing tool_name in request',
        error: 'MISSING_TOOL_NAME'
      });
    }

    // 🔧 FIX: Require user authentication with detailed debugging
    if (!userId) {
      console.error('❌ Missing user_id - user authentication required');
      
      const authSources = {
        headers_x_user_id: req.headers['x-user-id'] ? '✓' : '✗',
        request_user_id: user_id ? '✓' : '✗',
        requestData_user_id: requestData.user_id ? '✓' : '✗',
        body_user_id: req.body.user_id ? '✓' : '✗',
        dynamic_variables: requestData.dynamic_variables?.user_id ? '✓' : '✗',
        body_dynamic_variables: req.body.dynamic_variables?.user_id ? '✓' : '✗'
      };
      
      console.error('❌ Available data sources:', authSources);
      
      return res.status(401).json({ 
        success: false, 
        message: 'User authentication required. ElevenLabs webhook tools may need additional configuration to pass user context.',
        error: 'MISSING_USER_AUTHENTICATION',
        debug_info: {
          searched_locations: authSources,
          suggestion: 'Configure ElevenLabs webhook tool to include user_id parameter, or use client tools instead of webhook tools',
          full_request_body: req.body
        }
      });
    }

    if (!parameters || typeof parameters !== 'object') {
      console.error('❌ Missing or invalid parameters');
      return res.status(400).json({ 
        success: false, 
        message: 'Missing or invalid parameters',
        error: 'INVALID_PARAMETERS'
      });
    }

    // Map ElevenLabs tool name to our internal tool name
    const internalToolName = mapToolName(tool_name);
    console.log(`🔄 Mapped tool name: ${tool_name} → ${internalToolName}`);

    // Build natural language command from tool and parameters
    const command = buildCommandFromTool(internalToolName, parameters);
    console.log(`🤖 Executing command for user ${userId}: ${command}`);

    // Execute the command using Composio agent
    const result = await composioAgent.executeCommand(command, userId);
    console.log('✅ Tool execution result:', JSON.stringify(result, null, 2));

    // Return structured response for ElevenLabs
    return res.status(200).json({
      success: true,
      message: result.response || `Successfully executed ${internalToolName}`,
      data: result.toolsUsed || [],
      execution_details: {
        tool_name: internalToolName,
        command_executed: command,
        user_id: userId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ ElevenLabs webhook error:', error);
    
    // Determine error type for better responses
    let errorMessage = 'Failed to execute tool';
    let errorCode = 'EXECUTION_ERROR';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('not connected') || error.message.includes('authentication')) {
        errorMessage = 'User not connected to required service. Please connect your account first.';
        errorCode = 'SERVICE_NOT_CONNECTED';
        statusCode = 403;
      } else if (error.message.includes('rate limit')) {
        errorMessage = 'Service temporarily unavailable due to rate limits. Please try again in a moment.';
        errorCode = 'RATE_LIMITED';
        statusCode = 429;
      } else {
        errorMessage = error.message;
      }
    }

    return res.status(statusCode).json({ 
      success: false, 
      message: errorMessage,
      error: errorCode,
      details: error instanceof Error ? error.stack : String(error),
      timestamp: new Date().toISOString()
    });
  }
}

// Register the webhook route
elevenLabsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  await handleElevenLabsWebhook(req, res);
});

export default elevenLabsRouter;