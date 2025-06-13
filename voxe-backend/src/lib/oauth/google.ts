import express, { Request, Response } from 'express';
import { z } from 'zod';
import { supabase, storeOAuthToken } from '../supabase.js';

const googleRouter = express.Router();

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3002/api/auth/oauth/google/callback';

// Required scopes for Google Workspace
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/chat.messages',
  'https://www.googleapis.com/auth/forms'
];

// OAuth login route - redirects to Google auth
googleRouter.get('/login', (req: Request, res: Response) => {
  const state = Math.random().toString(36).substring(2);
  
  // Store state in session or cookie for CSRF protection
  res.cookie('oauth_state', state, { 
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60 * 1000 // 10 minutes
  });
  
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.append('client_id', GOOGLE_CLIENT_ID);
  authUrl.searchParams.append('redirect_uri', GOOGLE_REDIRECT_URI);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('scope', GOOGLE_SCOPES.join(' '));
  authUrl.searchParams.append('access_type', 'offline');
  authUrl.searchParams.append('prompt', 'consent'); // Force refresh token
  authUrl.searchParams.append('state', state);
  
  res.redirect(authUrl.toString());
});

// OAuth callback route - handles Google response
googleRouter.get('/callback', async (req: Request, res: Response): Promise<void> => {
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
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
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
      refresh_token: z.string(),
      expires_in: z.number(),
      scope: z.string(),
    });
    
    const result = tokenSchema.safeParse(tokenData);
    if (!result.success) {
      console.error('Invalid token response:', result.error);
      res.status(500).json({ error: 'Invalid token response from Google' });
      return;
    }
    
    const { access_token, refresh_token, expires_in, scope } = result.data;
    
    // Get user info with access token
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${access_token}`,
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
      email: z.string().email(),
    });
    
    const userResult = userSchema.safeParse(userInfo);
    if (!userResult.success) {
      console.error('Invalid user info:', userResult.error);
      res.status(500).json({ error: 'Invalid user info from Google' });
      return;
    }
    
    const { id: googleId, email } = userResult.data;
    
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
    
    // Calculate token expiration
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expires_in);
    
    // Store tokens in database
    await storeOAuthToken(
      user.id,
      'google',
      access_token,
      refresh_token,
      expiresAt,
      scope.split(' ')
    );
    
    // Redirect to app with success
    res.redirect(`${process.env.MOBILE_APP_URL || 'exp://localhost:8081'}/oauth-success?provider=google`);
    
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default googleRouter; 