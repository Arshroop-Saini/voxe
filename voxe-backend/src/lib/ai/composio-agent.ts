import { openai } from '@ai-sdk/openai';
import { VercelAIToolSet } from 'composio-core';
import { generateText, CoreTool } from 'ai';

/**
 * Composio-powered AI Agent Service
 * Provides access to 250+ tools including Gmail, Google Calendar, Google Docs, 
 * Google Drive, Google Sheets, and Notion through managed authentication
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
  }

  /**
   * Initialize the agent with required tools
   */
  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        return;
      }

      console.log('🚀 Initializing Composio AI Agent...');
      
      // Get tools for our core productivity apps
      this.tools = await this.toolset.getTools({ 
        apps: ["gmail", "googlecalendar", "googledocs", "googledrive", "googlesheets", "notion"] 
      });
      
      console.log(`✅ Loaded ${Object.keys(this.tools).length} tools from Composio`);
      console.log('📧 Available apps: Gmail, Google Calendar, Google Docs, Google Drive, Google Sheets, Notion');
      
      this.isInitialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize Composio agent:', error);
      throw new Error('Failed to initialize AI agent with tools');
    }
  }

  /**
   * Execute a complex multi-step workflow with detailed tracking
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

      console.log(`🚀 Executing complex workflow: "${userCommand}"`);
      
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
        await this.toolset.getTools({ 
          apps: ["gmail", "googlecalendar", "googledocs", "googledrive", "googlesheets", "notion"]
        }, userId) : this.tools;

      const result = await generateText({
        model: openai(this.model),
        tools: toolsToUse,
        prompt: userCommand,
        maxSteps: maxSteps,
        system: `You are Voxe, an AI-powered productivity assistant that excels at multi-step workflows across Gmail, Google Calendar, Google Docs, Google Drive, Google Sheets, and Notion.

🎯 CORE CAPABILITIES:
- 📧 Gmail: Send/read emails, manage threads, organize with labels, search contacts
- 📅 Calendar: Create/update events, find free slots, manage attendees, schedule meetings
- 📄 Docs: Create/edit documents, collaborate, format content, share files
- 💾 Drive: Upload/organize files, manage permissions, create folders, share resources
- 📊 Sheets: Create spreadsheets, analyze data, generate reports, manage formulas
- 📝 Notion: Create pages, update databases, manage workspaces, organize content

🚀 MULTI-TOOL WORKFLOW EXPERTISE:
When handling complex requests, break them down into logical steps:
1. **Analyze** the user's request to identify all required actions
2. **Plan** the optimal sequence of tool usage
3. **Execute** each step methodically, providing status updates
4. **Verify** results and handle any errors gracefully
5. **Summarize** what was accomplished

💡 WORKFLOW EXAMPLES:
- "Prepare for Monday's meeting" → Check calendar → Create agenda doc → Email attendees
- "Organize project files" → Create Drive folder → Move files → Update permissions → Notify team
- "Weekly report setup" → Fetch data from Sheets → Create Doc → Schedule email → Add to calendar

🎯 EXECUTION PRINCIPLES:
- Always explain what you're doing at each step
- Provide detailed status updates for each action taken
- Handle errors gracefully and suggest alternatives
- Ask for clarification when user intent is ambiguous
- Optimize tool usage for efficiency (batch operations when possible)
- IMPORTANT: Clearly describe each step you're taking as you execute the workflow

Execute the user's request using the available tools, leveraging multi-step workflows when beneficial. Provide clear step-by-step updates as you work.`,

      });

      const executionTime = Date.now() - startTime;
      
      // Extract tool usage information
      const toolsUsed = result.toolCalls?.map(call => call.toolName) || [];
      const steps = result.toolCalls?.length || 0;
      
      console.log(`✅ Workflow executed in ${executionTime}ms`);
      console.log(`🔧 Tools used: ${toolsUsed.join(', ') || 'None'}`);
      console.log(`📊 Steps taken: ${steps}`);
      console.log(`🔄 Workflow steps: ${workflowSteps.length}`);
      
      return {
        success: true,
        response: result.text,
        toolsUsed: [...new Set(toolsUsed)], // Remove duplicates
        steps,
        workflowSteps,
        executionTime,
      };
      
    } catch (error) {
      console.error('❌ Workflow execution failed:', error);
      
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
   * Execute a natural language command using the AI agent
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

      console.log(`🎯 Executing command: "${userCommand}"`);
      
      const startTime = Date.now();
      
      // Configure tools with entity context if userId provided
      const toolsToUse = userId ? 
        await this.toolset.getTools({ 
          apps: ["gmail", "googlecalendar", "googledocs", "googledrive", "googlesheets", "notion"]
        }, userId) : this.tools;
      
      const result = await generateText({
        model: openai(this.model),
        tools: toolsToUse,
        prompt: userCommand,
        maxSteps: maxSteps,
        system: `You are Voxe, an AI-powered productivity assistant that excels at multi-step workflows across Gmail, Google Calendar, Google Docs, Google Drive, Google Sheets, and Notion.

🎯 CORE CAPABILITIES:
- 📧 Gmail: Send/read emails, manage threads, organize with labels, search contacts
- 📅 Calendar: Create/update events, find free slots, manage attendees, schedule meetings
- 📄 Docs: Create/edit documents, collaborate, format content, share files
- 💾 Drive: Upload/organize files, manage permissions, create folders, share resources
- 📊 Sheets: Create spreadsheets, analyze data, generate reports, manage formulas
- 📝 Notion: Create pages, update databases, manage workspaces, organize content

🚀 MULTI-TOOL WORKFLOW EXPERTISE:
When handling complex requests, break them down into logical steps:
1. **Analyze** the user's request to identify all required actions
2. **Plan** the optimal sequence of tool usage
3. **Execute** each step methodically, providing status updates
4. **Verify** results and handle any errors gracefully
5. **Summarize** what was accomplished

💡 WORKFLOW EXAMPLES:
- "Prepare for Monday's meeting" → Check calendar → Create agenda doc → Email attendees
- "Organize project files" → Create Drive folder → Move files → Update permissions → Notify team
- "Weekly report setup" → Fetch data from Sheets → Create Doc → Schedule email → Add to calendar

🎯 EXECUTION PRINCIPLES:
- Always explain what you're doing at each step
- Confirm destructive actions before executing
- Provide clear status updates during multi-step processes
- Handle errors gracefully and suggest alternatives
- Ask for clarification when user intent is ambiguous
- Optimize tool usage for efficiency (batch operations when possible)

Execute the user's request using the available tools, leveraging multi-step workflows when beneficial.`,
      });

      const executionTime = Date.now() - startTime;
      
      // Extract tool usage information
      const toolsUsed = result.toolCalls?.map(call => call.toolName) || [];
      const steps = result.toolCalls?.length || 0;
      
      console.log(`✅ Command executed in ${executionTime}ms`);
      console.log(`🔧 Tools used: ${toolsUsed.join(', ') || 'None'}`);
      console.log(`📊 Steps taken: ${steps}`);
      
      return {
        success: true,
        response: result.text,
        toolsUsed: [...new Set(toolsUsed)], // Remove duplicates
        steps,
      };
      
    } catch (error) {
      console.error('❌ Command execution failed:', error);
      
      return {
        success: false,
        response: `I encountered an error while processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        toolsUsed: [],
        steps: 0,
      };
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