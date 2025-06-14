import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Environment variables
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Create Supabase clients
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Service role client for backend operations (bypasses RLS)
const supabaseServiceClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Types for database tables
const User = {
  id: String,
  email: String,
  created_at: String,
  updated_at: String
};

const OAuthToken = {
  id: String,
  user_id: String,
  provider: String,
  access_token: String,
  refresh_token: String,
  expires_at: String,
  scopes: Array,
  created_at: String,
  updated_at: String
};

// Helper functions for OAuth tokens
const storeOAuthTokenFunction = async (userId: string, provider: string, accessToken: string, refreshToken: string | null, expiresAt: Date | null, scopes: string[]) => {
  const { data, error } = await supabaseClient
    .from('oauth_tokens')
    .upsert({
      user_id: userId,
      provider,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt?.toISOString(),
      scopes
    }, {
      onConflict: 'user_id, provider'
    })
    .select()
    .single();

  if (error) {
    console.error('Error storing OAuth token:', error);
    return null;
  }

  return data;
};

const getOAuthTokenFunction = async (userId: string, provider: string) => {
  const { data, error } = await supabaseClient
    .from('oauth_tokens')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .single();

  if (error) {
    console.error('Error getting OAuth token:', error);
    return null;
  }

  return data;
};

const refreshOAuthTokenFunction = async (userId: string, provider: string, newAccessToken: string, newExpiresAt: Date) => {
  const { error } = await supabaseClient
    .from('oauth_tokens')
    .update({
      access_token: newAccessToken,
      expires_at: newExpiresAt.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .eq('provider', provider);

  if (error) {
    console.error('Error refreshing OAuth token:', error);
    return false;
  }

  return true;
};

export const supabase = supabaseClient;
export const supabaseService = supabaseServiceClient;
export const storeOAuthToken = storeOAuthTokenFunction;
export const getOAuthToken = getOAuthTokenFunction;
export const refreshOAuthToken = refreshOAuthTokenFunction; 