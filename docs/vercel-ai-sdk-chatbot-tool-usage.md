# Vercel AI SDK: Chatbot Tool Usage

> **Source**: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage

With `useChat` and `streamText`, you can use tools in your chatbot application. The AI SDK supports three types of tools in this context:

1. **Automatically executed server-side tools**
2. **Automatically executed client-side tools** 
3. **Tools that require user interaction**, such as confirmation dialogs

## Tool Flow Overview

1. The user enters a message in the chat UI
2. The message is sent to the API route
3. In your server side route, the language model generates tool calls during the `streamText` call
4. All tool calls are forwarded to the client
5. Server-side tools are executed using their `execute` method and their results are forwarded to the client
6. Client-side tools that should be automatically executed are handled with the `onToolCall` callback
7. Client-side tool that require user interactions can be displayed in the UI
8. When the user interaction is done, `addToolResult` can be used to add the tool result to the chat
9. When there are tool calls in the last assistant message and all tool results are available, the client sends the updated messages back to the server

## Multi-Step Configuration

In order to automatically send another request to the server when all tool calls are server-side, you need to set `maxSteps` to a value greater than 1 in the `useChat` options. It is disabled by default for backward compatibility.

## Complete Example

### API Route Implementation

**app/api/chat/route.ts**
```typescript
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { z } from 'zod';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    messages,
    tools: {
      // server-side tool with execute function:
      getWeatherInformation: {
        description: 'show the weather in a given city to the user',
        parameters: z.object({ city: z.string() }),
        execute: async ({ city }: { city: string }) => {
          const weatherOptions = ['sunny', 'cloudy', 'rainy', 'snowy', 'windy'];
          return weatherOptions[
            Math.floor(Math.random() * weatherOptions.length)
          ];
        },
      },
      // client-side tool that starts user interaction:
      askForConfirmation: {
        description: 'Ask the user for confirmation.',
        parameters: z.object({
          message: z.string().describe('The message to ask for confirmation.'),
        }),
      },
      // client-side tool that is automatically executed on the client:
      getLocation: {
        description:
          'Get the user location. Always ask for confirmation before using this tool.',
        parameters: z.object({}),
      },
    },
  });

  return result.toDataStreamResponse();
}
```

### Client-Side Implementation

**app/page.tsx**
```typescript
'use client';

import { ToolInvocation } from 'ai';
import { useChat } from '@ai-sdk/react';

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit, addToolResult } =
    useChat({
      maxSteps: 5,
      // run client-side tools that are automatically executed:
      async onToolCall({ toolCall }) {
        if (toolCall.toolName === 'getLocation') {
          const cities = [
            'New York',
            'Los Angeles', 
            'Chicago',
            'San Francisco',
          ];
          return cities[Math.floor(Math.random() * cities.length)];
        }
      },
    });

  return (
    <>
      {messages?.map(message => (
        <div key={message.id}>
          <strong>{`${message.role}: `}</strong>
          {message.parts.map(part => {
            switch (part.type) {
              // render text parts as simple text:
              case 'text':
                return part.text;
              
              // for tool invocations, distinguish between the tools and the state:
              case 'tool-invocation': {
                const callId = part.toolInvocation.toolCallId;
                
                switch (part.toolInvocation.toolName) {
                  case 'askForConfirmation': {
                    switch (part.toolInvocation.state) {
                      case 'call':
                        return (
                          <div key={callId}>
                            {part.toolInvocation.args.message}
                            <div>
                              <button
                                onClick={() =>
                                  addToolResult({
                                    toolCallId: callId,
                                    result: 'Yes, confirmed.',
                                  })
                                }
                              >
                                Yes
                              </button>
                              <button
                                onClick={() =>
                                  addToolResult({
                                    toolCallId: callId,
                                    result: 'No, denied',
                                  })
                                }
                              >
                                No
                              </button>
                            </div>
                          </div>
                        );
                      case 'result':
                        return (
                          <div key={callId}>
                            Location access allowed:{' '}
                            {part.toolInvocation.result}
                          </div>
                        );
                    }
                    break;
                  }
                  
                  case 'getLocation': {
                    switch (part.toolInvocation.state) {
                      case 'call':
                        return <div key={callId}>Getting location...</div>;
                      case 'result':
                        return (
                          <div key={callId}>
                            Location: {part.toolInvocation.result}
                          </div>
                        );
                    }
                    break;
                  }
                  
                  case 'getWeatherInformation': {
                    switch (part.toolInvocation.state) {
                      // example of pre-rendering streaming tool calls:
                      case 'partial-call':
                        return (
                          <pre key={callId}>
                            {JSON.stringify(part.toolInvocation, null, 2)}
                          </pre>
                        );
                      case 'call':
                        return (
                          <div key={callId}>
                            Getting weather information for{' '}
                            {part.toolInvocation.args.city}...
                          </div>
                        );
                      case 'result':
                        return (
                          <div key={callId}>
                            Weather in {part.toolInvocation.args.city}:{' '}
                            {part.toolInvocation.result}
                          </div>
                        );
                    }
                    break;
                  }
                }
              }
            }
          })}
          <br />
        </div>
      ))}
      
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
      </form>
    </>
  );
}
```

## Tool Call Streaming

You can stream tool calls while they are being generated by enabling the `toolCallStreaming` option in `streamText`.

**app/api/chat/route.ts**
```typescript
export async function POST(req: Request) {
  // ...
  const result = streamText({
    toolCallStreaming: true,
    // ...
  });

  return result.toDataStreamResponse();
}
```

When the flag is enabled, partial tool calls will be streamed as part of the data stream. They are available through the `useChat` hook.

**app/page.tsx**
```typescript
export default function Chat() {
  // ...
  return (
    <>
      {messages?.map(message => (
        <div key={message.id}>
          {message.parts.map(part => {
            if (part.type === 'tool-invocation') {
              switch (part.toolInvocation.state) {
                case 'partial-call':
                  return <>render partial tool call</>;
                case 'call':
                  return <>render full tool call</>;
                case 'result':
                  return <>render tool result</>;
              }
            }
          })}
        </div>
      ))}
    </>
  );
}
```

## Step Start Parts

When you are using multi-step tool calls, the AI SDK will add step start parts to the assistant messages. If you want to display boundaries between tool invocations, you can use the `step-start` parts as follows:

**app/page.tsx**
```typescript
// where you render the message parts:
message.parts.map((part, index) => {
  switch (part.type) {
    case 'step-start':
      // show step boundaries as horizontal lines:
      return index > 0 ? (
        <div key={index} className="text-gray-500">
          <hr className="my-2 border-gray-300" />
        </div>
      ) : null;
    case 'text':
      // ...
    case 'tool-invocation':
      // ...
  }
});
```

## Server-Side Multi-Step Calls

You can also use multi-step calls on the server-side with `streamText`. This works when all invoked tools have an `execute` function on the server side.

**app/api/chat/route.ts**
```typescript
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { z } from 'zod';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    messages,
    tools: {
      getWeatherInformation: {
        description: 'show the weather in a given city to the user',
        parameters: z.object({ city: z.string() }),
        // tool has execute function:
        execute: async ({ city }: { city: string }) => {
          const weatherOptions = ['sunny', 'cloudy', 'rainy', 'snowy', 'windy'];
          return weatherOptions[
            Math.floor(Math.random() * weatherOptions.length)
          ];
        },
      },
    },
    maxSteps: 5,
  });

  return result.toDataStreamResponse();
}
```

## Error Handling

Language models can make errors when calling tools. By default, these errors are masked for security reasons, and show up as "An error occurred" in the UI.

### Custom Error Handler

```typescript
export function errorHandler(error: unknown) {
  if (error == null) {
    return 'unknown error';
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return JSON.stringify(error);
}
```

### Using Error Handler

```typescript
const result = streamText({
  // ...
});

return result.toDataStreamResponse({
  getErrorMessage: errorHandler,
});
```

### With createDataStreamResponse

```typescript
const response = createDataStreamResponse({
  // ...
  async execute(dataStream) {
    // ...
  },
  onError: error => `Custom error: ${error.message}`,
});
```

## Tool Invocation States

Tool invocations have different states during their lifecycle:

- **`partial-call`**: Tool call is being streamed (only with `toolCallStreaming: true`)
- **`call`**: Complete tool call received, execution starting
- **`result`**: Tool execution completed, result available

## Key Concepts

### Server-Side Tools
- Have an `execute` function that runs on the server
- Results are automatically sent back to the client
- Ideal for API calls, database operations, sensitive operations

### Client-Side Tools  
- Two types: automatic execution and user interaction
- Automatic: Handle via `onToolCall` callback
- User interaction: Render UI elements and use `addToolResult`

### Multi-Step Workflows
- Enable with `maxSteps > 1` in `useChat`
- AI can chain multiple tool calls automatically
- Use step boundaries to visually separate tool invocations

### Message Parts
- Messages contain multiple parts: text, tool-invocation, step-start
- Always iterate through `message.parts` to render complete content
- Handle different part types appropriately in your UI
``` 