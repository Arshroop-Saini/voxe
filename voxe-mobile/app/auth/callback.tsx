import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabaseService } from '@/services/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      console.log('OAuth callback received with params:', params);
      
      // Get the current URL - handle both web and mobile environments
      let currentUrl: string;
      
      if (typeof window !== 'undefined' && window.location) {
        // Web environment
        currentUrl = window.location.href;
        console.log('Web environment - Current URL:', currentUrl);
      } else {
        // Mobile environment - construct URL from params
        const baseUrl = process.env.EXPO_PUBLIC_OAUTH_REDIRECT_URL || 'exp://localhost:8081';
        const queryString = Object.entries(params)
          .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
          .join('&');
        currentUrl = `${baseUrl}/auth/callback${queryString ? `?${queryString}` : ''}`;
        console.log('Mobile environment - Constructed URL:', currentUrl);
      }
      
      // Process the OAuth callback
      const { success, error } = await supabaseService.handleOAuthCallback(currentUrl);
      
      if (success) {
        console.log('OAuth callback processed successfully');
        setStatus('success');
        setMessage('Authentication successful! Redirecting...');
        
        // Redirect to auth tab after a short delay
        setTimeout(() => {
          router.replace('/(tabs)/auth');
        }, 2000);
      } else {
        console.error('OAuth callback failed:', error);
        setStatus('error');
        setMessage(error || 'Authentication failed');
        
        // Redirect back to auth tab after delay
        setTimeout(() => {
          router.replace('/(tabs)/auth');
        }, 3000);
      }
    } catch (error) {
      console.error('Error in OAuth callback handler:', error);
      setStatus('error');
      setMessage('An unexpected error occurred');
      
      // Redirect back to auth tab after delay
      setTimeout(() => {
        router.replace('/(tabs)/auth');
      }, 3000);
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator 
        size="large" 
        color="#6366f1" 
        style={styles.spinner}
      />
      <Text style={styles.title}>
        {status === 'processing' && 'Completing Sign In...'}
        {status === 'success' && 'Success!'}
        {status === 'error' && 'Error'}
      </Text>
      <Text style={styles.message}>{message}</Text>
      
      {status === 'success' && (
        <Text style={styles.redirect}>
          Redirecting to your account...
        </Text>
      )}
      
      {status === 'error' && (
        <Text style={styles.redirect}>
          Redirecting back to sign in...
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 20,
  },
  spinner: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  redirect: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    fontStyle: 'italic',
  },
}); 