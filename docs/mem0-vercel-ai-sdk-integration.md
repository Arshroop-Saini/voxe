# Mem0 + Vercel AI SDK Integration

> **Source**: https://docs.mem0.ai/integrations/vercel-ai-sdk

📢 **Research Paper**: Mem0 achieves 26% higher accuracy than OpenAI Memory, 91% lower latency, and 90% token savings!

The Mem0 AI SDK Provider is a library developed by Mem0 to integrate with the Vercel AI SDK. This library brings enhanced AI interaction capabilities to your applications by introducing persistent memory functionality.

🎉 **Exciting news!** Mem0 AI SDK now supports **Graph Memory**.

## Overview

🧠 **Offers persistent memory storage** for conversational AI  
🔄 **Enables smooth integration** with the Vercel AI SDK  
🚀 **Ensures compatibility** with multiple LLM providers  
📝 **Supports structured message formats** for clarity  
⚡ **Facilitates streaming response capabilities**

## Setup and Configuration

### Installation

Install the SDK provider using npm:

```bash
npm install @mem0/vercel-ai-provider
```

### Getting Started

#### Setting Up Mem0

1. Get your **Mem0 API Key** from the [Mem0 Dashboard](https://app.mem0.ai/dashboard/api-keys)

2. Initialize the Mem0 Client in your application:

```typescript
import { createMem0 } from "@mem0/vercel-ai-provider";

const mem0 = createMem0({
  provider: "openai",
  mem0ApiKey: "m0-xxx",
  apiKey: "provider-api-key",
  config: {
    compatibility: "strict",
  },
  // Optional Mem0 Global Config
  mem0Config: {
    user_id: "mem0-user-id",
    org_id: "mem0-org-id",
    project_id: "mem0-project-id",
  },
});
```

> **Note**: The `openai` provider is set as default. Consider using `MEM0_API_KEY` and `OPENAI_API_KEY` as environment variables for security.

> **Note**: The `mem0Config` is optional. It is used to set the global config for the Mem0 Client (eg. `user_id`, `agent_id`, `app_id`, `run_id`, `org_id`, `project_id` etc).

#### Add Memories to Enhance Context

```typescript
import { LanguageModelV1Prompt } from "ai";
import { addMemories } from "@mem0/vercel-ai-provider";

const messages: LanguageModelV1Prompt = [
  { role: "user", content: [{ type: "text", text: "I love red cars." }] },
];

await addMemories(messages, { user_id: "borat" });
```

#### Standalone Features

```typescript
await addMemories(messages, { 
  user_id: "borat", 
  mem0ApiKey: "m0-xxx", 
  org_id: "org_xx", 
  project_id: "proj_xx" 
});

await retrieveMemories(prompt, { 
  user_id: "borat", 
  mem0ApiKey: "m0-xxx", 
  org_id: "org_xx", 
  project_id: "proj_xx" 
});

await getMemories(prompt, { 
  user_id: "borat", 
  mem0ApiKey: "m0-xxx", 
  org_id: "org_xx", 
  project_id: "proj_xx" 
});
```

For standalone features, such as `addMemories`, `retrieveMemories`, and `getMemories`, you must either set `MEM0_API_KEY` as an environment variable or pass it directly in the function call.

- **`getMemories`** will return raw memories in the form of an array of objects
- **`retrieveMemories`** will return a response in string format with a system prompt ingested with the retrieved memories

`getMemories` is an object with two keys: `results` and `relations` if `enable_graph` is enabled. Otherwise, it will return an array of objects.

## Usage Examples

### 1. Basic Text Generation with Memory Context

```typescript
import { generateText } from "ai";
import { createMem0 } from "@mem0/vercel-ai-provider";

const mem0 = createMem0();

const { text } = await generateText({
  model: mem0("gpt-4-turbo", { user_id: "borat" }),
  prompt: "Suggest me a good car to buy!",
});
```

### 2. Combining OpenAI Provider with Memory Utils

```typescript
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { retrieveMemories } from "@mem0/vercel-ai-provider";

const prompt = "Suggest me a good car to buy.";
const memories = await retrieveMemories(prompt, { user_id: "borat" });

const { text } = await generateText({
  model: openai("gpt-4-turbo"),
  prompt: prompt,
  system: memories,
});
```

### 3. Structured Message Format with Memory

```typescript
import { generateText } from "ai";
import { createMem0 } from "@mem0/vercel-ai-provider";

const mem0 = createMem0();

const { text } = await generateText({
  model: mem0("gpt-4-turbo", { user_id: "borat" }),
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "Suggest me a good car to buy." },
        { type: "text", text: "Why is it better than the other cars for me?" },
      ],
    },
  ],
});
```

### 4. Streaming Responses with Memory Context

```typescript
import { streamText } from "ai";
import { createMem0 } from "@mem0/vercel-ai-provider";

const mem0 = createMem0();

const { textStream } = await streamText({
  model: mem0("gpt-4-turbo", {
    user_id: "borat",
  }),
  prompt: "Suggest me a good car to buy! Why is it better than the other cars for me? Give options for every price range.",
});

for await (const textPart of textStream) {
  process.stdout.write(textPart);
}
```

### 5. Generate Responses with Tools Call

```typescript
import { generateText } from "ai";
import { createMem0 } from "@mem0/vercel-ai-provider";
import { z } from "zod";

const mem0 = createMem0({
  provider: "anthropic",
  apiKey: "anthropic-api-key",
  mem0Config: {
    // Global User ID
    user_id: "borat"
  }
});

const prompt = "What the temperature in the city that I live in?"

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

### 6. Get Sources from Memory

```typescript
const { text, sources } = await generateText({
  model: mem0("gpt-4-turbo"),
  prompt: "Suggest me a good car to buy!",
});

console.log(sources);
```

The same can be done for `streamText` as well.

## Graph Memory

Mem0 AI SDK now supports **Graph Memory**. You can enable it by setting `enable_graph` to `true` in the `mem0Config` object.

```typescript
const mem0 = createMem0({
  mem0Config: { enable_graph: true },
});
```

You can also pass `enable_graph` in the standalone functions. This includes `getMemories`, `retrieveMemories`, and `addMemories`.

```typescript
const memories = await getMemories(prompt, { 
  user_id: "borat", 
  mem0ApiKey: "m0-xxx", 
  enable_graph: true 
});
```

The `getMemories` function will return an object with two keys: `results` and `relations`, if `enable_graph` is set to `true`. Otherwise, it will return an array of objects.

## Key Features

- **`createMem0()`**: Initializes a new Mem0 provider instance
- **`retrieveMemories()`**: Retrieves memory context for prompts
- **`getMemories()`**: Get memories from your profile in array format
- **`addMemories()`**: Adds user memories to enhance contextual responses

## Best Practices

### User Identification
Use a unique `user_id` for consistent memory retrieval.

### Memory Cleanup
Regularly clean up unused memory data.

> **Note**: We also have support for `agent_id`, `app_id`, and `run_id`. Refer to the [Docs](https://docs.mem0.ai/api-reference/memory/add-memories).

## Integration Patterns

### Voice Interface Integration
```typescript
// For voice commands with memory
const mem0 = createMem0({
  mem0Config: {
    user_id: userId,
    app_id: "voxe-voice",
  }
});

const response = await generateText({
  model: mem0("gpt-4-turbo"),
  prompt: voiceTranscription,
});
```

### Chat Interface Integration
```typescript
// For chat conversations with memory
const mem0 = createMem0({
  mem0Config: {
    user_id: userId,
    app_id: "voxe-chat",
  }
});

const response = await streamText({
  model: mem0("gpt-4-turbo"),
  messages: chatMessages,
});
```

### Cross-Session Memory
```typescript
// Memory persists across sessions
const memories = await retrieveMemories("user preferences", {
  user_id: userId,
  app_id: "voxe-global",
});

// Use memories as system context
const response = await generateText({
  model: openai("gpt-4-turbo"),
  system: memories,
  prompt: userInput,
});
```

## Conclusion

Mem0's Vercel AI SDK enables the creation of intelligent, context-aware applications with persistent memory and seamless integration.

## Help

- For more details on **Vercel AI SDK**, visit the [Vercel AI SDK documentation](https://ai-sdk.dev/docs/introduction)
- For **Mem0 documentation**, refer to the [Mem0 Platform](https://app.mem0.ai/)
- If you need further assistance, please feel free to reach out through the official support channels 