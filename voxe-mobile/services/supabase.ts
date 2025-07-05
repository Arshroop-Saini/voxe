import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

console.log('🔧 Supabase Service Initialization:', {
  supabaseUrl: supabaseUrl ? 'SET' : 'NOT SET',
  supabaseAnonKey: supabaseAnonKey ? 'SET' : 'NOT SET',
  urlValue: supabaseUrl,
  keyLength: supabaseAnonKey.length
});

if (!supabaseUrl) {
  console.error('❌ EXPO_PUBLIC_SUPABASE_URL is not set!');
  throw new Error('supabaseUrl is required.');
}

if (!supabaseAnonKey) {
  console.error('❌ EXPO_PUBLIC_SUPABASE_ANON_KEY is not set!');
  throw new Error('supabaseAnonKey is required.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Disable automatic URL detection to prevent conflicts with Expo Router
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // CRITICAL: Disable this to prevent Expo Router conflicts
    // Add storage key to avoid conflicts
    storageKey: 'voxe-auth-token',
    // Add custom storage for better web compatibility
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

console.log('✅ Supabase client created successfully');

export { supabase };

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface AuthResponse {
  user: User | null;
  error: string | null;
}

class SupabaseService {
  async signUp(email: string, password: string): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        return { user: null, error: error.message };
      }

      return { 
        user: data.user ? {
          id: data.user.id,
          email: data.user.email || '',
          created_at: data.user.created_at || '',
        } : null, 
        error: null 
      };
    } catch (error) {
      return { 
        user: null, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async signIn(email: string, password: string): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { user: null, error: error.message };
      }

      return { 
        user: data.user ? {
          id: data.user.id,
          email: data.user.email || '',
          created_at: data.user.created_at || '',
        } : null, 
        error: null 
      };
    } catch (error) {
      return { 
        user: null, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async signOut(): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.auth.signOut();
      return { error: error ? error.message : null };
    } catch (error) {
      return { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return null;

      return {
        id: user.id,
        email: user.email || '',
        created_at: user.created_at || '',
      };
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  async getCurrentSession() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  // Google OAuth sign in - SIMPLIFIED for web
  async signInWithGoogle(): Promise<{ url: string | null; error: string | null }> {
    try {
      console.log('🚀 Starting Google OAuth for web app - will redirect current window');
      
      // For web apps, redirect the current window (not open new window)
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin, // Redirect back to same origin
          skipBrowserRedirect: false, // Allow the redirect to happen
        },
      });

      if (error) {
        console.error('❌ OAuth error:', error);
        return { url: null, error: error.message };
      }

      // This will cause the current window to redirect to Google OAuth
      // When user approves, Google will redirect back with tokens in URL
      // Our handleOAuthFromURL will process those tokens manually
      console.log('✅ OAuth redirect initiated - redirecting to Google...');
      return { url: null, error: null };
    } catch (error) {
      console.error('❌ Error in signInWithGoogle:', error);
      return { 
        url: null, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Handle OAuth callback - NOW NEEDED since we disabled detectSessionInUrl
  async handleOAuthCallback(url: string): Promise<{ success: boolean; error: string | null }> {
    try {
      console.log('🔐 Processing OAuth callback URL manually:', url);
      
      // Extract tokens from URL
      let accessToken: string | null = null;
      let refreshToken: string | null = null;
      let tokenType: string | null = null;
      
      // Parse URL for tokens
      const urlObj = new URL(url);
      
      // Check hash fragment first (most common for OAuth)
      if (urlObj.hash) {
        const fragment = urlObj.hash.substring(1); // Remove the #
        const params = new URLSearchParams(fragment);
        accessToken = params.get('access_token');
        refreshToken = params.get('refresh_token');
        tokenType = params.get('token_type');
      }
      
      // If not found in hash, check query parameters
      if (!accessToken && urlObj.search) {
        const searchParams = urlObj.searchParams;
        accessToken = searchParams.get('access_token');
        refreshToken = searchParams.get('refresh_token');
        tokenType = searchParams.get('token_type');
      }
      
      if (accessToken) {
        console.log('✅ Found access token, setting session...');
        
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });
        
        if (error) {
          console.error('❌ Error setting session:', error);
          return { success: false, error: error.message };
        }
        
        console.log('✅ Session set successfully');
        return { success: true, error: null };
      }
      
      return { success: false, error: 'No access token found in URL' };
    } catch (error) {
      console.error('❌ Error in handleOAuthCallback:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Listen to auth state changes
  onAuthStateChange(callback: (user: User | null) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      try {
        console.log('🔄 Auth state change event:', event);
        if (session?.user) {
          console.log('✅ Session user:', session.user.email);
        }
        
        const user = session?.user ? {
          id: session.user.id,
          email: session.user.email || '',
          created_at: session.user.created_at || '',
        } : null;
        
        callback(user);
      } catch (error) {
        console.error('❌ Error in auth state change handler:', error);
        callback(null); // Fallback to no user on error
      }
    });
  }
}

export const supabaseService = new SupabaseService(); 