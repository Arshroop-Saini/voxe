# ElevenLabs Voice Integration for Voxe

> Complete voice conversation system using ElevenLabs for transcription and text-to-speech

## Overview

This document outlines the integration of ElevenLabs with Voxe to enable natural voice conversations. The implementation uses the Vercel AI SDK's ElevenLabs provider for both speech-to-text transcription and text-to-speech synthesis.

## Architecture

### Voice Conversation Flow
```
User Taps Record → Agent Greeting (TTS) → User Speaks → 
ElevenLabs Transcription → AI Processing → ElevenLabs TTS → 
Audio Playback → Continue Conversation Loop → Session End → 
Batch Memory Update
```

### Key Components

1. **ElevenLabsService**: Handles transcription and TTS operations
2. **VoiceConversationManager**: Manages conversation sessions and turn-taking
3. **AudioPlaybackService**: Handles audio output in React Native
4. **AsyncMemoryService**: Batched memory operations for performance
5. **ConversationalVoiceInterface**: Updated UI for voice interactions

## Setup and Installation

### 1. Install Dependencies

```bash
# Install ElevenLabs provider
npm install @ai-sdk/elevenlabs

# Additional audio dependencies for React Native
npm install react-native-sound
npm install @react-native-async-storage/async-storage
```

### 2. Environment Configuration

```bash
# Add to .env files
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```

### 3. Provider Setup

```typescript
import { createElevenLabs } from '@ai-sdk/elevenlabs';

const elevenlabs = createElevenLabs({
  apiKey: process.env.ELEVENLABS_API_KEY,
  // Optional custom settings
  headers: {
    'User-Agent': 'Voxe-App/1.0'
  }
});
```

## Implementation Guide

### 1. ElevenLabs Service

```typescript
// services/elevenLabsService.ts
import { elevenlabs } from '@ai-sdk/elevenlabs';
import { experimental_transcribe as transcribe } from 'ai';

export class ElevenLabsService {
  private provider = elevenlabs;

  async transcribeAudio(audioData: Uint8Array): Promise<string> {
    try {
      const result = await transcribe({
        model: this.provider.transcription('scribe_v1'),
        audio: audioData,
        providerOptions: { 
          elevenlabs: { 
            languageCode: 'en',
            diarize: false,
            timestampsGranularity: 'word'
          } 
        },
      });
      
      return result.text;
    } catch (error) {
      console.error('ElevenLabs transcription error:', error);
      throw new Error('Transcription failed');
    }
  }

  async synthesizeSpeech(text: string, voiceId?: string): Promise<ArrayBuffer> {
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + (voiceId || 'default'), {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY!
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5
          }
        })
      });

      if (!response.ok) {
        throw new Error(`TTS request failed: ${response.statusText}`);
      }

      return await response.arrayBuffer();
    } catch (error) {
      console.error('ElevenLabs TTS error:', error);
      throw new Error('Speech synthesis failed');
    }
  }
}
```

### 2. Voice Conversation Manager

```typescript
// services/voiceConversationManager.ts
export interface ConversationSession {
  id: string;
  userId: string;
  startTime: Date;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  isActive: boolean;
}

export class VoiceConversationManager {
  private sessions = new Map<string, ConversationSession>();
  private elevenLabsService = new ElevenLabsService();

  async startConversation(userId: string): Promise<string> {
    const sessionId = `voice_${Date.now()}_${userId}`;
    
    const session: ConversationSession = {
      id: sessionId,
      userId,
      startTime: new Date(),
      messages: [],
      isActive: true
    };

    this.sessions.set(sessionId, session);

    // Agent initiates conversation
    const greeting = "Hello! I'm your AI assistant. How can I help you today?";
    await this.addMessage(sessionId, 'assistant', greeting);
    
    // Convert to speech and return audio
    const audioBuffer = await this.elevenLabsService.synthesizeSpeech(greeting);
    
    return sessionId;
  }

  async processUserInput(sessionId: string, audioData: Uint8Array): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      throw new Error('Invalid or inactive session');
    }

    // Transcribe user input
    const userText = await this.elevenLabsService.transcribeAudio(audioData);
    await this.addMessage(sessionId, 'user', userText);

    // Generate AI response (integrate with existing AI service)
    const aiResponse = await this.generateAIResponse(session.messages);
    await this.addMessage(sessionId, 'assistant', aiResponse);

    // Convert to speech
    const audioBuffer = await this.elevenLabsService.synthesizeSpeech(aiResponse);
    
    return aiResponse;
  }

  async endConversation(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.isActive = false;
    
    // Trigger async memory update
    await this.batchUpdateMemory(session);
    
    this.sessions.delete(sessionId);
  }

  private async addMessage(sessionId: string, role: 'user' | 'assistant', content: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.messages.push({
      role,
      content,
      timestamp: new Date()
    });
  }

  private async generateAIResponse(messages: ConversationSession['messages']): Promise<string> {
    // Integrate with existing AI service
    // This should use the same AI pipeline but return text instead of streaming
    return "AI response based on conversation context";
  }

  private async batchUpdateMemory(session: ConversationSession): Promise<void> {
    // Batch update memory with all conversation messages
    // This happens asynchronously after conversation ends
    try {
      const memoryMessages = session.messages.map(msg => ({
        role: msg.role,
        content: [{ type: 'text', text: msg.content }]
      }));

      // Use existing memory service
      await addMemories(memoryMessages, { 
        user_id: session.userId,
        app_id: 'voxe-voice-conversation'
      });
    } catch (error) {
      console.error('Failed to update memory:', error);
    }
  }
}
```

### 3. Audio Playback Service

```typescript
// services/audioPlaybackService.ts
import Sound from 'react-native-sound';

export class AudioPlaybackService {
  private currentSound: Sound | null = null;
  private isPlaying = false;

  async playAudio(audioBuffer: ArrayBuffer): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Convert ArrayBuffer to base64 for React Native
        const base64Audio = this.arrayBufferToBase64(audioBuffer);
        
        // Create temporary file or use data URI
        const sound = new Sound(`data:audio/mpeg;base64,${base64Audio}`, '', (error) => {
          if (error) {
            reject(error);
            return;
          }

          this.currentSound = sound;
          this.isPlaying = true;

          sound.play((success) => {
            this.isPlaying = false;
            this.currentSound = null;
            
            if (success) {
              resolve();
            } else {
              reject(new Error('Audio playback failed'));
            }
          });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  stopAudio(): void {
    if (this.currentSound && this.isPlaying) {
      this.currentSound.stop();
      this.isPlaying = false;
      this.currentSound = null;
    }
  }

  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
```

### 4. Updated Voice Interface Component

```typescript
// components/ConversationalVoiceInterface.tsx
import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { VoiceConversationManager } from '../services/voiceConversationManager';
import { AudioPlaybackService } from '../services/audioPlaybackService';

export const ConversationalVoiceInterface: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [conversationManager] = useState(() => new VoiceConversationManager());
  const [audioService] = useState(() => new AudioPlaybackService());

  const startConversation = async () => {
    try {
      const newSessionId = await conversationManager.startConversation('user-id');
      setSessionId(newSessionId);
      setIsAISpeaking(true);
      
      // AI greeting will be played automatically
      // Audio playback handled in conversation manager
      
      setTimeout(() => setIsAISpeaking(false), 3000); // Adjust based on greeting length
    } catch (error) {
      console.error('Failed to start conversation:', error);
    }
  };

  const endConversation = async () => {
    if (sessionId) {
      await conversationManager.endConversation(sessionId);
      setSessionId(null);
      setIsRecording(false);
      setIsAISpeaking(false);
    }
  };

  const handleRecordingToggle = async () => {
    if (!sessionId) {
      await startConversation();
      return;
    }

    if (isRecording) {
      // Stop recording and process
      setIsRecording(false);
      setIsAISpeaking(true);
      
      // Process audio and get response
      // Implementation depends on your audio recording setup
      
    } else {
      // Start recording
      setIsRecording(true);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.recordButton,
          isRecording && styles.recordingButton,
          isAISpeaking && styles.aiSpeakingButton
        ]}
        onPress={handleRecordingToggle}
        disabled={isAISpeaking}
      >
        <Text style={styles.buttonText}>
          {isAISpeaking ? 'AI Speaking...' : 
           isRecording ? 'Stop Recording' : 
           sessionId ? 'Tap to Speak' : 'Start Conversation'}
        </Text>
      </TouchableOpacity>

      {sessionId && (
        <TouchableOpacity style={styles.endButton} onPress={endConversation}>
          <Text style={styles.endButtonText}>End Conversation</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  recordButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  recordingButton: {
    backgroundColor: '#FF3B30',
  },
  aiSpeakingButton: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  endButton: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  endButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
```

## Configuration Options

### ElevenLabs Transcription Options

```typescript
const transcriptionOptions = {
  languageCode: 'en', // ISO-639-1 language code
  tagAudioEvents: true, // Tag events like (laughter)
  numSpeakers: 1, // Maximum speakers (1-32)
  timestampsGranularity: 'word', // 'none', 'word', 'character'
  diarize: false, // Speaker identification
  fileFormat: 'other' // 'pcm_s16le_16' or 'other'
};
```

### Voice Settings for TTS

```typescript
const voiceSettings = {
  stability: 0.5, // 0-1, voice consistency
  similarity_boost: 0.5, // 0-1, voice similarity
  style: 0.0, // 0-1, style exaggeration
  use_speaker_boost: true // Enhance speaker clarity
};
```

## Performance Optimizations

### 1. Async Memory Updates
- Memory operations are batched and executed after conversation ends
- Prevents blocking voice responses during conversation
- Uses background processing for memory updates

### 2. Audio Streaming
- Stream audio playback as it's generated
- Implement audio queuing for continuous conversation
- Use efficient audio formats (MP3/AAC)

### 3. Caching
- Cache frequently used voice models
- Implement audio response caching for common phrases
- Use local storage for session data

## Error Handling

### 1. Network Failures
```typescript
const handleNetworkError = (error: Error) => {
  // Fallback to local TTS if available
  // Queue requests for retry
  // Inform user of connectivity issues
};
```

### 2. Audio Processing Errors
```typescript
const handleAudioError = (error: Error) => {
  // Fallback to text mode
  // Log error for debugging
  // Provide user feedback
};
```

### 3. API Rate Limits
```typescript
const handleRateLimit = () => {
  // Implement exponential backoff
  // Queue requests
  // Switch to alternative providers if needed
};
```

## Testing Strategy

### 1. Unit Tests
- Test individual service methods
- Mock ElevenLabs API responses
- Test error handling scenarios

### 2. Integration Tests
- Test complete voice conversation flow
- Test memory integration
- Test audio playback functionality

### 3. Performance Tests
- Measure response latency
- Test memory usage during long conversations
- Test audio quality and clarity

## Deployment Considerations

### 1. API Keys Management
- Secure storage of ElevenLabs API keys
- Environment-specific configurations
- Key rotation strategies

### 2. Audio Storage
- Temporary audio file management
- Cleanup strategies for audio data
- Privacy considerations for voice data

### 3. Monitoring
- Track API usage and costs
- Monitor conversation quality
- Log performance metrics

## Future Enhancements

1. **Multi-language Support**: Support for multiple languages in conversations
2. **Voice Cloning**: Custom voice models for personalized experiences
3. **Emotion Detection**: Analyze user emotion from voice input
4. **Real-time Translation**: Live translation during conversations
5. **Voice Commands**: Specific voice commands for app navigation

## Troubleshooting

### Common Issues

1. **Audio Not Playing**: Check React Native audio permissions and sound library setup
2. **Transcription Errors**: Verify audio format and quality
3. **High Latency**: Optimize memory operations and API calls
4. **API Errors**: Check API key validity and rate limits

### Debug Tools

```typescript
// Enable debug logging
const DEBUG_VOICE = true;

const debugLog = (message: string, data?: any) => {
  if (DEBUG_VOICE) {
    console.log(`[Voice Debug] ${message}`, data);
  }
};
```

## Resources

- [ElevenLabs API Documentation](https://docs.elevenlabs.io/)
- [Vercel AI SDK ElevenLabs Provider](https://ai-sdk.dev/providers/ai-sdk-providers/elevenlabs)
- [React Native Sound Documentation](https://github.com/zmxv/react-native-sound)
- [Audio Recording in React Native](https://github.com/goodatlas/react-native-audio-record) 