import React from 'react';
import { View, StyleSheet } from 'react-native';
import ThreadList from '../../components/chat/ThreadList';

/**
 * Chat Index Page
 * Displays the list of chat threads
 * Entry point for the chat functionality
 */
export default function ChatIndex() {
  return (
    <View style={styles.container}>
      <ThreadList showCreateButton={true} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
}); 