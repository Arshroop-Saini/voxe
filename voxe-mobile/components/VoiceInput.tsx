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
      console.log('\n🎤 === VOICE RECORDING STARTED ===');
      
      // Request permissions
      console.log('🔐 Requesting microphone permissions...');
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('❌ Microphone permission denied');
        Alert.alert('Permission Required', 'Please grant microphone permission to record audio.');
        return;
      }
      console.log('✅ Microphone permission granted');

      // Configure audio mode
      console.log('🔧 Configuring audio mode...');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      console.log('✅ Audio mode configured');

      // Create recording
      console.log('📱 Creating recording instance...');
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      console.log('✅ Recording prepared with HIGH_QUALITY preset');
      
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);

      // Start duration timer
      console.log('⏱️ Starting duration timer...');
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          const newDuration = prev + 1;
          if (newDuration % 5 === 0) { // Log every 5 seconds
            console.log(`🎤 Recording duration: ${newDuration}s`);
          }
          return newDuration;
        });
      }, 1000);

      console.log('🎙️ Starting audio recording...');
      await recording.startAsync();
      console.log('✅ Audio recording started successfully');
      
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    try {
      console.log('\n🛑 === STOPPING VOICE RECORDING ===');
      
      if (!recordingRef.current) {
        console.log('❌ No recording instance found');
        return;
      }

      setIsRecording(false);
      
      // Clear duration timer
      if (durationIntervalRef.current) {
        console.log('⏱️ Clearing duration timer...');
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      console.log('🛑 Stopping and unloading recording...');
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      
      if (uri) {
        console.log('✅ Audio recorded successfully:', {
          uri: uri,
          duration: `${recordingDuration}s`,
          timestamp: new Date().toISOString()
        });
        
        // Check file info if possible
        try {
          const fileInfo = await FileSystem.getInfoAsync(uri);
          console.log('📁 Audio file info:', {
            exists: fileInfo.exists,
            size: fileInfo.exists ? `${fileInfo.size} bytes (${(fileInfo.size / 1024).toFixed(2)} KB)` : 'unknown',
            uri: fileInfo.uri
          });
        } catch (fileInfoError) {
          console.log('⚠️ Could not get file info:', fileInfoError);
        }
        
        onAudioRecorded(uri);
        
        // Send to backend for transcription
        try {
          console.log('\n🌐 === SENDING TO BACKEND FOR TRANSCRIPTION ===');
          console.log('📤 Importing API service...');
          const { apiService } = await import('../services/api');
          
          console.log('📤 Calling apiService.processAudio()...');
          console.log('📤 Audio URI being sent:', uri);
          
          const response = await apiService.processAudio(uri);
          
          console.log('✅ Transcription response received:', {
            success: response.success,
            transcription: `"${response.transcription}"`,
            confidence: response.confidence,
            duration: response.duration,
            mock: response.mock || false,
            requestId: response.requestId || 'unknown'
          });
          
          console.log('🎯 Calling onTranscriptionReceived with:', response.transcription);
          onTranscriptionReceived(response.transcription);
          
        } catch (error) {
          console.error('❌ Transcription error:', {
            error: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : undefined
          });
          Alert.alert('Error', 'Failed to transcribe audio. Please try again.');
          console.log('🔄 Calling onTranscriptionReceived with empty string to clear processing state');
          onTranscriptionReceived(''); // Clear processing state
        }
      } else {
        console.error('❌ No audio URI received from recording');
        Alert.alert('Error', 'Failed to save recording. Please try again.');
      }

      recordingRef.current = null;
      setRecordingDuration(0);
      console.log('🧹 Recording cleanup completed');
      
    } catch (error) {
      console.error('❌ Failed to stop recording:', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
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