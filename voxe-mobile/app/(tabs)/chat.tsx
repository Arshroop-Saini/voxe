import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import ThreadList from '../../components/chat/ThreadList';
import { supabaseService } from '../../services/supabase';

/**
 * Chat Tab Page
 * Main entry point for chat functionality
 * Displays thread list with authentication checks
 */
export default function ChatTab() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const currentUser = await supabaseService.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleThreadSelect = (threadId: string) => {
    router.push({
      pathname: '/chat/[id]',
      params: { id: threadId }
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.authContainer}>
        <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
        <Text style={styles.authTitle}>Sign In Required</Text>
        <Text style={styles.authSubtitle}>
          Please sign in to access your chat threads and start conversations with Voxe
        </Text>
        <TouchableOpacity
          style={styles.authButton}
          onPress={() => router.push('/(tabs)/auth')}
        >
          <Ionicons name="person" size={20} color="#fff" />
          <Text style={styles.authButtonText}>Go to Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ThreadList 
        onThreadSelect={handleThreadSelect}
        showCreateButton={true}
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
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#fff',
  },
  authTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  authButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
}); 