import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Message } from 'ai';
import ChatInterface from '../../components/chat/ChatInterface';
import { supabaseService } from '../../services/supabase';
import { memoryService } from '../../services/memoryService';

/**
 * Individual Chat Thread Page
 * Displays the chat interface for a specific thread
 * Dynamic route: /chat/[id]
 */
export default function ChatThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadMessages();
    }
  }, [id]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if user is authenticated
      const user = await supabaseService.getCurrentUser();
      if (!user) {
        Alert.alert('Authentication Required', 'Please sign in to access chat.');
        router.replace('/(tabs)/auth');
        return;
      }

      // Initialize memory context for chat mode
      memoryService.setContext({
        userId: user.id,
        mode: 'chat',
        threadId: id,
        sessionId: `chat-${id}-${Date.now()}`,
      });
      console.log('Memory context initialized for chat mode:', { userId: user.id, threadId: id });

      // Load messages from API
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/chat/messages/${id}`,
        {
          headers: {
            'x-user-id': user.id,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to load messages: ${response.status}`);
      }

      const data = await response.json();
      console.log('🔍 Raw API response:', JSON.stringify(data, null, 2));
      
      // 🔧 FIX: Proper data extraction from API response
      const messages = data.success && data.data ? data.data.messages : [];
      console.log(`📨 Loaded ${messages.length} messages for thread ${id}`);
      
      setInitialMessages(messages || []);
    } catch (err) {
      console.error('Error loading messages:', err);
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const handleMessagesChange = async (messages: Message[]) => {
    // 🔧 FIX: Remove automatic reload to prevent infinite loops
    // Messages are properly handled by useChat hook internally
    console.log(`Thread ${id} now has ${messages.length} messages`);
    
    // Only update message count or other UI elements if needed
    // No automatic backend reload required
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading chat...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Unable to Load Chat</Text>
        <Text style={styles.errorMessage}>{error}</Text>
      </View>
    );
  }

  if (!id) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Invalid Thread</Text>
        <Text style={styles.errorMessage}>Thread ID is missing</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ChatInterface
        threadId={id}
        initialMessages={initialMessages}
        onMessagesChange={handleMessagesChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
}); 