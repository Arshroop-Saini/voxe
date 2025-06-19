import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useChat } from '@ai-sdk/react';
import { Message } from 'ai';
import MessageBubble from './MessageBubble';
import ToolInvocation from './ToolInvocation';
import StepBoundary from './StepBoundary';
import TypingIndicator from './TypingIndicator';
import { memoryService } from '../../services/memoryService';
import { supabaseService } from '../../services/supabase';

/**
 * Chat Interface Component
 * Implements useChat hook with streaming, tool calls, and multi-step workflows
 * Following Vercel AI SDK patterns for chat persistence
 */

interface ChatInterfaceProps {
  threadId: string;
  initialMessages?: Message[];
  onMessagesChange?: (messages: Message[]) => void;
}

export default function ChatInterface({ 
  threadId, 
  initialMessages = [],
  onMessagesChange 
}: ChatInterfaceProps) {
  const flatListRef = useRef<FlatList>(null);
  const [inputText, setInputText] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Get user ID for authentication
  useEffect(() => {
    const getUserId = async () => {
      const user = await supabaseService.getCurrentUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getUserId();
  }, []);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    reload,
    stop,
    setInput,
  } = useChat({
    api: `${process.env.EXPO_PUBLIC_API_URL}/api/chat/messages`,
    id: threadId,
    initialMessages,
    maxSteps: 1, // 🔧 FIX: Reduce to 1 to prevent multiple responses
    sendExtraMessageFields: true,
    headers: userId ? {
      'x-user-id': userId,
    } : {},
    // 🔧 FIX: Remove onFinish to prevent any duplicate processing
    onError: (error) => {
      console.error('Chat error:', error);
    },
  });

  // Sync input with local state
  useEffect(() => {
    setInputText(input);
  }, [input]);

  // Notify parent of message changes
  useEffect(() => {
    console.log('💬 Messages changed:', messages.length, 'messages');
    console.log('💬 Last 3 messages:', messages.slice(-3).map(m => ({
      id: m.id,
      role: m.role,
      content: typeof m.content === 'string' ? m.content.substring(0, 50) + '...' : 'non-string content'
    })));
    
    if (onMessagesChange) {
      onMessagesChange(messages);
    }
  }, [messages, onMessagesChange]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // Handle text input changes
  const handleTextChange = async (text: string) => {
    setInputText(text);
    setInput(text);
    
    // Get memory-enhanced suggestions when user types
    if (text.length > 2) {
      try {
        const memorySuggestions = await memoryService.getSuggestions(text);
        setSuggestions(memorySuggestions);
        setShowSuggestions(memorySuggestions.length > 0);
      } catch (error) {
        console.error('Error getting suggestions:', error);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: string) => {
    setInputText(suggestion);
    setInput(suggestion);
    setShowSuggestions(false);
  };

  // Handle form submission
  const onSubmit = () => {
    if (inputText.trim() && !isLoading) {
      handleSubmit();
      setInputText('');
      setShowSuggestions(false);
    }
  };

  // Handle reload button press
  const handleReload = () => {
    reload();
  };

  // Handle stop button press
  const handleStop = () => {
    stop();
  };

  // Render message parts (text, tool-invocation, step-start)
  const renderMessagePart = (part: any, partIndex: number, messageId: string) => {
    const key = `${messageId}-${partIndex}`;
    
    switch (part.type) {
      case 'text':
        return (
          <MessageBubble
            key={key}
            text={part.text}
            isUser={false}
          />
        );
      
      case 'tool-invocation':
        return (
          <ToolInvocation
            key={key}
            toolInvocation={part.toolInvocation}
          />
        );
      
      case 'step-start':
        // Show step boundaries as horizontal lines (skip first step)
        return partIndex > 0 ? (
          <StepBoundary key={key} stepNumber={partIndex} />
        ) : null;
      
      default:
        return null;
    }
  };

  // Render individual message
  const renderMessage = ({ item: message, index }: { item: Message; index: number }) => {
    if (message.role === 'user') {
      return (
        <MessageBubble
          key={message.id}
          text={message.content}
          isUser={true}
          timestamp={message.createdAt}
        />
      );
    }

    // Assistant message - 🔧 FIX: Prevent double display
    // Only render parts if they exist, otherwise render content
    const hasParts = (message as any).parts && (message as any).parts.length > 0;
    
    return (
      <View key={message.id} style={styles.assistantMessage}>
        {!hasParts && message.content && (
          <MessageBubble
            text={message.content}
            isUser={false}
            timestamp={message.createdAt}
          />
        )}
        
        {/* Render message parts (tool calls, steps, etc.) only if they exist */}
        {hasParts && (message as any).parts?.map((part: any, partIndex: number) => 
          renderMessagePart(part, partIndex, message.id)
        )}
      </View>
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubble-ellipses-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>Start a Conversation</Text>
      <Text style={styles.emptySubtitle}>
        Ask Voxe to help you with Gmail, Calendar, Docs, Drive, Sheets, or Notion
      </Text>
    </View>
  );

  // Render header with thread info
  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <Text style={styles.headerTitle}>Chat Thread</Text>
        <Text style={styles.headerSubtitle}>
          {messages.length} message{messages.length !== 1 ? 's' : ''}
        </Text>
      </View>
      
      {isLoading && (
        <TouchableOpacity onPress={handleStop} style={styles.stopButton}>
          <Ionicons name="stop" size={20} color="#ff4444" />
        </TouchableOpacity>
      )}
      
      {error && (
        <TouchableOpacity onPress={handleReload} style={styles.retryButton}>
          <Ionicons name="refresh" size={20} color="#007AFF" />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {renderHeader()}
      
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={messages.length === 0 ? styles.emptyContainer : styles.messagesList}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={isLoading ? <TypingIndicator /> : null}
      />

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {error.message || 'Something went wrong'}
          </Text>
          <TouchableOpacity onPress={handleReload} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Memory-enhanced suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>Suggestions</Text>
          {suggestions.map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestionItem}
              onPress={() => handleSuggestionSelect(suggestion)}
            >
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={handleTextChange}
            placeholder="Type a message..."
            placeholderTextColor="#999"
            multiline
            maxLength={1000}
            editable={!isLoading}
          />
          
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || isLoading) && styles.sendButtonDisabled
            ]}
            onPress={onSubmit}
            disabled={!inputText.trim() || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
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
    backgroundColor: '#fff',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  stopButton: {
    padding: 8,
    backgroundColor: '#ffe6e6',
    borderRadius: 20,
  },
  retryButton: {
    padding: 8,
    backgroundColor: '#e6f3ff',
    borderRadius: 20,
  },
  messagesList: {
    paddingVertical: 16,
  },
  assistantMessage: {
    marginBottom: 8,
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
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#ffe6e6',
    borderTopWidth: 1,
    borderTopColor: '#ffcccc',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#cc0000',
    marginRight: 12,
  },
  retryText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  inputContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#f8f8f8',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 48,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    maxHeight: 120,
    paddingVertical: 8,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  suggestionsContainer: {
    backgroundColor: '#f8f8f8',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingHorizontal: 20,
    paddingVertical: 12,
    maxHeight: 150,
  },
  suggestionsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  suggestionItem: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  suggestionText: {
    fontSize: 14,
    color: '#333',
  },
}); 