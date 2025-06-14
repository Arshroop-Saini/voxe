import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function ComposioCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing app connection...');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      console.log('Composio OAuth callback received with params:', params);
      
      // Get the current URL - handle both web and mobile environments
      let currentUrl: string;
      let urlParams: URLSearchParams;
      
      if (typeof window !== 'undefined' && window.location) {
        // Web environment
        currentUrl = window.location.href;
        console.log('Web environment - Composio callback URL:', currentUrl);
        urlParams = new URLSearchParams(window.location.search);
      } else {
        // Mobile environment - construct URL from params and extract parameters
        const baseUrl = process.env.EXPO_PUBLIC_OAUTH_REDIRECT_URL || 'exp://localhost:8081';
        const queryString = Object.entries(params)
          .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
          .join('&');
        currentUrl = `${baseUrl}/composio/callback${queryString ? `?${queryString}` : ''}`;
        console.log('Mobile environment - Constructed URL:', currentUrl);
        
        // Create URLSearchParams from route params
        urlParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          urlParams.set(key, String(value));
        });
      }
      
      // Extract OAuth parameters
      const error = urlParams.get('error');
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      
      if (error) {
        console.error('Composio OAuth error:', error);
        setStatus('error');
        setMessage(`Connection failed: ${error}`);
        
        // Redirect back to connections tab after delay
        setTimeout(() => {
          router.replace('/(tabs)/connections');
        }, 3000);
        return;
      }
      
      if (code) {
        console.log('Composio OAuth code received, connection should be processing');
        setStatus('success');
        setMessage('Connection successful! The app is being activated...');
        
        // Redirect to connections tab after a short delay
        setTimeout(() => {
          router.replace('/(tabs)/connections');
        }, 2000);
        return;
      }
      
      // If no specific parameters, assume success and redirect
      console.log('Composio OAuth callback completed');
      setStatus('success');
      setMessage('Connection completed! Redirecting...');
      
      setTimeout(() => {
        router.replace('/(tabs)/connections');
      }, 2000);
      
    } catch (error) {
      console.error('Error in Composio OAuth callback handler:', error);
      setStatus('error');
      setMessage('An unexpected error occurred');
      
      // Redirect back to connections tab after delay
      setTimeout(() => {
        router.replace('/(tabs)/connections');
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
        {status === 'processing' && 'Connecting App...'}
        {status === 'success' && 'Success!'}
        {status === 'error' && 'Connection Error'}
      </Text>
      <Text style={styles.message}>{message}</Text>
      
      {status === 'success' && (
        <Text style={styles.redirect}>
          Redirecting to connections...
        </Text>
      )}
      
      {status === 'error' && (
        <Text style={styles.redirect}>
          Redirecting back to connections...
        </Text>
      )}
      
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>What's happening?</Text>
        <Text style={styles.infoText}>
          {status === 'processing' && 'We\'re securely connecting your app account. This may take a few moments.'}
          {status === 'success' && 'Your app has been connected successfully! You can now use voice commands with this app.'}
          {status === 'error' && 'The connection could not be completed. Please try again from the Connections tab.'}
        </Text>
      </View>
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
    marginBottom: 30,
  },
  infoBox: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    maxWidth: 400,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
}); 