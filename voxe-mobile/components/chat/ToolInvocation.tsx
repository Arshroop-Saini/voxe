import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Tool Invocation Component
 * Displays tool calls and their results in the chat interface
 * Supports different states: partial-call, call, result
 */

interface ToolInvocationProps {
  toolInvocation: {
    toolCallId: string;
    toolName: string;
    args?: any;
    result?: any;
    state: 'partial-call' | 'call' | 'result';
  };
}

export default function ToolInvocation({ toolInvocation }: ToolInvocationProps) {
  const { toolName, args, result, state } = toolInvocation;

  // Get tool icon based on tool name
  const getToolIcon = (name: string) => {
    if (name.toLowerCase().includes('gmail')) return 'mail';
    if (name.toLowerCase().includes('calendar')) return 'calendar';
    if (name.toLowerCase().includes('docs')) return 'document-text';
    if (name.toLowerCase().includes('drive')) return 'folder';
    if (name.toLowerCase().includes('sheets')) return 'grid';
    if (name.toLowerCase().includes('notion')) return 'library';
    return 'construct';
  };

  // Get tool display name
  const getToolDisplayName = (name: string) => {
    return name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  };

  // Render based on state
  const renderContent = () => {
    switch (state) {
      case 'partial-call':
        return (
          <View style={styles.partialCall}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.partialText}>
              Preparing {getToolDisplayName(toolName)}...
            </Text>
          </View>
        );

      case 'call':
        return (
          <View style={styles.call}>
            <ActivityIndicator size="small" color="#007AFF" />
            <View style={styles.callContent}>
              <Text style={styles.callTitle}>
                Executing {getToolDisplayName(toolName)}
              </Text>
              {args && Object.keys(args).length > 0 && (
                <Text style={styles.callArgs}>
                  {Object.entries(args).map(([key, value]) => 
                    `${key}: ${String(value)}`
                  ).join(', ')}
                </Text>
              )}
            </View>
          </View>
        );

      case 'result':
        return (
          <View style={styles.result}>
            <Ionicons name="checkmark-circle" size={16} color="#28a745" />
            <View style={styles.resultContent}>
              <Text style={styles.resultTitle}>
                {getToolDisplayName(toolName)} completed
              </Text>
              {result && (
                <Text style={styles.resultText}>
                  {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
                </Text>
              )}
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name={getToolIcon(toolName)} size={16} color="#666" />
        <Text style={styles.toolName}>{getToolDisplayName(toolName)}</Text>
      </View>
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    marginHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  toolName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 6,
  },
  partialCall: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partialText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    fontStyle: 'italic',
  },
  call: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  callContent: {
    flex: 1,
    marginLeft: 8,
  },
  callTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  callArgs: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  result: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  resultContent: {
    flex: 1,
    marginLeft: 8,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#28a745',
    marginBottom: 4,
  },
  resultText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
  },
}); 