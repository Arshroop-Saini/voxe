import { openai } from '@ai-sdk/openai';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';

// AI Service Configuration
export class AIService {
  private model: string;
  
  constructor() {
    // Use GPT-4o for command processing
    this.model = 'gpt-4o';
    
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OpenAI API key not configured. AI features will be limited.');
    }
  }

  /**
   * Test basic AI completion functionality
   */
  async testCompletion(prompt: string): Promise<string> {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return `Mock AI response for: "${prompt}"`;
      }

      const { text } = await generateText({
        model: openai(this.model),
        prompt,
        maxTokens: 100,
      });

      return text;
    } catch (error) {
      console.error('AI completion error:', error);
      throw new Error('Failed to generate AI completion');
    }
  }

  /**
   * Generate structured output using schema validation
   */
  async generateStructured<T>(
    prompt: string, 
    schema: z.ZodSchema<T>,
    systemPrompt?: string
  ): Promise<T> {
    try {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
      }

      const { object } = await generateObject({
        model: openai(this.model),
        schema,
        prompt,
        system: systemPrompt,
      });

      return object;
    } catch (error) {
      console.error('AI structured generation error:', error);
      throw new Error('Failed to generate structured AI response');
    }
  }

  /**
   * Check if AI service is properly configured
   */
  isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  /**
   * Get model information
   */
  getModelInfo(): { model: string; configured: boolean } {
    return {
      model: this.model,
      configured: this.isConfigured(),
    };
  }
}

// Export singleton instance
export const aiService = new AIService(); 