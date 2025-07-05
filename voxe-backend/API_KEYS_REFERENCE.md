# Voxe Backend API Keys Reference

This document lists all the API keys and environment variables required for the Voxe backend application.

## Core Configuration

### Server Configuration
PORT=3002
NODE_ENV=development
FRONTEND_URL=http://localhost:8081
MOBILE_APP_URL=exp://localhost:8081
BACKEND_URL=http://localhost:3002

## Database & Storage

### Supabase Configuration
SUPABASE_URL=https://zwodcjaefewenwnyvldw.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3b2RjamFlZmV3ZW53bnl2bGR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3ODIwNDEsImV4cCI6MjA2NTM1ODA0MX0.O7a5RapNBcMyxMQT93RFOB7nYj5q_JIBzKs2dUMXVhA
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3b2RjamFlZmV3ZW53bnl2bGR3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTc4MjA0MSwiZXhwIjoyMDY1MzU4MDQxfQ.ryfnvBQ5zfdoQuHD_cOnMQofd3yb1pefB-6RIyQVIZk

## AI Services
OPENAI_API_KEY=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

### Composio
COMPOSIO_API_KEY=1a0wdzgno7mk38nqnp3fx8
COMPOSIO_WEBHOOK_SECRET=3e74931bf8334bb48877005a347064d107117e5de7b7402d6b2f92d39b4debbd
COMPOSIO_LOGGING_LEVEL=debug

### Memory & AI Enhancement
MEM0_API_KEY=m0-DF90O1P1ad5pbj0DMspbqyor68M4VMpcelQeIMIh

## External Services

### Supermemory
SUPERMEMORY_API_KEY=sm_iLbhFxptWffDYhsPzyXkSf_iPGmJTZfHKpddRZmUSFhgyWSiaehkzcfSvHhKtHRDUrfPMYcAWutUxRFLWUdYeNw

### ElevenLabs
ELEVENLABS_WEBHOOK_SECRET=sk_5c854b1fd3db53fdaa4f5601aebb7991d9c0a33f2759cf50

## OAuth Integration

### Google Workspace (Supabase Built-in)
Google OAuth is now handled by Supabase's built-in provider.

**Setup Instructions:**
1. **Go to your Supabase Dashboard** → **Authentication** → **Providers**
2. **Find Google** and click **Configure**
3. **Enable Google provider**
4. **Add your Google OAuth credentials:**
   - **Client ID**: `702532638961-cksoa23pvjd3nlnsottteu6ektkal4cu.apps.googleusercontent.com`
   - **Client Secret**: `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`
5. **Set Site URL**: `https://zwodcjaefewenwnyvldw.supabase.co`
6. **Set Redirect URLs**: `http://localhost:8081` (CRITICAL for web apps)
7. **Save the configuration**

**Required Google Cloud Console Setup:**
1. **Go to Google Cloud Console** → **APIs & Services** → **Credentials**
2. **Edit your OAuth 2.0 Client ID**: `702532638961-cksoa23pvjd3nlnsottteu6ektkal4cu.apps.googleusercontent.com`
3. **Add these to "Authorized redirect URIs"**:
   - `https://zwodcjaefewenwnyvldw.supabase.co/auth/v1/callback` (Supabase)
   - `http://localhost:8081` (Your web app - CRITICAL)
4. **Save the configuration**

**How the Fixed Web OAuth Flow Works:**
1. User clicks "Sign in with Google" button
2. **Current window redirects to Google OAuth** (no new window!)
3. User authorizes the app on Google
4. **Google redirects back to `http://localhost:8081`** with auth tokens in URL
5. **Our app manually processes tokens** (prevents Expo Router conflicts)
6. **Session is set manually** using Supabase API
7. **URL gets cleaned** to remove OAuth parameters
8. **Auth state change fires** → User logged in
9. **No Expo Router conflicts** ✅

**Critical Configuration Notes:**
- **Must add `http://localhost:8081` to BOTH Google Cloud Console AND Supabase Dashboard**
- **OAuth happens in same window** - no new browser windows
- **Manual token processing** prevents Expo Router URL parsing conflicts
- **Supabase auto URL detection is DISABLED** to prevent the "Cannot read properties of undefined" error
- **This completely fixes the Expo Router conflicts**

### Notion
NOTION_CLIENT_ID=211d872b-594c-8022-b3a9-0037b9194c71
NOTION_CLIENT_SECRET=secret_oAsF5wcYEH1C71nNnV0FNucAxbUs6Op4Hifre5acAiT
NOTION_REDIRECT_URI=http://localhost:3002/api/auth/oauth/notion/callback

### 🟡 Important (Major features won't work without these)
1. **`MEM0_API_KEY`** - Memory management for conversations
2. **`SUPERMEMORY_API_KEY`** - Email embedding and search
3. **Google OAuth in Supabase Dashboard** - Google integrations (configured in Supabase, not env vars)
4. **`NOTION_CLIENT_ID`** & **`NOTION_CLIENT_SECRET`** - Notion integrations