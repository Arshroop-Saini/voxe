import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Disable automatic URL detection to prevent conflicts with Expo Router
    detectSessionInUrl: false,
    // We'll handle OAuth callbacks manually
    autoRefreshToken: true,
    persistSession: true,
  },
});

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

  // Google OAuth sign in
  async signInWithGoogle(): Promise<{ url: string | null; error: string | null }> {
    try {
      // Determine the correct redirect URL based on environment
      const redirectUrl = process.env.EXPO_PUBLIC_OAUTH_REDIRECT_URL || 'http://localhost:8081';
      const authCallbackUrl = `${redirectUrl}/auth/callback`;
      
      console.log('Initiating Google OAuth with redirect URL:', authCallbackUrl);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: authCallbackUrl,
          // Add query redirect to handle post-auth navigation
          queryParams: {
            redirect_to: `${redirectUrl}/auth`
          }
        },
      });

      if (error) {
        console.error('OAuth initiation error:', error);
        return { url: null, error: error.message };
      }

      console.log('OAuth URL generated:', data.url);
      return { url: data.url, error: null };
    } catch (error) {
      console.error('Error in signInWithGoogle:', error);
      return { 
        url: null, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Handle OAuth callback
  async handleOAuthCallback(url: string): Promise<{ success: boolean; error: string | null }> {
    try {
      console.log('Processing OAuth callback URL:', url);
      
      // Validate URL format
      if (!url || typeof url !== 'string') {
        return { success: false, error: 'Invalid URL provided' };
      }
      
      let accessToken: string | null = null;
      let refreshToken: string | null = null;
      
      try {
        // Try to parse as URL object first
        const urlObj = new URL(url);
        
        // Check hash fragment first (most common for OAuth)
        if (urlObj.hash) {
          const fragment = urlObj.hash.substring(1); // Remove the #
          const params = new URLSearchParams(fragment);
          accessToken = params.get('access_token');
          refreshToken = params.get('refresh_token');
        }
        
        // If not found in hash, check query parameters
        if (!accessToken && urlObj.search) {
          const searchParams = urlObj.searchParams;
          accessToken = searchParams.get('access_token');
          refreshToken = searchParams.get('refresh_token');
        }
      } catch (urlError) {
        console.warn('Failed to parse as URL object, trying manual parsing:', urlError);
        
        // Fallback: manual parsing for malformed URLs
        const accessTokenMatch = url.match(/[?&#]access_token=([^&]+)/);
        const refreshTokenMatch = url.match(/[?&#]refresh_token=([^&]+)/);
        
        if (accessTokenMatch) {
          accessToken = decodeURIComponent(accessTokenMatch[1]);
        }
        if (refreshTokenMatch) {
          refreshToken = decodeURIComponent(refreshTokenMatch[1]);
        }
      }
      
      if (accessToken) {
        console.log('Found access token, setting session...');
        
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });
        
        if (error) {
          console.error('Error setting session:', error);
          return { success: false, error: error.message };
        }
        
        console.log('Session set successfully');
        return { success: true, error: null };
      }
      
      return { success: false, error: 'No access token found in URL' };
    } catch (error) {
      console.error('Error in handleOAuthCallback:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Listen to auth state changes
  onAuthStateChange(callback: (user: User | null) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event, session?.user?.email);
      
      const user = session?.user ? {
        id: session.user.id,
        email: session.user.email || '',
        created_at: session.user.created_at || '',
      } : null;
      
      callback(user);
    });
  }
}

export const supabaseService = new SupabaseService(); 