import React, { useState } from 'react';
import { StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, View } from '@/components/Themed';
import VoiceInput from '@/components/VoiceInput';
import TextInputComponent from '@/components/TextInput';
import InputModeToggle, { InputMode } from '@/components/InputModeToggle';

export default function TabOneScreen() {
  const [inputMode, setInputMode] = useState<InputMode>('voice');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAudioRecorded = (audioUri: string) => {
    console.log('Audio recorded:', audioUri);
    setIsProcessing(true);
    // TODO: Send to backend for transcription
  };

  const handleTranscriptionReceived = (text: string) => {
    console.log('Transcription received:', text);
    setIsProcessing(false);
    Alert.alert('Transcription', text);
  };

  const handleTextSubmitted = async (text: string) => {
    console.log('Text submitted:', text);
    setIsProcessing(true);
    
    try {
      const { apiService } = await import('../../services/api');
      const response = await apiService.processText(text);
      
      Alert.alert(
        'Command Processed', 
        `Intent: ${response.intent}\nConfidence: ${(response.confidence * 100).toFixed(1)}%\nParameters: ${JSON.stringify(response.parameters, null, 2)}`
      );
    } catch (error) {
      console.error('Text processing error:', error);
      Alert.alert('Error', 'Failed to process command. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoiceModeToggle = () => {
    setInputMode('voice');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Voxe</Text>
        <Text style={styles.subtitle}>Voice-controlled productivity assistant</Text>
        
        <InputModeToggle
          currentMode={inputMode}
          onModeChange={setInputMode}
          disabled={isProcessing}
        />

        {inputMode === 'voice' ? (
          <VoiceInput
            onAudioRecorded={handleAudioRecorded}
            onTranscriptionReceived={handleTranscriptionReceived}
            isProcessing={isProcessing}
          />
        ) : (
          <TextInputComponent
            onTextSubmitted={handleTextSubmitted}
            onVoiceModeToggle={handleVoiceModeToggle}
            isProcessing={isProcessing}
            placeholder="Type a command like 'Send an email to John about the meeting'"
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 60,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#0E0E10',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#6B7280',
    marginBottom: 32,
    paddingHorizontal: 16,
  },
});
