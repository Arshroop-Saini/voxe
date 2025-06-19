# Vercel AI SDK: Mem0 Provider

> **Source**: https://ai-sdk.dev/providers/community-providers/mem0

The [Mem0 Provider](https://github.com/mem0ai/mem0/tree/main/vercel-ai-sdk) is a library developed by [**Mem0**](https://mem0.ai) to integrate with the AI SDK. This library brings enhanced AI interaction capabilities to your applications by introducing persistent memory functionality.

🎉 **Exciting news!** Mem0 AI SDK now supports **Tools Call**.

## Setup

The Mem0 provider is available in the `@mem0/vercel-ai-provider` module. You can install it with:

```bash
# pnpm
pnpm add @mem0/vercel-ai-provider

# npm  
npm add @mem0/vercel-ai-provider

# yarn
yarn add @mem0/vercel-ai-provider
```

## Provider Instance

First, get your **Mem0 API Key** from the [Mem0 Dashboard](https://app.mem0.ai/dashboard/api-keys).

Then initialize the `Mem0 Client` in your application:

```typescript
import { createMem0 } from '@mem0/vercel-ai-provider';

const mem0 = createMem0({
  provider: 'openai',
  mem0ApiKey: 'm0-xxx',
  apiKey: 'provider-api-key',
  config: {
    compatibility: 'strict',
  },
  // Optional Mem0 Global Config
  mem0Config: {
    user_id: 'mem0-user-id',
    org_id: 'mem0-org-id',
    project_id: 'mem0-project-id',
  },
});
```

The `openai` provider is set as default. Consider using `MEM0_API_KEY` and `OPENAI_API_KEY` as environment variables for security.

The `mem0Config` is optional. It is used to set the global config for the Mem0 Client (eg. `user_id`, `agent_id`, `app_id`, `run_id`, `org_id`, `project_id` etc).

### Add Memories to Enhance Context

```typescript
import { LanguageModelV1Prompt } from 'ai';
import { addMemories } from '@mem0/vercel-ai-provider';

const messages: LanguageModelV1Prompt = [
  { role: 'user', content: [{ type: 'text', text: 'I love red cars.' }] },
];

await addMemories(messages, { user_id: 'borat' });
```

## Features

### Adding and Retrieving Memories

- **`retrieveMemories()`**: Retrieves memory context for prompts.
- **`getMemories()`**: Get memories from your profile in array format.
- **`addMemories()`**: Adds user memories to enhance contextual responses.

```typescript
await addMemories(messages, {
  user_id: 'borat',
  mem0ApiKey: 'm0-xxx',
  org_id: 'org_xx',
  project_id: 'proj_xx',
});

await retrieveMemories(prompt, {
  user_id: 'borat',
  mem0ApiKey: 'm0-xxx',
  org_id: 'org_xx',
  project_id: 'proj_xx',
});

await getMemories(prompt, {
  user_id: 'borat',
  mem0ApiKey: 'm0-xxx',
  org_id: 'org_xx',
  project_id: 'proj_xx',
});
```

For standalone features, such as `addMemories`, `retrieveMemories`, and `getMemories`, you must either set `MEM0_API_KEY` as an environment variable or pass it directly in the function call.

`getMemories` will return raw memories in the form of an array of objects, while `retrieveMemories` will return a response in string format with a system prompt ingested with the retrieved memories.

### Generate Text with Memory Context

You can use language models from **OpenAI**, **Anthropic**, **Cohere**, and **Groq** to generate text with the `generateText` function:

```typescript
import { generateText } from 'ai';
import { createMem0 } from '@mem0/vercel-ai-provider';

const mem0 = createMem0();

const { text } = await generateText({
  model: mem0('gpt-4-turbo', { user_id: 'borat' }),
  prompt: 'Suggest me a good car to buy!',
});
```

### Structured Message Format with Memory

```typescript
import { generateText } from 'ai';
import { createMem0 } from '@mem0/vercel-ai-provider';

const mem0 = createMem0();

const { text } = await generateText({
  model: mem0('gpt-4-turbo', { user_id: 'borat' }),
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Suggest me a good car to buy.' },
        { type: 'text', text: 'Why is it better than the other cars for me?' },
      ],
    },
  ],
});
```

### Streaming Responses with Memory Context

```typescript
import { streamText } from 'ai';
import { createMem0 } from '@mem0/vercel-ai-provider';

const mem0 = createMem0();

const { textStream } = await streamText({
  model: mem0('gpt-4-turbo', {
    user_id: 'borat',
  }),
  prompt:
    'Suggest me a good car to buy! Why is it better than the other cars for me? Give options for every price range.',
});

for await (const textPart of textStream) {
  process.stdout.write(textPart);
}
```

### Generate Responses with Tools Call

```typescript
import { generateText } from 'ai';
import { createMem0 } from '@mem0/vercel-ai-provider';
import { z } from 'zod';

const mem0 = createMem0({
  provider: 'anthropic',
  apiKey: 'anthropic-api-key',
  mem0Config: {
    // Global User ID
    user_id: 'borat',
  },
});

const prompt = 'What the temperature in the city that I live in?';

const result = await generateText({
  model: mem0('claude-3-5-sonnet-20240620'),
  tools: {
    weather: tool({
      description: 'Get the weather in a location',
      parameters: z.object({
        location: z.string().describe('The location to get the weather for'),
      }),
      execute: async ({ location }) => ({
        location,
        temperature: 72 + Math.floor(Math.random() * 21) - 10,
      }),
    }),
  },
  prompt: prompt,
});

console.log(result);
```

### Get Sources from Memory

```typescript
const { text, sources } = await generateText({
  model: mem0('gpt-4-turbo'),
  prompt: 'Suggest me a good car to buy!',
});

console.log(sources);
```

This same functionality is available in the `streamText` function.

## Best Practices

### User Identification
Use a unique `user_id` for consistent memory retrieval.

### Memory Cleanup
Regularly clean up unused memory data.

We also have support for `agent_id`, `app_id`, and `run_id`. Refer to the [Docs](https://docs.mem0.ai/api-reference/memory/add-memories).

## Configuration Options

### Provider Configuration

```typescript
const mem0 = createMem0({
  provider: 'openai', // 'openai' | 'anthropic' | 'cohere' | 'groq'
  mem0ApiKey: process.env.MEM0_API_KEY,
  apiKey: process.env.OPENAI_API_KEY, // Provider API key
  config: {
    compatibility: 'strict', // 'strict' | 'compatible'
  },
});
```

### Memory Configuration

```typescript
const mem0 = createMem0({
  mem0Config: {
    user_id: 'unique-user-id',
    agent_id: 'agent-identifier',
    app_id: 'application-id',
    run_id: 'run-identifier', 
    org_id: 'organization-id',
    project_id: 'project-id',
  },
});
```

### Environment Variables

```bash
# Required
MEM0_API_KEY=m0-your-api-key-here
OPENAI_API_KEY=sk-your-openai-key-here

# Optional (if using other providers)
ANTHROPIC_API_KEY=your-anthropic-key
COHERE_API_KEY=your-cohere-key
GROQ_API_KEY=your-groq-key
```

## Integration Patterns

### Basic Integration

```typescript
import { createMem0 } from '@mem0/vercel-ai-provider';
import { generateText } from 'ai';

const mem0 = createMem0();

const response = await generateText({
  model: mem0('gpt-4-turbo', { user_id: 'user-123' }),
  prompt: 'What are my preferences?',
});
```

### Standalone Memory Operations

```typescript
import { addMemories, retrieveMemories, getMemories } from '@mem0/vercel-ai-provider';

// Add memories
await addMemories([
  { role: 'user', content: [{ type: 'text', text: 'I prefer electric cars' }] }
], { user_id: 'user-123' });

// Retrieve memories as system prompt
const systemPrompt = await retrieveMemories('car preferences', { user_id: 'user-123' });

// Get raw memories
const memories = await getMemories('preferences', { user_id: 'user-123' });
```

### With Different Providers

```typescript
// OpenAI (default)
const mem0OpenAI = createMem0({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
});

// Anthropic
const mem0Anthropic = createMem0({
  provider: 'anthropic', 
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Cohere
const mem0Cohere = createMem0({
  provider: 'cohere',
  apiKey: process.env.COHERE_API_KEY,
});

// Groq
const mem0Groq = createMem0({
  provider: 'groq',
  apiKey: process.env.GROQ_API_KEY,
});
```

## Help

- For more details on Vercel AI SDK, visit the [Vercel AI SDK documentation](https://ai-sdk.dev/docs/introduction).
- For Mem0 documentation, refer to the [Mem0 Platform](https://app.mem0.ai/).
- If you need further assistance, please feel free to reach out through the official support channels.

## References

- [Mem0 AI SDK Docs](https://docs.mem0.ai/integrations/vercel-ai-sdk#getting-started)
- [Mem0 documentation](https://docs.mem0.ai) 