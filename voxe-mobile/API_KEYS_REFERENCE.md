# Voxe Mobile API Keys Reference

This document lists all the API keys and environment variables required for the Voxe mobile application.

## Core Architecture

The **Voxe mobile app** is primarily a **client application** that connects to the backend API. Most API keys are managed by the backend server for security reasons. The mobile app only requires a few environment variables for configuration and direct integrations.

## Required Environment Variables

### Backend API Configuration (🔴 Critical)
- **`EXPO_PUBLIC_API_URL`** - Complete backend server URL
  - **Default**: `http://localhost:3002`
  - **Required for**: All API communication
  - **Used in**: All service files (`services/api.ts`, `services/composio.ts`, etc.)

- **`EXPO_PUBLIC_API_BASE_URL`** - Base URL for API endpoints
  - **Default**: `http://localhost:3002/api`
  - **Required for**: API service calls
  - **Used in**: `services/api.ts`, `services/composio.ts`, `services/emailEmbeddingService.ts`, `services/triggerService.ts`

### Database Configuration (🔴 Critical)
- **`EXPO_PUBLIC_SUPABASE_URL`** - Your Supabase project URL
  - **Required for**: User authentication, data storage
  - **Used in**: `services/supabase.ts`

- **`EXPO_PUBLIC_SUPABASE_ANON_KEY`** - Supabase anonymous key
  - **Required for**: Client-side database operations
  - **Used in**: `services/supabase.ts`

### OAuth & Deep Linking (🟡 Important)
- **`EXPO_PUBLIC_OAUTH_REDIRECT_URL`** - OAuth callback URL for deep linking
  - **Default**: `exp://localhost:8081`
  - **Required for**: OAuth flows (Google, Notion, Composio)
  - **Used in**: `services/supabase.ts`, `services/composio.ts`

## Optional Environment Variables

### ElevenLabs Voice Integration (🟡 Important for Voice Features)
- **`EXPO_PUBLIC_ELEVENLABS_AGENT_ID`** - ElevenLabs Conversational AI agent ID
  - **Required for**: Voice widget functionality
  - **Used in**: `components/ElevenLabsVoiceWidget.tsx`
  - **Note**: This is the agent ID from your ElevenLabs dashboard

### Enhanced AI Features (🟢 Optional)
- **`EXPO_PUBLIC_OPENAI_API_KEY`** - OpenAI API key for direct client operations
  - **Required for**: Direct OpenAI integration (if bypassing backend)
  - **Note**: Currently not used in the codebase - all AI operations go through backend

- **`EXPO_PUBLIC_ELEVENLABS_API_KEY`** - ElevenLabs API key for direct client operations
  - **Required for**: Direct ElevenLabs integration (if bypassing backend)
  - **Note**: Currently not used in the codebase - voice operations go through backend

### App Configuration (🟢 Optional)
- **`EXPO_PUBLIC_APP_NAME`** - Application display name
  - **Default**: `Voxe`
  - **Required for**: App branding

- **`EXPO_PUBLIC_APP_VERSION`** - Application version
  - **Default**: `1.0.0`
  - **Required for**: Version tracking

### Development & Debug (🟢 Optional)
- **`EXPO_PUBLIC_DEV_MODE`** - Enable development mode
  - **Default**: `true`
  - **Required for**: Development features

- **`EXPO_PUBLIC_LOG_LEVEL`** - Logging level
  - **Default**: `debug`
  - **Required for**: Debug logging

## API Key Priority Matrix

### 🔴 Critical (App won't function without these)
1. **`EXPO_PUBLIC_API_URL`** - Backend server connection
2. **`EXPO_PUBLIC_API_BASE_URL`** - API endpoints
3. **`EXPO_PUBLIC_SUPABASE_URL`** - Database connection
4. **`EXPO_PUBLIC_SUPABASE_ANON_KEY`** - Database operations

### 🟡 Important (Major features won't work without these)
1. **`EXPO_PUBLIC_OAUTH_REDIRECT_URL`** - OAuth flows
2. **`EXPO_PUBLIC_ELEVENLABS_AGENT_ID`** - Voice features

### 🟢 Optional (Enhanced features and development)
1. **`EXPO_PUBLIC_OPENAI_API_KEY`** - Direct OpenAI integration
2. **`EXPO_PUBLIC_ELEVENLABS_API_KEY`** - Direct ElevenLabs integration
3. **`EXPO_PUBLIC_APP_NAME`** & **`EXPO_PUBLIC_APP_VERSION`** - App metadata
4. **`EXPO_PUBLIC_DEV_MODE`** & **`EXPO_PUBLIC_LOG_LEVEL`** - Development tools

## Security Architecture

### Client-Side vs Server-Side Keys
- **Client-Side (Mobile App)**: Only contains public/anonymous keys and configuration
- **Server-Side (Backend)**: Contains all sensitive API keys and secrets

### What's Handled by Backend
The backend handles all sensitive operations:
- **OpenAI API calls** - All AI processing
- **Composio integrations** - Tool executions
- **OAuth secrets** - Google, Notion client secrets
- **Webhook secrets** - ElevenLabs, Composio webhook validation
- **Memory management** - Mem0 API operations
- **Email processing** - Supermemory API calls

### What's Handled by Mobile App
The mobile app only handles:
- **Supabase anonymous operations** - User authentication
- **ElevenLabs voice widget** - Direct voice interface (optional)
- **Deep linking** - OAuth callbacks
- **API communication** - Connecting to backend

## Environment Setup

1. Copy `env.example` to `.env`:
   ```bash
   cp env.example .env
   ```

2. Fill in the required values:
   ```bash
   # Critical - Backend connection
   EXPO_PUBLIC_API_URL=http://localhost:3002
   EXPO_PUBLIC_API_BASE_URL=http://localhost:3002/api

   # Critical - Database
   EXPO_PUBLIC_SUPABASE_URL=your-supabase-project-url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

   # Important - OAuth
   EXPO_PUBLIC_OAUTH_REDIRECT_URL=exp://localhost:8081

   # Optional - Voice features
   EXPO_PUBLIC_ELEVENLABS_AGENT_ID=your-elevenlabs-agent-id
   ```

3. For production, update URLs to production endpoints

## Development vs Production

### Development
- Use `localhost` URLs for backend connection
- Use `exp://localhost:8081` for OAuth redirects
- Enable dev mode and debug logging

### Production
- Use production backend URLs
- Use production OAuth redirect URLs
- Configure proper deep linking scheme
- Disable dev mode

## Dependencies

The mobile app uses these packages that require configuration:
- `@supabase/supabase-js` - Requires Supabase URL and anon key
- `@elevenlabs/elevenlabs-js` - For voice widget integration
- `@ai-sdk/elevenlabs` - For AI voice processing
- `expo-linking` - For OAuth deep linking
- `react-native-webview` - For ElevenLabs voice widget

## Deep Linking Configuration

The app is configured for deep linking in `app.json`:
```json
{
  "expo": {
    "scheme": "voxemobile",
    "linking": {
      "prefixes": [
        "voxemobile://",
        "exp://localhost:8081"
      ]
    }
  }
}
```

## Security Notes

- **Never put sensitive API keys** in the mobile app environment variables
- **Use EXPO_PUBLIC_ prefix** for all environment variables (they're included in the build)
- **Validate on backend** - Never trust mobile app requests without server-side validation
- **Use Supabase RLS** - Row Level Security for database operations
- **Keep OAuth secrets on backend** - Only redirect URLs are needed in mobile app

## Testing

The mobile app includes test scripts:
- `scripts/testElevenLabsWebhook.js` - Tests ElevenLabs webhook integration
- `test-email-embedding-integration.js` - Tests email embedding functionality

## Common Issues

1. **Backend Connection Failed**: Check `EXPO_PUBLIC_API_URL` matches your backend server
2. **OAuth Redirect Not Working**: Verify `EXPO_PUBLIC_OAUTH_REDIRECT_URL` matches your app scheme
3. **Voice Widget Not Loading**: Check `EXPO_PUBLIC_ELEVENLABS_AGENT_ID` is correct
4. **Database Operations Failed**: Verify Supabase URL and anon key are correct

## Getting ElevenLabs Agent ID

1. Go to [ElevenLabs Dashboard](https://elevenlabs.io/app)
2. Navigate to "Conversational AI" section
3. Create or select your agent
4. Copy the Agent ID from the URL or settings
5. Add to your `.env` file as `EXPO_PUBLIC_ELEVENLABS_AGENT_ID`

The mobile app architecture prioritizes security by keeping sensitive operations on the backend while providing a smooth user experience through direct integrations where appropriate. 