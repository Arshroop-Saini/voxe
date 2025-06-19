import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Message Bubble Component
 * Displays individual chat messages with different styling for user and assistant
 */

interface MessageBubbleProps {
  text: string;
  isUser: boolean;
  timestamp?: Date | string;
}

export default function MessageBubble({ text, isUser, timestamp }: MessageBubbleProps) {
  const formatTime = (time?: Date | string) => {
    if (!time) return '';
    const date = typeof time === 'string' ? new Date(time) : time;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={[styles.text, isUser ? styles.userText : styles.assistantText]}>
          {text}
        </Text>
        {timestamp && (
          <Text style={[styles.timestamp, isUser ? styles.userTimestamp : styles.assistantTimestamp]}>
            {formatTime(timestamp)}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    marginHorizontal: 16,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  assistantContainer: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  userBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 4,
  },
  text: {
    fontSize: 16,
    lineHeight: 20,
  },
  userText: {
    color: '#fff',
  },
  assistantText: {
    color: '#333',
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
    opacity: 0.7,
  },
  userTimestamp: {
    color: '#fff',
    textAlign: 'right',
  },
  assistantTimestamp: {
    color: '#666',
    textAlign: 'left',
  },
}); 