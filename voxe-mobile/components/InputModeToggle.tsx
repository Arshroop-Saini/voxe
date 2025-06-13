import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';

export type InputMode = 'voice' | 'text';

interface InputModeToggleProps {
  currentMode: InputMode;
  onModeChange: (mode: InputMode) => void;
  disabled?: boolean;
}

export default function InputModeToggle({ 
  currentMode, 
  onModeChange, 
  disabled = false 
}: InputModeToggleProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.toggleButton,
          currentMode === 'voice' && styles.toggleButtonActive,
          disabled && styles.toggleButtonDisabled
        ]}
        onPress={() => onModeChange('voice')}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <Text style={[
          styles.toggleText,
          currentMode === 'voice' && styles.toggleTextActive
        ]}>
          Voice
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.toggleButton,
          currentMode === 'text' && styles.toggleButtonActive,
          disabled && styles.toggleButtonDisabled
        ]}
        onPress={() => onModeChange('text')}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <Text style={[
          styles.toggleText,
          currentMode === 'text' && styles.toggleTextActive
        ]}>
          Text
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#8B5CF6',
  },
  toggleButtonDisabled: {
    opacity: 0.5,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
}); 