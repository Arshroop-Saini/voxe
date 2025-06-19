import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import { supabaseService } from '@/services/supabase';
import { memoryService } from '@/services/memoryService';
import ElevenLabsVoiceWidget from '@/components/ElevenLabsVoiceWidget';

export default function VoiceScreen() {
  const [user, setUser] = useState<any>(null);
  const [userLoading, setUserLoading] = useState(true);

  useEffect(() => {
    loadUser();
    
    // Listen to auth state changes
    const { data: { subscription } } = supabaseService.onAuthStateChange((user) => {
      setUser(user);
      setUserLoading(false);
      
      // Update memory context when auth state changes
      if (user) {
        memoryService.setContext({
          userId: user.id,
          mode: 'voice',
          sessionId: `voice-${Date.now()}`,
        });
        console.log('Memory context updated for user:', user.id);
      } else {
        memoryService.reset();
        console.log('Memory context reset - user signed out');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await supabaseService.getCurrentUser();
      setUser(currentUser);
      
      // Initialize memory context for voice mode
      if (currentUser) {
        memoryService.setContext({
          userId: currentUser.id,
          mode: 'voice',
          sessionId: `voice-${Date.now()}`,
        });
        console.log('Memory context initialized for voice mode:', currentUser.id);
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setUserLoading(false);
    }
  };

  const handleVoiceError = (error: string) => {
    console.error('Voice conversation error:', error);
    Alert.alert('Voice Error', error);
  };

  if (userLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {user ? (
        <View style={styles.voiceContainer}>
          <Text style={styles.title}>Voice Assistant</Text>
          <Text style={styles.subtitle}>
            Natural voice conversations with your AI assistant
          </Text>
          
          <View style={styles.conversationContainer}>
            <ElevenLabsVoiceWidget
              agentId={process.env.EXPO_PUBLIC_ELEVENLABS_AGENT_ID || ''}
              userId={user.id}
            />
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>Voice Assistant</Text>
          <Text style={styles.subtitle}>
            Natural voice conversations with your AI assistant
          </Text>
          
          <View style={styles.signInPrompt}>
            <Text style={styles.signInTitle}>Get Started</Text>
            <Text style={styles.signInText}>
              Sign in to connect your apps and start having natural voice conversations with your AI assistant.
            </Text>
            <Text style={styles.signInInstructions}>
              1. Go to the Settings tab to sign in{'\n'}
              2. Visit the Connections tab to connect your apps{'\n'}
              3. Come back here to start voice conversations!
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  voiceContainer: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 60,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#0E0E10',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#6B7280',
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  conversationContainer: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  signInPrompt: {
    padding: 24,
    marginHorizontal: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  signInTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
    color: '#0E0E10',
  },
  signInText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 22,
  },
  signInInstructions: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
});
