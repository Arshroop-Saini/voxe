import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';

interface VoiceInputProps {
  onAudioRecorded: (audioUri: string) => void;
  onTranscriptionReceived: (text: string) => void;
  isProcessing?: boolean;
}

export default function VoiceInput({ 
  onAudioRecorded, 
  onTranscriptionReceived, 
  isProcessing = false 
}: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = async () => {
    try {
      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant microphone permission to record audio.');
        return;
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create recording
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);

      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      await recording.startAsync();
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    try {
      if (!recordingRef.current) return;

      setIsRecording(false);
      
      // Clear duration timer
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      
      if (uri) {
        console.log('Audio recorded successfully:', uri);
        onAudioRecorded(uri);
        
        // Send to backend for transcription
        try {
          console.log('Sending audio to backend:', uri);
          const { apiService } = await import('../services/api');
          const response = await apiService.processAudio(uri);
          console.log('Transcription response:', response);
          onTranscriptionReceived(response.transcription);
        } catch (error) {
          console.error('Transcription error:', error);
          Alert.alert('Error', 'Failed to transcribe audio. Please try again.');
          onTranscriptionReceived(''); // Clear processing state
        }
      } else {
        console.error('No audio URI received from recording');
        Alert.alert('Error', 'Failed to save recording. Please try again.');
      }

      recordingRef.current = null;
      setRecordingDuration(0);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording. Please try again.');
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {/* Recording Status */}
      {isRecording && (
        <View style={styles.recordingStatus}>
          <View style={styles.recordingIndicator} />
          <Text style={styles.recordingText}>
            Recording... {formatDuration(recordingDuration)}
          </Text>
        </View>
      )}

      {/* Voice Waveform Placeholder */}
      {isRecording && (
        <View style={styles.waveformContainer}>
          <View style={styles.waveformBar} />
          <View style={[styles.waveformBar, { height: 20 }]} />
          <View style={[styles.waveformBar, { height: 30 }]} />
          <View style={[styles.waveformBar, { height: 15 }]} />
          <View style={[styles.waveformBar, { height: 25 }]} />
          <View style={[styles.waveformBar, { height: 10 }]} />
        </View>
      )}

      {/* Recording Button */}
      <TouchableOpacity
        style={[
          styles.recordButton,
          isRecording && styles.recordButtonActive,
          isProcessing && styles.recordButtonProcessing
        ]}
        onPress={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        activeOpacity={0.8}
      >
        {isProcessing ? (
          <Ionicons name="hourglass" size={32} color="white" />
        ) : (
          <Ionicons 
            name={isRecording ? "stop" : "mic"} 
            size={32} 
            color="white" 
          />
        )}
      </TouchableOpacity>

      {/* Instructions */}
      <Text style={styles.instructionText}>
        {isProcessing 
          ? "Processing..." 
          : isRecording 
            ? "Tap to stop recording" 
            : "Tap to start recording"
        }
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 24,
  },
  recordingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  recordingIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 8,
  },
  recordingText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  waveformBar: {
    width: 3,
    height: 12,
    backgroundColor: '#8B5CF6',
    marginHorizontal: 2,
    borderRadius: 2,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  recordButtonActive: {
    backgroundColor: '#EF4444',
  },
  recordButtonProcessing: {
    backgroundColor: '#6B7280',
  },
  instructionText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
}); 