import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { supabaseService } from '@/services/supabase';
import { useRouter } from 'expo-router';

interface Memory {
  id: string;
  heading: string;
  description: string;
  created_at: string;
  updated_at: string;
}

interface ApiResponse {
  success: boolean;
  data?: Memory[];
  count?: number;
  message?: string;
  error?: string;
}

export default function MemoriesScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // Form state
  const [heading, setHeading] = useState('');
  const [description, setDescription] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Colors
  const backgroundColor = Colors[colorScheme ?? 'light'].background;
  const textColor = Colors[colorScheme ?? 'light'].text;
  const borderColor = Colors[colorScheme ?? 'light'].text + '20';

  useEffect(() => {
    loadMemories();
  }, []);

  const loadMemories = async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true);
      else setLoading(true);

      // Get current user
      const user = await supabaseService.getCurrentUser();
      
      if (!user) {
        Alert.alert('Error', 'Please log in to view your memories');
        router.replace('/auth');
        return;
      }

      // Fetch memories from backend
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/memories`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
      });

      const result: ApiResponse = await response.json();

      if (result.success && result.data) {
        setMemories(result.data);
      } else {
        console.error('Failed to load memories:', result.error);
        Alert.alert('Error', result.error || 'Failed to load memories');
      }
    } catch (error) {
      console.error('Error loading memories:', error);
      Alert.alert('Error', 'Failed to load memories');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const createMemory = async () => {
    if (!heading.trim() || !description.trim()) {
      Alert.alert('Validation Error', 'Please fill in both heading and description');
      return;
    }

    try {
      setCreating(true);

      // Get current user
      const user = await supabaseService.getCurrentUser();
      
      if (!user) {
        Alert.alert('Error', 'Please log in to create memories');
        router.replace('/auth');
        return;
      }

      // Create memory via backend API
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/memories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({
          heading: heading.trim(),
          description: description.trim(),
        }),
      });

      const result: ApiResponse = await response.json();

      if (result.success) {
        Alert.alert('Success', 'Memory created successfully!');
        setHeading('');
        setDescription('');
        setShowForm(false);
        loadMemories(); // Reload memories
      } else {
        console.error('Failed to create memory:', result.error);
        Alert.alert('Error', result.error || 'Failed to create memory');
      }
    } catch (error) {
      console.error('Error creating memory:', error);
      Alert.alert('Error', 'Failed to create memory');
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const onRefresh = () => {
    loadMemories(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
          <Text style={[styles.loadingText, { color: textColor }]}>Loading memories...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: textColor }]}>My Memories</Text>
          <Text style={[styles.subtitle, { color: textColor + '80' }]}>
            Store personal notes and routines for AI to remember
          </Text>
        </View>

        {/* Add Memory Button */}
        <TouchableOpacity
          style={[styles.addButton, { borderColor }]}
          onPress={() => setShowForm(!showForm)}
        >
          <Text style={[styles.addButtonText, { color: Colors[colorScheme ?? 'light'].tint }]}>
            {showForm ? 'Cancel' : '+ Add Memory'}
          </Text>
        </TouchableOpacity>

        {/* Memory Form */}
        {showForm && (
          <View style={[styles.formContainer, { borderColor }]}>
            <Text style={[styles.formTitle, { color: textColor }]}>Create New Memory</Text>
            
            <TextInput
              style={[styles.input, { borderColor, color: textColor }]}
              placeholder="Memory heading (e.g., Morning Routine)"
              placeholderTextColor={textColor + '60'}
              value={heading}
              onChangeText={setHeading}
              editable={!creating}
            />

            <TextInput
              style={[styles.textArea, { borderColor, color: textColor }]}
              placeholder="Description and details (e.g., I check all emails from investors and then create and update my Jira todos after that)"
              placeholderTextColor={textColor + '60'}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!creating}
            />

            <TouchableOpacity
              style={[
                styles.createButton,
                { backgroundColor: Colors[colorScheme ?? 'light'].tint },
                creating && styles.disabledButton
              ]}
              onPress={createMemory}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.createButtonText}>Create Memory</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Memories List */}
        <View style={styles.memoriesContainer}>
          {memories.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: textColor + '60' }]}>
                No memories yet. Create your first memory to help AI understand your preferences and routines.
              </Text>
            </View>
          ) : (
            memories.map((memory) => (
              <View key={memory.id} style={[styles.memoryCard, { borderColor }]}>
                <Text style={[styles.memoryHeading, { color: textColor }]}>
                  {memory.heading}
                </Text>
                <Text style={[styles.memoryDescription, { color: textColor + '80' }]}>
                  {memory.description}
                </Text>
                <Text style={[styles.memoryDate, { color: textColor + '60' }]}>
                  Created: {formatDate(memory.created_at)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  scrollContainer: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  addButton: {
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  formContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
    minHeight: 100,
  },
  createButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  memoriesContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  emptyContainer: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  memoryCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  memoryHeading: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  memoryDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  memoryDate: {
    fontSize: 12,
  },
}); 