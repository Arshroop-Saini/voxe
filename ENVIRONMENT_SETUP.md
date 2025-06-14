# 🔧 Voxe Environment Setup Guide

This guide covers all the API keys and environment variables needed to run the Voxe app.

## 📋 **REQUIRED API KEYS CHECKLIST**

### ✅ **ALREADY CONFIGURED**
- [x] Supabase URL and Anon Key (configured in both backend and mobile)

### ❌ **MISSING - REQUIRED FOR FULL FUNCTIONALITY**

#### 🤖 **AI Services (CRITICAL)**
- [ ] **OpenAI API Key** - Required for voice processing and AI agent
- [ ] **Composio API Key** - Required for tool integrations (Gmail, Calendar, etc.)

#### 🔐 **OAuth Services (CRITICAL)**
- [ ] **Google OAuth Client ID & Secret** - Required for Google Workspace integration
- [ ] **Notion OAuth Client ID & Secret** - Required for Notion integration

## 🚀 **SETUP INSTRUCTIONS**

### 1. **Backend Environment Setup**

Copy the example file and fill in the missing keys:
```bash
cd voxe-backend
cp env.example .env
```

Edit `.env` and add these keys:
```bash
# AI Services - GET THESE FIRST
OPENAI_API_KEY=sk-your-openai-key-here
COMPOSIO_API_KEY=your-composio-key-here

# Google OAuth - SETUP GOOGLE CLOUD PROJECT
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Notion OAuth - SETUP NOTION INTEGRATION
NOTION_CLIENT_ID=your-notion-client-id
NOTION_CLIENT_SECRET=your-notion-client-secret
```

### 2. **Mobile Environment Setup**

Copy the example file:
```bash
cd voxe-mobile
cp env.example .env
```

The mobile app uses the backend's environment variables, so no additional keys needed.

## 🔑 **HOW TO GET API KEYS**

### **OpenAI API Key**
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up/login
3. Go to API Keys section
4. Create new secret key
5. Copy the key (starts with `sk-`)

### **Composio API Key**
1. Go to [Composio Dashboard](https://app.composio.dev/)
2. Sign up/login
3. Go to API Keys section
4. Create new API key
5. Copy the key

### **Google OAuth Setup**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing
3. Enable Google Workspace APIs:
   - Gmail API
   - Google Calendar API
   - Google Drive API
   - Google Docs API
   - Google Sheets API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Set authorized redirect URIs:
   - `http://localhost:3002/api/auth/oauth/google/callback`
6. Copy Client ID and Client Secret

### **Notion OAuth Setup**
1. Go to [Notion Developers](https://developers.notion.com/)
2. Create new integration
3. Set redirect URI: `http://localhost:3002/api/auth/oauth/notion/callback`
4. Copy Client ID and Client Secret

## ⚠️ **CURRENT STATUS**

### **What Works Now:**
- ✅ Supabase authentication
- ✅ Basic mobile UI
- ✅ Backend server structure

### **What Needs API Keys:**
- ❌ Voice processing (needs OpenAI)
- ❌ AI commands (needs OpenAI + Composio)
- ❌ Google Workspace integration (needs Google OAuth)
- ❌ Notion integration (needs Notion OAuth)

## 🧪 **TESTING WITHOUT FULL SETUP**

You can test basic functionality without all keys:
1. Authentication works (Supabase configured)
2. UI navigation works
3. Connection status shows "Not Connected" (expected without OAuth)

But for full functionality, you need all the API keys listed above.

## 🔒 **SECURITY NOTES**

- ✅ **All hardcoded keys have been removed from the codebase**
- ❌ **Never commit `.env` files to git** - they contain sensitive keys
- 🔄 **Rotate API keys regularly** for security
- 🏗️ **Use different keys for development and production**
- 📱 **Mobile app doesn't store sensitive keys** (handled by backend)
- 🔐 **Environment variables are the only way keys enter the app**

## 🚨 **IMPORTANT: SETUP YOUR .env FILES**

After removing hardcoded keys, you MUST create `.env` files:

### Backend:
```bash
cd voxe-backend
cp env.example .env
# Edit .env with your real keys
```

### Mobile:
```bash
cd voxe-mobile  
cp env.example .env
# Edit .env with your real keys
```

**The app will NOT work without proper .env files!**

## 📞 **NEED HELP?**

If you need help getting any of these API keys, let me know which specific service you're having trouble with!

## Critical Fix Required: Supabase Service Role Key

**IMPORTANT**: The OAuth connection issue is caused by missing Supabase Service Role Key in the backend. Follow these steps:

### 1. Get Your Supabase Service Role Key

1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/zwodcjaefewenwnyvldw
2. Click on "Settings" in the left sidebar
3. Click on "API" 
4. Copy the "service_role" key (NOT the anon key)
5. Add it to your backend `.env` file:

```bash
# In voxe-backend/.env
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### 2. Restart Backend Server

After adding the service role key, restart your backend server:

```bash
cd voxe-backend
npm run dev
```

### 3. Test OAuth Connection

The OAuth connection should now work properly:
- Database operations will use the service role key (bypasses RLS)
- Connection requests will be properly stored
- Disconnect functionality will work 