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
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/services/supabase';
import ErrorBoundary from '@/components/ErrorBoundary';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return; // Prevent multiple initializations
    
    setInitialized(true);
    loadUser();
    
    // Listen to auth state changes
    const { data: { subscription } } = supabaseService.onAuthStateChange((user) => {
      setUser(user);
      if (user && loading) {
        setLoading(false); // Clear loading when user is authenticated
      }
    });

    // Handle deep links when app is already open (for OAuth callbacks)
    const handleDeepLink = async (url: string) => {
      console.log('Handling deep link:', url);
      
      // Only handle auth-related URLs to avoid conflicts with Expo Router
      if (url.includes('voxemobile://auth') || 
          url.includes('#access_token=') || 
          url.includes('?access_token=') ||
          url.includes('&access_token=')) {
        console.log('Auth callback detected via deep link');
        
        try {
          const { success, error } = await supabaseService.handleOAuthCallback(url);
          
          if (success) {
            console.log('Session established from deep link');
            Alert.alert('Success', 'Signed in with Google successfully!');
          } else {
            console.error('Error processing auth callback:', error);
          }
        } catch (error) {
          console.error('Error in deep link handler:', error);
        }
      } else {
        console.log('Non-auth deep link ignored:', url);
      }
    };

    // Listen for deep links
    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    return () => {
      subscription.unsubscribe();
      linkingSubscription?.remove();
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
    try {
      setLoading(true);
      console.log('Starting Google OAuth flow...');
      
      // Get the OAuth URL from the service
      const { url, error } = await supabaseService.signInWithGoogle();
      
      if (error) {
        console.error('OAuth initiation error:', error);
        Alert.alert('Error', error);
        setLoading(false);
        return;
      }

      if (url) {
        console.log('Opening OAuth URL:', url);
        
        // Determine redirect URL based on environment
        const redirectUrl = process.env.EXPO_PUBLIC_OAUTH_REDIRECT_URL || 'http://localhost:8081';
        const callbackUrl = `${redirectUrl}/auth/callback`;
        
        // Open the OAuth URL in browser with correct callback URL
        const result = await WebBrowser.openAuthSessionAsync(
          url,
          callbackUrl,
          {
            showTitle: true,
            toolbarColor: '#6366f1',
            controlsColor: '#ffffff',
            // For web, we want to show in same window
            showInRecents: false,
          }
        );

        console.log('OAuth browser result:', result);

        if (result.type === 'success' && result.url) {
          console.log('OAuth success, processing callback URL:', result.url);
          
          // Handle the OAuth callback
          const { success, error: callbackError } = await supabaseService.handleOAuthCallback(result.url);
          
          if (success) {
            console.log('OAuth callback processed successfully');
            Alert.alert('Success', 'Signed in with Google successfully!');
            // Loading will be cleared by auth state change
          } else {
            console.error('OAuth callback processing failed:', callbackError);
            Alert.alert('Error', callbackError || 'Failed to complete sign in');
            setLoading(false);
          }
          
        } else if (result.type === 'cancel') {
          console.log('User cancelled OAuth flow');
          Alert.alert('Cancelled', 'Google sign in was cancelled');
          setLoading(false);
        } else if (result.type === 'dismiss') {
          console.log('OAuth browser was dismissed');
          // Don't show error immediately - check if auth completed
          setTimeout(async () => {
            const currentUser = await supabaseService.getCurrentUser();
            if (!currentUser) {
              Alert.alert('Info', 'Sign in was not completed');
              setLoading(false);
            }
          }, 1000);
        } else {
          console.error('OAuth flow failed with result:', result);
          Alert.alert('Error', 'OAuth flow failed');
          setLoading(false);
        }
      }
    } catch (error) {
      console.error('Google sign in error:', error);
      Alert.alert('Error', 'Failed to sign in with Google');
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