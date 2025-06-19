import { OpenAIToolSet } from 'composio-core';

// Initialize Composio toolset
const toolset = new OpenAIToolSet();

// Get all available Composio tools for the ElevenLabs agent
export const getComposioClientTools = async () => {
  try {
    // Get all tools from the 6 main apps (90 tools total)
    const tools = await toolset.getTools({ 
      apps: ['gmail', 'googlecalendar', 'googledocs', 'googledrive', 'googlesheets', 'notion'] 
    });

    console.log(`🔧 Loaded ${tools.length} Composio tools for ElevenLabs integration`);

    // Convert Composio tools to ElevenLabs client tools format
    const clientTools: Record<string, (...args: any[]) => Promise<any>> = {};

    for (const tool of tools) {
      const toolName = tool.function.name;
      
      clientTools[toolName] = async (params: any) => {
        try {
          console.log(`🔧 Executing Composio tool: ${toolName}`, params);
          
          // Execute the tool using Composio
          const result = await toolset.executeAction({
            action: toolName as any,
            params: params || {},
            entityId: 'default' // Will be overridden with actual user entity
          });

          console.log(`✅ Tool ${toolName} executed successfully:`, result);
          
          if (result.successful) {
            return result.data || 'Action completed successfully';
          } else {
            throw new Error(result.error || 'Tool execution failed');
          }
        } catch (error) {
          console.error(`❌ Tool ${toolName} execution failed:`, error);
          throw error;
        }
      };
    }

    console.log(`✅ Converted ${Object.keys(clientTools).length} tools to ElevenLabs client tools format`);
    return clientTools;
  } catch (error) {
    console.error('❌ Failed to load Composio tools:', error);
    return {};
  }
};

// Helper function to get tool descriptions for agent configuration
export const getToolDescriptions = async () => {
  try {
    const tools = await toolset.getTools({ 
      apps: ['gmail', 'googlecalendar', 'googledocs', 'googledrive', 'googlesheets', 'notion'] 
    });

    return tools.map(tool => ({
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters
    }));
  } catch (error) {
    console.error('❌ Failed to get tool descriptions:', error);
    return [];
  }
}; 