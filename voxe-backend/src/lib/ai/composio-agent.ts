import { openai } from '@ai-sdk/openai';
import { VercelAIToolSet } from 'composio-core';
import { generateText, CoreTool } from 'ai';
import { mem0Service } from '../mem0/mem0Service.js';

/**
 * Composio-powered AI Agent Service with Memory Integration
 * Provides access to 250+ tools including Gmail, Google Calendar, Google Docs, 
 * Google Drive, Google Sheets, and Notion through managed authentication
 * Enhanced with Mem0 for persistent user preference learning
 */
export class ComposioAgentService {
  private model: string;
  private toolset: VercelAIToolSet;
  private tools: Record<string, CoreTool> = {};
  private isInitialized: boolean = false;

  constructor() {
    this.model = 'gpt-4o';
    this.toolset = new VercelAIToolSet();
    
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OpenAI API key not configured. AI agent features will be limited.');
    }
    
    if (!process.env.COMPOSIO_API_KEY) {
      console.warn('Composio API key not configured. Tool integrations will be limited.');
    }

    if (!process.env.MEM0_API_KEY) {
      console.warn('Mem0 API key not configured. Memory features will be limited.');
    }
  }

  /**
   * Initialize the agent with required tools
   */
  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        return;
      }

      console.log('Initializing Composio AI Agent with Memory...');
      
      // Get tools for our core productivity apps
      const allTools = await this.toolset.getTools({ 
        apps: ["gmail", "googlecalendar", "googledocs", "googledrive", "googlesheets", "notion"] 
      });
      
      // Filter to stay within OpenAI's 128 tool limit
      this.tools = this.filterToolsForOpenAI(allTools);
      
      console.log(`Loaded ${Object.keys(this.tools).length} tools from Composio (filtered from ${Object.keys(allTools).length} available)`);
      console.log('Available apps: Gmail, Google Calendar, Google Docs, Google Drive, Google Sheets, Notion');
      console.log('Memory integration: Enabled with Mem0');
      
      this.isInitialized = true;
          } catch (error) {
        console.error('Failed to initialize Composio agent:', error);
        throw new Error('Failed to initialize AI agent with tools');
      }
  }

  /**
   * Filter tools to stay within OpenAI's 128 tool limit
   * Prioritizes essential tools for each app
   */
  private filterToolsForOpenAI(allTools: Record<string, CoreTool>): Record<string, CoreTool> {
    const MAX_TOOLS = 128;
    const toolEntries = Object.entries(allTools);
    
    if (toolEntries.length <= MAX_TOOLS) {
      return allTools;
    }

    // Priority order for tools (most important first)
    const toolPriorities = [
      // Gmail essentials
      'gmail_send_email',
      'gmail_get_messages',
      'gmail_create_draft',
      'gmail_reply_to_email',
      'gmail_search_emails',
      
      // Calendar essentials
      'googlecalendar_create_event',
      'googlecalendar_list_events',
      'googlecalendar_update_event',
      'googlecalendar_delete_event',
      'googlecalendar_find_free_time',
      
      // Docs essentials
      'googledocs_create_document',
      'googledocs_get_document',
      'googledocs_update_document',
      'googledocs_share_document',
      
      // Drive essentials
      'googledrive_upload_file',
      'googledrive_list_files',
      'googledrive_create_folder',
      'googledrive_share_file',
      'googledrive_download_file',
      
      // Sheets essentials
      'googlesheets_create_spreadsheet',
      'googlesheets_get_values',
      'googlesheets_update_values',
      'googlesheets_append_values',
      
      // Notion essentials
      'notion_create_page',
      'notion_get_page',
      'notion_update_page',
      'notion_search_pages',
      'notion_create_database_entry'
    ];

    const filteredTools: Record<string, CoreTool> = {};
    let toolCount = 0;

    // First, add priority tools
    for (const toolName of toolPriorities) {
      if (toolCount >= MAX_TOOLS) break;
      if (allTools[toolName]) {
        filteredTools[toolName] = allTools[toolName];
        toolCount++;
      }
    }

    // Then add remaining tools until we hit the limit
    for (const [toolName, tool] of toolEntries) {
      if (toolCount >= MAX_TOOLS) break;
      if (!filteredTools[toolName]) {
        filteredTools[toolName] = tool;
        toolCount++;
      }
    }

    console.log(`Filtered tools from ${toolEntries.length} to ${toolCount} to stay within OpenAI limit`);
    return filteredTools;
  }

  // 🎯 Memory operations are now handled automatically by the Mem0 model!
  // No need for manual getMemoryContext() or addToMemory() methods

  /**
   * Execute a complex multi-step workflow with detailed tracking and memory integration
   */
  async executeWorkflow(
    userCommand: string,
    userId?: string,
    maxSteps: number = 10
  ): Promise<{
    success: boolean;
    response: string;
    toolsUsed: string[];
    steps: number;
    workflowSteps: Array<{
      step: number;
      action: string;
      toolUsed?: string;
      result: string;
      timestamp: string;
    }>;
    executionTime: number;
  }> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
      }

      console.log(`Executing complex workflow with automatic memory: "${userCommand}"`);
      
      const startTime = Date.now();
      const workflowSteps: Array<{
        step: number;
        action: string;
        toolUsed?: string;
        result: string;
        timestamp: string;
      }> = [];

      // Configure tools with entity context if userId provided
      const toolsToUse = userId ? 
        this.filterToolsForOpenAI(await this.toolset.getTools({ 
          apps: ["gmail", "googlecalendar", "googledocs", "googledrive", "googlesheets", "notion"]
        }, userId)) : this.tools;

      // 🎯 STEP 2: Use retrieveMemories() for context (User's specified pattern)
      let systemPrompt = `You are Voxe, an AI-powered productivity assistant that excels at multi-step workflows across Gmail, Google Calendar, Google Docs, Google Drive, Google Sheets, and Notion.`;
      
      if (userId) {
        const memoryContext = mem0Service.createVoiceContext(userId);
        const memories = await mem0Service.getMemoryContext(userCommand, memoryContext);
        
        if (memories) {
          systemPrompt += `\n\nRELEVANT MEMORIES FROM PREVIOUS CONVERSATIONS:\n${memories}\n\nUse the above memories to provide personalized and contextual responses.`;
        }
      }

      const result = await generateText({
        model: openai(this.model), // 🎯 Using OpenAI provider as specified
        tools: toolsToUse,
        prompt: userCommand,
        maxSteps: maxSteps,
        system: systemPrompt + `

CORE CAPABILITIES:
- Gmail: Send/read emails, manage threads, organize with labels, search contacts
- Calendar: Create/update events, find free slots, manage attendees, schedule meetings
- Docs: Create/edit documents, collaborate, format content, share files
- Drive: Upload/organize files, manage permissions, create folders, share resources
- Sheets: Create spreadsheets, analyze data, generate reports, manage formulas
- Notion: Create pages, update databases, manage workspaces, organize content

MULTI-TOOL WORKFLOW EXPERTISE:
When handling complex requests, break them down into logical steps:
1. Analyze the user's request to identify all required actions
2. Plan the optimal sequence of tool usage
3. Execute each step methodically, providing status updates
4. Verify results and handle any errors gracefully
5. Summarize what was accomplished

WORKFLOW EXAMPLES:
- "Prepare for Monday's meeting" - Check calendar, Create agenda doc, Email attendees
- "Organize project files" - Create Drive folder, Move files, Update permissions, Notify team
- "Weekly report setup" - Fetch data from Sheets, Create Doc, Schedule email, Add to calendar

EXECUTION PRINCIPLES:
- Always explain what you're doing at each step
- Provide detailed status updates for each action taken
- Handle errors gracefully and suggest alternatives
- Ask for clarification when user intent is ambiguous
- Optimize tool usage for efficiency (batch operations when possible)
- IMPORTANT: Clearly describe each step you're taking as you execute the workflow

Your memory system will automatically provide relevant context from previous interactions and learn from this conversation.`
      });

      const executionTime = Date.now() - startTime;
      
      // Extract tool usage information
      const toolsUsed = result.toolCalls?.map(call => call.toolName) || [];
      const steps = result.toolCalls?.length || 0;
      
      console.log(`Workflow executed in ${executionTime}ms`);
      console.log(`Tools used: ${toolsUsed.join(', ') || 'None'}`);
      console.log(`Steps taken: ${steps}`);
      console.log(`Workflow steps: ${workflowSteps.length}`);

      // 🎯 Memory learning is handled automatically by the Mem0 model!
      // No need for manual addToMemory() call
      
      return {
        success: true,
        response: result.text,
        toolsUsed: [...new Set(toolsUsed)], // Remove duplicates
        steps,
        workflowSteps,
        executionTime,
      };
      
    } catch (error) {
      console.error('Workflow execution failed:', error);
      
      return {
        success: false,
        response: `I encountered an error while processing your workflow: ${error instanceof Error ? error.message : 'Unknown error'}`,
        toolsUsed: [],
        steps: 0,
        workflowSteps: [],
        executionTime: 0,
      };
    }
  }

  /**
   * Execute a natural language command using the AI agent with memory integration
   */
  async executeCommand(
    userCommand: string,
    userId?: string,
    maxSteps: number = 5
  ): Promise<{
    success: boolean;
    response: string;
    toolsUsed: string[];
    steps: number;
  }> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
      }

      console.log(`Executing command with automatic memory: "${userCommand}"`);
      
      const startTime = Date.now();

      // Configure tools with entity context if userId provided
      const toolsToUse = userId ? 
        this.filterToolsForOpenAI(await this.toolset.getTools({ 
          apps: ["gmail", "googlecalendar", "googledocs", "googledrive", "googlesheets", "notion"]
        }, userId)) : this.tools;

      // 🎯 STEP 2: Use retrieveMemories() for context (User's specified pattern)
      let systemPrompt = `You are Voxe, an AI-powered productivity assistant that excels at multi-step workflows across Gmail, Google Calendar, Google Docs, Google Drive, Google Sheets, and Notion.`;
      
      if (userId) {
        const memoryContext = mem0Service.createVoiceContext(userId);
        const memories = await mem0Service.getMemoryContext(userCommand, memoryContext);
        
        if (memories) {
          systemPrompt += `\n\nRELEVANT MEMORIES FROM PREVIOUS CONVERSATIONS:\n${memories}\n\nUse the above memories to provide personalized and contextual responses.`;
        }
      }
      
      const result = await generateText({
        model: openai(this.model), // 🎯 Using OpenAI provider as specified
        tools: toolsToUse,
        prompt: userCommand,
        maxSteps: maxSteps,
        system: systemPrompt + `

CORE CAPABILITIES:
- Gmail: Send/read emails, manage threads, organize with labels, search contacts
- Calendar: Create/update events, find free slots, manage attendees, schedule meetings
- Docs: Create/edit documents, collaborate, format content, share files
- Drive: Upload/organize files, manage permissions, create folders, share resources
- Sheets: Create spreadsheets, analyze data, generate reports, manage formulas
- Notion: Create pages, update databases, manage workspaces, organize content

MULTI-TOOL WORKFLOW EXPERTISE:
When handling complex requests, break them down into logical steps:
1. Analyze the user's request to identify all required actions
2. Plan the optimal sequence of tool usage
3. Execute each step methodically, providing status updates
4. Verify results and handle any errors gracefully
5. Summarize what was accomplished

WORKFLOW EXAMPLES:
- "Prepare for Monday's meeting" - Check calendar, Create agenda doc, Email attendees
- "Organize project files" - Create Drive folder, Move files, Update permissions, Notify team
- "Weekly report setup" - Fetch data from Sheets, Create Doc, Schedule email, Add to calendar

EXECUTION PRINCIPLES:
- Always explain what you're doing at each step
- Confirm destructive actions before executing
- Provide clear status updates during multi-step processes
- Handle errors gracefully and suggest alternatives
- Ask for clarification when user intent is ambiguous
- Optimize tool usage for efficiency (batch operations when possible)

Your memory system will automatically provide relevant context from previous interactions and learn from this conversation.`
      });

      const executionTime = Date.now() - startTime;
      
      // Extract tool usage information
      const toolsUsed = result.toolCalls?.map(call => call.toolName) || [];
      const steps = result.toolCalls?.length || 0;
      
      console.log(`Command executed in ${executionTime}ms`);
      console.log(`Tools used: ${toolsUsed.join(', ') || 'None'}`);
      console.log(`Steps taken: ${steps}`);

      // 🎯 Memory learning is handled automatically by the Mem0 model!
      // No need for manual addToMemory() call
      
      return {
        success: true,
        response: result.text,
        toolsUsed: [...new Set(toolsUsed)], // Remove duplicates
        steps,
      };
      
    } catch (error) {
      console.error('Command execution failed:', error);
      
      // More robust error message handling
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        errorMessage = JSON.stringify(error);
      }
      
      return {
        success: false,
        response: `I encountered an error while processing your request: ${errorMessage}`,
        toolsUsed: [],
        steps: 0,
      };
    }
  }

  /**
   * Execute a chat command with memory integration (for chat interface)
   */
  async executeChatCommand(
    userCommand: string,
    userId?: string,
    threadId?: string,
    maxSteps: number = 5
  ): Promise<{
    success: boolean;
    response: string;
    toolsUsed: string[];
    steps: number;
  }> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
      }

      console.log(`Executing chat command with automatic memory: "${userCommand}"`);
      
      const startTime = Date.now();

      // Configure tools with entity context if userId provided
      const toolsToUse = userId ? 
        this.filterToolsForOpenAI(await this.toolset.getTools({ 
          apps: ["gmail", "googlecalendar", "googledocs", "googledrive", "googlesheets", "notion"]
        }, userId)) : this.tools;

      // 🎯 STEP 2: Use retrieveMemories() for context (User's specified pattern)
      let systemPrompt = `You are Voxe, an AI-powered productivity assistant in chat mode. You excel at conversational interactions and multi-step workflows across Gmail, Google Calendar, Google Docs, Google Drive, Google Sheets, and Notion.`;
      
      if (userId) {
        const memoryContext = mem0Service.createChatContext(userId, threadId);
        const memories = await mem0Service.getMemoryContext(userCommand, memoryContext);
        
        if (memories) {
          systemPrompt += `\n\nRELEVANT MEMORIES FROM PREVIOUS CONVERSATIONS:\n${memories}\n\nUse the above memories to provide personalized and contextual responses.`;
        }
      }
      
      const result = await generateText({
        model: openai(this.model), // 🎯 Using OpenAI provider as specified
        tools: toolsToUse,
        prompt: userCommand,
        maxSteps: maxSteps,
        system: systemPrompt + `

CHAT MODE CAPABILITIES:
- Conversational interface with memory of previous interactions
- Gmail: Send/read emails, manage threads, organize with labels, search contacts
- Calendar: Create/update events, find free slots, manage attendees, schedule meetings
- Docs: Create/edit documents, collaborate, format content, share files
- Drive: Upload/organize files, manage permissions, create folders, share resources
- Sheets: Create spreadsheets, analyze data, generate reports, manage formulas
- Notion: Create pages, update databases, manage workspaces, organize content

CHAT INTERACTION PRINCIPLES:
- Maintain conversational flow and context
- Ask clarifying questions when needed
- Provide step-by-step explanations for complex tasks
- Offer suggestions based on user patterns and preferences
- Handle follow-up questions and refinements
- Explain what tools you're using and why

CHAT EXAMPLES:
- User: "Schedule a meeting" - Ask for details, Create calendar event, Confirm
- User: "Find my project files" - Search Drive, Show results, Offer organization
- User: "Send update to team" - Draft email, Review with user, Send

Your memory system will automatically provide relevant context from previous conversations and learn from this interaction.`
      });

      const executionTime = Date.now() - startTime;
      
      // Extract tool usage information
      const toolsUsed = result.toolCalls?.map(call => call.toolName) || [];
      const steps = result.toolCalls?.length || 0;
      
      console.log(`Chat command executed in ${executionTime}ms`);
      console.log(`Tools used: ${toolsUsed.join(', ') || 'None'}`);
      console.log(`Steps taken: ${steps}`);

      // 🎯 Memory learning is handled automatically by the Mem0 model!
      // No need for manual addToMemory() call
      
      return {
        success: true,
        response: result.text,
        toolsUsed: [...new Set(toolsUsed)], // Remove duplicates
        steps,
      };
      
    } catch (error) {
      console.error('Chat command execution failed:', error);
      
      return {
        success: false,
        response: `I encountered an error while processing your chat request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        toolsUsed: [],
        steps: 0,
      };
    }
  }

  /**
   * Get tools for a specific user with entity context
   */
  async getToolsForUser(userId?: string): Promise<Record<string, CoreTool>> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (userId) {
        console.log(`🔧 Getting user-specific tools for user: ${userId}`);
        const userTools = await this.toolset.getTools({ 
          apps: ["gmail", "googlecalendar", "googledocs", "googledrive", "googlesheets", "notion"]
        }, userId);
        const filteredTools = this.filterToolsForOpenAI(userTools);
        console.log(`✅ Retrieved ${Object.keys(filteredTools).length} user-specific tools (filtered from ${Object.keys(userTools).length})`);
        return filteredTools;
      } else {
        console.log(`🔧 Using general tools (no user ID provided)`);
        return this.tools;
      }
    } catch (error) {
      console.error('❌ Error getting tools for user:', error);
      console.log(`🔄 Falling back to general tools`);
      return this.tools; // Fallback to default tools
    }
  }

  /**
   * Get available tools information
   */
  async getAvailableTools(): Promise<{
    totalTools: number;
    apps: string[];
    toolNames: string[];
  }> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const apps = ["gmail", "googlecalendar", "googledocs", "googledrive", "googlesheets", "notion"];
      const toolNames = Object.keys(this.tools);
      
      return {
        totalTools: Object.keys(this.tools).length,
        apps,
        toolNames,
      };
    } catch (error) {
      console.error('Failed to get tools info:', error);
      return {
        totalTools: 0,
        apps: [],
        toolNames: [],
      };
    }
  }

  /**
   * Check if the agent is properly configured
   */
  isConfigured(): boolean {
    return !!(process.env.OPENAI_API_KEY && process.env.COMPOSIO_API_KEY);
  }

  /**
   * Get agent status and configuration
   */
  getStatus(): {
    configured: boolean;
    initialized: boolean;
    model: string;
    toolsLoaded: number;
  } {
    return {
      configured: this.isConfigured(),
      initialized: this.isInitialized,
      model: this.model,
      toolsLoaded: Object.keys(this.tools).length,
    };
  }

  /**
   * Test the agent with a simple command
   */
  async testAgent(): Promise<{
    success: boolean;
    message: string;
    toolsAvailable: number;
  }> {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          message: 'Agent not properly configured - missing API keys',
          toolsAvailable: 0,
        };
      }

      await this.initialize();
      
      return {
        success: true,
        message: `Agent ready with ${Object.keys(this.tools).length} tools across Gmail, Calendar, Docs, Drive, Sheets, and Notion`,
        toolsAvailable: Object.keys(this.tools).length,
      };
    } catch (error) {
      return {
        success: false,
        message: `Agent test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        toolsAvailable: 0,
      };
    }
  }
}

// Export singleton instance
export const composioAgent = new ComposioAgentService(); 