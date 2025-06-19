import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabaseService } from '../../services/supabase';

/**
 * Chat Thread List Component
 * Displays user's chat threads with management capabilities
 * Following Vercel AI SDK patterns for thread management
 */

export interface ChatThread {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

interface ThreadListProps {
  onThreadSelect?: (threadId: string) => void;
  showCreateButton?: boolean;
}

export default function ThreadList({ 
  onThreadSelect, 
  showCreateButton = true 
}: ThreadListProps) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);

  // Load threads from backend
  const loadThreads = useCallback(async () => {
    try {
      const user = await supabaseService.getCurrentUser();
      if (!user) {
        console.log('No user found, skipping thread load');
        return;
      }

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/chat/threads`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setThreads(data.data.threads);
        } else {
          console.error('Failed to load threads:', data.error);
        }
      } else {
        console.error('Failed to load threads:', response.status);
      }
    } catch (error) {
      console.error('Error loading threads:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Create new thread
  const createNewThread = async () => {
    try {
      setCreating(true);
      const user = await supabaseService.getCurrentUser();
      if (!user) {
        Alert.alert('Error', 'Please sign in to create a chat thread');
        return;
      }

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/chat/threads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({
          title: 'New Chat',
          initialMessage: 'Hello! How can I help you today?'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const newThread = data.data;
          setThreads(prev => [newThread, ...prev]);
          
          // Navigate to the new thread
          if (onThreadSelect) {
            onThreadSelect(newThread.id);
          } else {
            router.push({
              pathname: '/chat/[id]',
              params: { id: newThread.id }
            });
          }
        } else {
          Alert.alert('Error', data.error || 'Failed to create thread');
        }
      } else {
        Alert.alert('Error', 'Failed to create thread');
      }
    } catch (error) {
      console.error('Error creating thread:', error);
      Alert.alert('Error', 'Failed to create thread');
    } finally {
      setCreating(false);
    }
  };

  // Delete thread with confirmation
  const deleteThread = (thread: ChatThread) => {
    console.log('🚨 deleteThread function called for:', thread.id);
    Alert.alert(
      'Delete Chat',
      `Are you sure you want to delete "${thread.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            console.log('🚨 User confirmed deletion for:', thread.id);
            confirmDeleteThread(thread.id);
          }
        },
      ]
    );
  };

  const confirmDeleteThread = async (threadId: string) => {
    try {
      console.log('🚨 confirmDeleteThread called with threadId:', threadId);
      
      const user = await supabaseService.getCurrentUser();
      if (!user) {
        console.log('❌ No user found');
        Alert.alert('Error', 'Please sign in to delete threads');
        return;
      }
      
      console.log('✅ User found:', user.id);
      console.log(`🔍 API URL: ${process.env.EXPO_PUBLIC_API_URL}`);
      
      const deleteUrl = `${process.env.EXPO_PUBLIC_API_URL}/api/chat/threads/${threadId}`;
      console.log(`🌐 Full delete URL: ${deleteUrl}`);

      console.log(`🚀 Making DELETE request to: ${deleteUrl}`);

      const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
      });

      console.log(`📡 Delete response status: ${response.status}`);
      console.log(`📡 Delete response headers:`, response.headers);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Delete response data:', data);
        
        if (data.success) {
          // Remove thread from local state immediately
          setThreads(prev => prev.filter(t => t.id !== threadId));
          console.log(`🗑️ Successfully deleted thread: ${threadId}`);
          
          // Force refresh the thread list to ensure consistency
          await loadThreads();
        } else {
          console.error('❌ Delete failed:', data.error);
          Alert.alert('Error', data.error || 'Failed to delete thread');
        }
      } else {
        const errorText = await response.text();
        console.error(`❌ Delete request failed: ${response.status} - ${errorText}`);
        Alert.alert('Error', `Failed to delete thread (${response.status})`);
      }
    } catch (error) {
      console.error('💥 Error deleting thread:', error);
      Alert.alert('Error', 'Network error while deleting thread');
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  // Handle thread selection
  const handleThreadPress = (thread: ChatThread) => {
    if (onThreadSelect) {
      onThreadSelect(thread.id);
    } else {
      router.push({
        pathname: '/chat/[id]',
        params: { id: thread.id }
      });
    }
  };

  // Pull to refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadThreads();
  };

  // Load threads on mount
  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  // Render thread item
  const renderThread = ({ item }: { item: ChatThread }) => (
    <View style={styles.threadItem}>
    <TouchableOpacity
        style={styles.threadMainContent}
      onPress={() => handleThreadPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.threadContent}>
        <View style={styles.threadHeader}>
          <Text style={styles.threadTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.threadDate}>
            {formatDate(item.updated_at)}
          </Text>
        </View>
        
        <View style={styles.threadFooter}>
          <Text style={styles.messageCount}>
            {item.message_count} message{item.message_count !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>
      
      <Ionicons name="chevron-forward" size={20} color="#666" />
    </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.deleteButtonSeparate}
        onPress={() => {
          console.log('🗑️ IMMEDIATE: Delete button touched!');
          console.log('🗑️ IMMEDIATE: Thread ID:', item.id);
          console.log('🗑️ IMMEDIATE: Thread object:', item);
          
          // Test direct deletion without Alert for web compatibility
          if (typeof window !== 'undefined') {
            // Web environment - use confirm instead of Alert
            const confirmed = window.confirm(`Delete "${item.title}"? This cannot be undone.`);
            if (confirmed) {
              console.log('🚨 Web user confirmed deletion for:', item.id);
              confirmDeleteThread(item.id);
            }
          } else {
            // Native environment - use Alert
            Alert.alert('DEBUG', `Delete button pressed for: ${item.title}`);
            deleteThread(item);
          }
        }}
        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        activeOpacity={0.6}
      >
        <Ionicons name="trash-outline" size={18} color="#ff4444" />
      </TouchableOpacity>
    </View>
  );

  // Empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No Chat Threads</Text>
      <Text style={styles.emptySubtitle}>
        Create your first chat thread to start a conversation with Voxe
      </Text>
      {showCreateButton && (
        <TouchableOpacity
          style={styles.createButton}
          onPress={createNewThread}
          disabled={creating}
        >
          {creating ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.createButtonText}>Create Chat</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading chats...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showCreateButton && (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Chat Threads</Text>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={createNewThread}
            disabled={creating}
          >
            {creating ? (
              <ActivityIndicator color="#007AFF" size="small" />
            ) : (
              <Ionicons name="add" size={24} color="#007AFF" />
            )}
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={threads}
        renderItem={renderThread}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={threads.length === 0 ? styles.emptyContainer : undefined}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  threadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    justifyContent: 'space-between',
  },
  threadMainContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  threadContent: {
    flex: 1,
  },
  threadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  threadTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 12,
  },
  threadDate: {
    fontSize: 12,
    color: '#666',
  },
  threadFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messageCount: {
    fontSize: 12,
    color: '#999',
  },
  deleteButtonSeparate: {
    padding: 12,
    marginLeft: 8,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ff4444',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 40,
    minHeight: 40,
    // Web-specific styles for better interaction
    cursor: 'pointer',
    zIndex: 10,
    position: 'relative',
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
}); 