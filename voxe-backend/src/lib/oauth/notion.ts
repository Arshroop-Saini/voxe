import express, { Request, Response } from 'express';
import { z } from 'zod';
import { supabase, storeOAuthToken } from '../supabase.js';

const notionRouter = express.Router();

// Notion OAuth configuration
const NOTION_CLIENT_ID = process.env.NOTION_CLIENT_ID || '';
const NOTION_CLIENT_SECRET = process.env.NOTION_CLIENT_SECRET || '';
const NOTION_REDIRECT_URI = process.env.NOTION_REDIRECT_URI || 'http://localhost:3002/api/auth/oauth/notion/callback';

// OAuth login route - redirects to Notion auth
notionRouter.get('/login', (req: Request, res: Response) => {
  const state = Math.random().toString(36).substring(2);
  
  // Store state in session or cookie for CSRF protection
  res.cookie('oauth_state', state, { 
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60 * 1000 // 10 minutes
  });
  
  const authUrl = new URL('https://api.notion.com/v1/oauth/authorize');
  authUrl.searchParams.append('client_id', NOTION_CLIENT_ID);
  authUrl.searchParams.append('redirect_uri', NOTION_REDIRECT_URI);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('owner', 'user');
  authUrl.searchParams.append('state', state);
  
  res.redirect(authUrl.toString());
});

// OAuth callback route - handles Notion response
notionRouter.get('/callback', async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, state } = req.query;
    const storedState = req.cookies?.oauth_state;
    
    // Validate state to prevent CSRF
    if (!state || !storedState || state !== storedState) {
      res.status(400).json({ error: 'Invalid state parameter' });
      return;
    }
    
    // Clear state cookie
    res.clearCookie('oauth_state');
    
    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Missing authorization code' });
      return;
    }
    
    // Exchange code for tokens
    const tokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${NOTION_CLIENT_ID}:${NOTION_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: NOTION_REDIRECT_URI,
      }),
    });
    
    const tokenData = await tokenResponse.json();
    
    if (!tokenResponse.ok) {
      console.error('Token exchange error:', tokenData);
      res.status(500).json({ error: 'Failed to exchange authorization code' });
      return;
    }
    
    // Validate token response
    const tokenSchema = z.object({
      access_token: z.string(),
      workspace_name: z.string(),
      workspace_id: z.string(),
      bot_id: z.string(),
    });
    
    const result = tokenSchema.safeParse(tokenData);
    if (!result.success) {
      console.error('Invalid token response:', result.error);
      res.status(500).json({ error: 'Invalid token response from Notion' });
      return;
    }
    
    const { access_token, workspace_name, workspace_id, bot_id } = result.data;
    
    // Get user info with access token
    const userInfoResponse = await fetch('https://api.notion.com/v1/users/me', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Notion-Version': '2022-06-28',
      },
    });
    
    const userInfo = await userInfoResponse.json();
    
    if (!userInfoResponse.ok) {
      console.error('User info error:', userInfo);
      res.status(500).json({ error: 'Failed to get user info' });
      return;
    }
    
    // Validate user info
    const userSchema = z.object({
      id: z.string(),
      person: z.object({
        email: z.string().email(),
      }),
    });
    
    const userResult = userSchema.safeParse(userInfo);
    if (!userResult.success) {
      console.error('Invalid user info:', userResult.error);
      res.status(500).json({ error: 'Invalid user info from Notion' });
      return;
    }
    
    const { id: notionId, person: { email } } = userResult.data;
    
    // Check if user exists in Supabase by email
    const { data: existingUsers } = await supabase
      .from('auth.users')
      .select('*')
      .eq('email', email)
      .limit(1);
    
    let user = existingUsers && existingUsers.length > 0 ? existingUsers[0] : null;
    
    // Create user if not exists
    if (!user) {
      const { data: newUser, error: signUpError } = await supabase.auth.signUp({
        email,
        password: Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2),
      });
      
      if (signUpError || !newUser.user) {
        console.error('Error creating user:', signUpError);
        res.status(500).json({ error: 'Failed to create user' });
        return;
      }
      
      user = newUser.user;
      
      // Create user record in users table
      await supabase
        .from('users')
        .insert({
          id: user.id,
          email,
        });
    }
    
    // Store tokens in database (Notion tokens don't expire)
    await storeOAuthToken(
      user.id,
      'notion',
      access_token,
      null, // No refresh token for Notion
      null, // No expiration for Notion tokens
      [`workspace:${workspace_id}`] // Store workspace info in scopes
    );
    
    // Redirect to app with success
    res.redirect(`${process.env.MOBILE_APP_URL || 'exp://localhost:8081'}/oauth-success?provider=notion`);
    
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default notionRouter; 