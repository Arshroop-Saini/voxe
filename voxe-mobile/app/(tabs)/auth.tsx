import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Text, View } from '@/components/Themed';
import { supabaseService } from '@/services/supabase';
import { supabase } from '@/services/supabase';
import ErrorBoundary from '@/components/ErrorBoundary';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [initialized, setInitialized] = useState(false);

  // Utility function to safely clean OAuth URLs
  const cleanOAuthUrl = () => {
    try {
      if (typeof window !== 'undefined') {
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        console.log('🧹 URL cleaned successfully');
      }
    } catch (error) {
      console.error('❌ Error cleaning URL:', error);
    }
  };

  useEffect(() => {
    if (initialized) return; // Prevent multiple initializations
    
    setInitialized(true);
    
    // Handle OAuth callback in URL on page load
    const handleOAuthFromURL = async () => {
      try {
        // Check if we're in a browser environment
        if (typeof window === 'undefined') return;
        
        const currentUrl = window.location.href;
        console.log('🌐 Current URL:', currentUrl);
        
        if (currentUrl.includes('access_token=') || currentUrl.includes('refresh_token=')) {
          console.log('🔐 OAuth callback detected in URL on page load');
          
          // Manually process the OAuth callback since we disabled Supabase's auto-detection
          const { success, error } = await supabaseService.handleOAuthCallback(currentUrl);
          
          if (success) {
            console.log('✅ OAuth callback processed successfully');
            // Load user to update state
            await loadUser();
            // Clear loading state immediately
            setLoading(false);
            Alert.alert('Success', 'Signed in with Google successfully!');
          } else {
            console.error('❌ OAuth callback failed:', error);
            // Clear loading state on error too
            setLoading(false);
            Alert.alert('Error', error || 'OAuth callback failed');
          }
          
          // Clean up the URL to prevent Expo Router issues
          setTimeout(() => {
            cleanOAuthUrl();
          }, 1000);
        }
      } catch (error) {
        console.error('❌ Error handling OAuth from URL:', error);
      }
    };
    
    handleOAuthFromURL();
    loadUser();
    
    // Listen to auth state changes
    const { data: { subscription } } = supabaseService.onAuthStateChange((user) => {
      console.log('🔄 Auth state changed:', user ? `User: ${user.email}` : 'No user');
      setUser(user);
      
      // Clear loading state if user is authenticated
      if (user && loading) {
        console.log('✅ User authenticated, clearing loading state');
        setLoading(false);
        
        // Only show success alert if we haven't already shown it in handleOAuthFromURL
        const currentUrl = window.location.href;
        if (!currentUrl.includes('access_token=')) {
          Alert.alert('Success', 'Signed in successfully!');
        }
        
        // Clean URL when user is authenticated
        setTimeout(() => {
          cleanOAuthUrl();
        }, 1000);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [initialized, loading]);

  const loadUser = async () => {
    try {
      const currentUser = await supabaseService.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setLoading(true);

    try {
      const result = isSignUp 
        ? await supabaseService.signUp(email, password)
        : await supabaseService.signIn(email, password);

      if (result.error) {
        Alert.alert('Error', result.error);
      } else {
        Alert.alert(
          'Success', 
          isSignUp 
            ? 'Account created successfully! Please check your email to verify your account.'
            : 'Signed in successfully!'
        );
        setEmail('');
        setPassword('');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    console.log('🔥 GOOGLE SIGN IN BUTTON PRESSED');
    
    try {
      setLoading(true);
      
      // For web apps, this will redirect the current window to Google OAuth
      // No need to handle URLs manually - Supabase does everything
      const { url, error } = await supabaseService.signInWithGoogle();
      
      if (error) {
        console.error('❌ OAuth error:', error);
        Alert.alert('Error', error);
        setLoading(false);
        return;
      }
      
      // If we get here without error, the page should redirect to Google
      // The loading state will be cleared by auth state change when user returns
      console.log('✅ OAuth redirect should happen now...');
      
    } catch (error) {
      console.error('❌ Google OAuth error:', error);
      Alert.alert('Error', 'Failed to start Google sign in');
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabaseService.signOut();
      if (error) {
        Alert.alert('Error', error);
      } else {
        Alert.alert('Success', 'Signed out successfully');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  if (user) {
    return (
      <ErrorBoundary>
        <KeyboardAvoidingView 
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.content}>
            <Text style={styles.title}>Settings</Text>
            <Text style={styles.subtitle}>Manage your account and preferences</Text>

            <View style={styles.userSection}>
              <Text style={styles.userTitle}>Account</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
              <Text style={styles.userDate}>
                Member since: {new Date(user.created_at).toLocaleDateString()}
              </Text>
              
              <TouchableOpacity 
                style={styles.signOutButton}
                onPress={handleSignOut}
              >
                <Text style={styles.signOutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.infoTitle}>About Voxe</Text>
              <Text style={styles.infoText}>
                • Voice-controlled productivity assistant{'\n'}
                • Connect Google Workspace and Notion{'\n'}
                • Execute commands with natural language{'\n'}
                • Secure OAuth authentication{'\n'}
                • Real-time action execution
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <Text style={styles.title}>
            {isSignUp ? 'Create Account' : 'Sign In'}
          </Text>
          <Text style={styles.subtitle}>
            {isSignUp 
              ? 'Create an account to connect your apps and use voice commands'
              : 'Sign in to access your connected apps and voice commands'
            }
          </Text>

          {/* Google Sign In Button */}
          <TouchableOpacity 
            style={[styles.googleButton, loading && styles.buttonDisabled]}
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            <Text style={styles.googleButtonText}>
              🔍 Continue with Google
            </Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>
                {isSignUp ? 'Create Account' : 'Sign In'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.switchButton}
            onPress={() => setIsSignUp(!isSignUp)}
          >
            <Text style={styles.switchText}>
              {isSignUp 
                ? 'Already have an account? Sign In'
                : "Don't have an account? Create one"
              }
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>What you can do with Voxe:</Text>
          <Text style={styles.infoText}>
            • Send emails with voice commands{'\n'}
            • Schedule meetings by speaking{'\n'}
            • Create documents and notes{'\n'}
            • Manage your Google Drive files{'\n'}
            • Update spreadsheets and Notion pages{'\n'}
            • All with natural language - no complex commands!
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  form: {
    marginBottom: 32,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#ffffff',
  },
  button: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  switchButton: {
    alignItems: 'center',
  },
  switchText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '500',
  },
  infoSection: {
    padding: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
  googleButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  googleButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#6b7280',
    fontSize: 14,
  },
  userSection: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  userTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#0E0E10',
  },
  userEmail: {
    fontSize: 16,
    color: '#6366f1',
    marginBottom: 8,
    fontWeight: '500',
  },
  userDate: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  signOutButton: {
    backgroundColor: '#ef4444',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  signOutText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
}); 