import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface TextInputProps {
  onTextSubmitted: (text: string) => void;
  onVoiceModeToggle: () => void;
  isProcessing?: boolean;
  placeholder?: string;
}

export default function TextInputComponent({ 
  onTextSubmitted, 
  onVoiceModeToggle,
  isProcessing = false,
  placeholder = "Type a command..."
}: TextInputProps) {
  const [inputText, setInputText] = useState('');

  const handleSubmit = () => {
    if (inputText.trim() && !isProcessing) {
      onTextSubmitted(inputText.trim());
      setInputText('');
    }
  };

  return (
    <View style={styles.container}>
      {/* Chat-like input */}
      <View style={styles.inputContainer}>
        {/* Voice mode toggle button */}
        <TouchableOpacity
          style={styles.voiceButton}
          onPress={onVoiceModeToggle}
          disabled={isProcessing}
          activeOpacity={0.7}
        >
          <Ionicons 
            name="mic" 
            size={20} 
            color={isProcessing ? "#9CA3AF" : "#8B5CF6"} 
          />
        </TouchableOpacity>

        {/* Text input */}
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={500}
          editable={!isProcessing}
          onSubmitEditing={handleSubmit}
          returnKeyType="send"
          blurOnSubmit={false}
        />

        {/* Send button */}
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!inputText.trim() || isProcessing) && styles.sendButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={!inputText.trim() || isProcessing}
          activeOpacity={0.7}
        >
          {isProcessing ? (
            <Ionicons name="hourglass" size={20} color="#9CA3AF" />
          ) : (
            <Ionicons 
              name="send" 
              size={20} 
              color={inputText.trim() ? "#8B5CF6" : "#9CA3AF"} 
            />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F3F4F6',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  },
  voiceButton: {
    padding: 8,
    borderRadius: 20,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#0E0E10',
    maxHeight: 120,
    lineHeight: 20,
  },
  sendButton: {
    padding: 8,
    borderRadius: 20,
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
}); 