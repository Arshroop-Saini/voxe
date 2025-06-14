import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import VoiceInput from '@/components/VoiceInput';
import TextInputComponent from '@/components/TextInput';
import InputModeToggle, { InputMode } from '@/components/InputModeToggle';
import { supabaseService } from '@/services/supabase';
import { composioService } from '@/services/composio';

export default function TabOneScreen() {
  const [inputMode, setInputMode] = useState<InputMode>('voice');
  const [isProcessing, setIsProcessing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [lastResponse, setLastResponse] = useState<string>('');

  useEffect(() => {
    loadUser();
    
    // Listen to auth state changes
    const { data: { subscription } } = supabaseService.onAuthStateChange((user) => {
      setUser(user);
      setUserLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await supabaseService.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setUserLoading(false);
    }
  };

  const handleAudioRecorded = (audioUri: string) => {
    console.log('\n📱 === AUDIO RECORDED CALLBACK ===');
    console.log('📁 Audio URI received:', audioUri);
    console.log('⏳ Processing state managed by VoiceInput component');
    console.log('🔄 Waiting for transcription to complete...');
    // Processing state is managed by VoiceInput component
    // Transcription will be handled automatically and call handleTranscriptionReceived
  };

  const handleTranscriptionReceived = async (text: string) => {
    console.log('\n🎯 === TRANSCRIPTION RECEIVED ===');
    console.log('📝 Transcribed text:', `"${text}"`);
    console.log('📏 Text length:', text.length);
    
    if (!text.trim()) {
      console.log('❌ Empty transcription detected');
      setIsProcessing(false);
      Alert.alert('No Speech Detected', 'Please try speaking again.');
      return;
    }
    
    if (!user) {
      console.log('❌ No user found, authentication required');
      setIsProcessing(false);
      Alert.alert('Sign In Required', 'Please sign in to use voice commands');
      return;
    }
    
    // Keep processing state true while we execute the AI command
    console.log('\n🤖 === EXECUTING AI COMMAND ===');
    console.log('👤 User ID:', user.id);
    console.log('📧 User email:', user.email);
    console.log('🎯 Command to execute:', `"${text}"`);
    console.log('⏳ Calling composioService.executeCommand()...');
    
    try {
      const startTime = Date.now();
      const response = await composioService.executeCommand(text, user.id);
      const executionTime = Date.now() - startTime;
      
      console.log('✅ AI command execution completed:', {
        success: response.success,
        executionTime: `${executionTime}ms`,
        hasData: !!response.data,
        hasError: !!response.error
      });
      
      if (response.success && response.data) {
        const { response: aiResponse, toolsUsed, steps } = response.data;
        
        console.log('🎉 AI Response Details:', {
          responseLength: aiResponse.length,
          toolsUsed: toolsUsed,
          toolCount: toolsUsed.length,
          steps: steps,
          executionTime: `${executionTime}ms`
        });
        
        setLastResponse(aiResponse);
        
        console.log('💾 Response stored in lastResponse state');
        console.log('🔔 Showing success alert to user...');
        
        Alert.alert(
          'Voice Command Executed', 
          `Command: "${text}"\n\nResponse: ${aiResponse}\n\n${toolsUsed.length > 0 ? `Tools used: ${toolsUsed.join(', ')}\nSteps: ${steps}` : 'No tools were needed for this response.'}`
        );
      } else {
        console.log('❌ AI command execution failed:', {
          success: response.success,
          error: response.error,
          executionTime: `${executionTime}ms`
        });
        
        console.log('🔔 Showing error alert to user...');
        Alert.alert('Error', response.error || 'Failed to execute voice command');
      }
    } catch (error) {
      console.error('💥 Voice command execution error:', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        command: text,
        userId: user.id
      });
      
      console.log('🔔 Showing error alert to user...');
      Alert.alert('Error', 'Failed to execute voice command. Please check your app connections and try again.');
    } finally {
      console.log('🏁 Setting processing state to false');
      setIsProcessing(false);
      console.log('✅ === VOICE COMMAND WORKFLOW COMPLETED ===\n');
    }
  };

  const handleTextSubmitted = async (text: string) => {
    console.log('Text submitted:', text);
    
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to use voice and text commands');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      console.log('Executing command with Composio AI agent...');
      const response = await composioService.executeCommand(text, user.id);
      
      if (response.success && response.data) {
        const { response: aiResponse, toolsUsed, steps } = response.data;
        setLastResponse(aiResponse);
        
        Alert.alert(
          'Command Executed', 
          `${aiResponse}\n\n${toolsUsed.length > 0 ? `Tools used: ${toolsUsed.join(', ')}\nSteps: ${steps}` : 'No tools were needed for this response.'}`
        );
      } else {
        Alert.alert('Error', response.error || 'Failed to execute command');
      }
    } catch (error) {
      console.error('Command execution error:', error);
      Alert.alert('Error', 'Failed to execute command. Please check your app connections and try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoiceModeToggle = () => {
    setInputMode('voice');
  };

  if (userLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Voxe</Text>
        <Text style={styles.subtitle}>
          {user 
            ? 'Voice-controlled productivity assistant' 
            : 'Sign in to start using voice commands'
          }
        </Text>
        
        {user && (
          <Text style={styles.userInfo}>
            Signed in as: {user.email}
          </Text>
        )}
        
        {user ? (
          <>
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
                placeholder="Type a command like 'Check my Gmail inbox' or 'Schedule a meeting for tomorrow'"
              />
            )}
            
            {lastResponse && (
              <View style={styles.responseContainer}>
                <Text style={styles.responseTitle}>Last Response:</Text>
                <Text style={styles.responseText}>{lastResponse}</Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.signInPrompt}>
            <Text style={styles.signInTitle}>Get Started</Text>
            <Text style={styles.signInText}>
              Sign in to connect your apps and start using voice commands to manage your productivity.
            </Text>
            <Text style={styles.signInInstructions}>
              1. Go to the Account tab to sign in{'\n'}
              2. Visit the Connections tab to connect your apps{'\n'}
              3. Come back here to start using voice commands!
            </Text>
          </View>
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
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
  userInfo: {
    fontSize: 14,
    textAlign: 'center',
    color: '#6366f1',
    marginBottom: 24,
    fontWeight: '500',
  },
  responseContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    marginHorizontal: 16,
  },
  responseTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#0E0E10',
  },
  responseText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
  },
  signInPrompt: {
    padding: 24,
    marginHorizontal: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  signInTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
    color: '#0E0E10',
  },
  signInText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 22,
  },
  signInInstructions: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
});
