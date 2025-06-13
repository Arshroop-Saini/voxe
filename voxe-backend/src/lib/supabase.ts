import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Environment variables
const supabaseUrl = process.env.SUPABASE_URL || 'https://zwodcjaefewenwnyvldw.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3b2RjamFlZmV3ZW53bnl2bGR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3ODIwNDEsImV4cCI6MjA2NTM1ODA0MX0.O7a5RapNBcMyxMQT93RFOB7nYj5q_JIBzKs2dUMXVhA';

// Create Supabase client
const supabaseClient = createClient(supabaseUrl, supabaseKey);

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
export const storeOAuthToken = storeOAuthTokenFunction;
export const getOAuthToken = getOAuthTokenFunction;
export const refreshOAuthToken = refreshOAuthTokenFunction; 