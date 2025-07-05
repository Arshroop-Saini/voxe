import * as React from 'react';
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { websocketService, GlassesConnectionStatus, StreamingSession } from '@/services/websocketService';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

interface ConnectionState {
  isConnected: boolean;
  connectedGlasses: GlassesConnectionStatus[];
  activeSession: StreamingSession | null;
}

interface LiveStreamingState {
  isTranscribing: boolean;
  currentTranscription: string;
  lastAiResponse: string;
  processingTime: number;
  toolsUsed: any[];
  buttonPressTime: number | null;
  audioChunkCount: number;
}

export default function GlassesScreen() {
  const colorScheme = useColorScheme();
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    connectedGlasses: [],
    activeSession: null
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastActivity, setLastActivity] = useState<string>('');
  const [liveStreamingState, setLiveStreamingState] = useState<LiveStreamingState>({
    isTranscribing: false,
    currentTranscription: '',
    lastAiResponse: '',
    processingTime: 0,
    toolsUsed: [],
    buttonPressTime: null,
    audioChunkCount: 0
  });

  // Update connection state
  const updateConnectionState = () => {
    const status = websocketService.getConnectionStatus();
    setConnectionState(status);
  };

  // Connect to WebSocket server
  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await websocketService.connect();
      setLastActivity('WebSocket connection initiated');
    } catch (error) {
      Alert.alert('Connection Error', 'Failed to connect to WebSocket server');
      console.error('Connection error:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect from WebSocket server
  const handleDisconnect = () => {
    websocketService.disconnect();
    setLastActivity('WebSocket disconnected');
  };

  // Set up event listeners
  useEffect(() => {
    // Connection events
    websocketService.on('connection:established', () => {
      setLastActivity('WebSocket connected successfully');
      updateConnectionState();
    });

    websocketService.on('connection:lost', (data) => {
      setLastActivity(`Connection lost: ${data.reason}`);
      updateConnectionState();
    });

    websocketService.on('connection:failed', () => {
      setLastActivity('Connection failed after maximum retry attempts');
      updateConnectionState();
    });

    // Glasses events
    websocketService.on('glasses:connected', (data) => {
      setLastActivity(`Glasses connected: ${data.deviceName}`);
      updateConnectionState();
    });

    websocketService.on('glasses:disconnected', (data) => {
      setLastActivity(`Glasses disconnected: ${data.deviceName}`);
      updateConnectionState();
    });

    websocketService.on('glasses:stream_started', (data) => {
      setLastActivity(`Streaming started: ${data.deviceName}`);
      setLiveStreamingState(prev => ({
        ...prev,
        buttonPressTime: Date.now(),
        audioChunkCount: 0,
        isTranscribing: false,
        currentTranscription: ''
      }));
      updateConnectionState();
    });

    websocketService.on('glasses:stream_stopped', (data) => {
      setLastActivity(`Streaming stopped: ${data.deviceName}`);
      setLiveStreamingState(prev => ({
        ...prev,
        buttonPressTime: null,
        isTranscribing: false
      }));
      updateConnectionState();
    });

    websocketService.on('glasses:audio_activity', (data) => {
      setLastActivity(`Audio chunk: ${data.chunkSize} bytes`);
      setLiveStreamingState(prev => ({
        ...prev,
        audioChunkCount: prev.audioChunkCount + 1
      }));
    });

    websocketService.on('glasses:transcription_started', (data) => {
      const deviceName = connectionState.connectedGlasses.find(g => g.deviceId === data.deviceId)?.deviceName || data.deviceId;
      setLastActivity(`Transcription started for ${deviceName}`);
      setLiveStreamingState(prev => ({
        ...prev,
        isTranscribing: true,
        currentTranscription: ''
      }));
    });

    websocketService.on('glasses:transcription', (data) => {
      setLastActivity(`Transcription: ${data.transcription}`);
      setLiveStreamingState(prev => ({
        ...prev,
        isTranscribing: false,
        currentTranscription: data.transcription
      }));
      updateConnectionState();
    });

    websocketService.on('glasses:ai_response', (data) => {
      setLastActivity(`AI Response: ${data.response}`);
      setLiveStreamingState(prev => ({
        ...prev,
        lastAiResponse: data.response,
        processingTime: data.processingTime || 0,
        toolsUsed: data.toolsUsed || []
      }));
      updateConnectionState();
    });

    websocketService.on('glasses:processing_error', (data) => {
      setLastActivity(`Processing error: ${data.error}`);
      const deviceName = connectionState.connectedGlasses.find(g => g.deviceId === data.deviceId)?.deviceName || data.deviceId;
      setLiveStreamingState(prev => ({
        ...prev,
        isTranscribing: false
      }));
      Alert.alert('Processing Error', `${deviceName}: ${data.error}`);
    });

    websocketService.on('glasses:error', (data) => {
      setLastActivity(`Error: ${data.error}`);
      Alert.alert('Glasses Error', `${data.deviceName}: ${data.error}`);
    });

    // Initial state update
    updateConnectionState();

    // Cleanup on unmount
    return () => {
      // Note: In a real app, you'd want to properly remove event listeners
      // For now, we'll keep them as the service is a singleton
    };
  }, []);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors[colorScheme ?? 'light'].background,
    },
    scrollView: {
      flex: 1,
      padding: 20,
    },
    header: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 20,
      color: Colors[colorScheme ?? 'light'].text,
    },
    section: {
      marginBottom: 30,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 10,
      color: Colors[colorScheme ?? 'light'].text,
    },
    statusCard: {
      backgroundColor: Colors[colorScheme ?? 'light'].background,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: Colors[colorScheme ?? 'light'].tabIconDefault,
    },
    statusRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    statusLabel: {
      fontSize: 14,
      color: Colors[colorScheme ?? 'light'].tabIconDefault,
    },
    statusValue: {
      fontSize: 14,
      fontWeight: '500',
      color: Colors[colorScheme ?? 'light'].text,
    },
    connectedIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#4ade80',
      marginRight: 8,
    },
    disconnectedIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#f87171',
      marginRight: 8,
    },
    streamingIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#fbbf24',
      marginRight: 8,
    },
    button: {
      backgroundColor: Colors[colorScheme ?? 'light'].tint,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      marginBottom: 10,
    },
    buttonDisabled: {
      backgroundColor: Colors[colorScheme ?? 'light'].tabIconDefault,
      opacity: 0.5,
    },
    buttonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
    activityText: {
      fontSize: 12,
      color: Colors[colorScheme ?? 'light'].tabIconDefault,
      fontStyle: 'italic',
      marginTop: 10,
    },
  });

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Text style={styles.header}>AI Glasses</Text>
        
        {/* Connection Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connection Status</Text>
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>WebSocket Server</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={connectionState.isConnected ? styles.connectedIndicator : styles.disconnectedIndicator} />
                <Text style={styles.statusValue}>
                  {connectionState.isConnected ? 'Connected' : 'Disconnected'}
                </Text>
              </View>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Connected Glasses</Text>
              <Text style={styles.statusValue}>
                {connectionState.connectedGlasses.length}
              </Text>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Active Session</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {connectionState.activeSession && (
                  <View style={styles.streamingIndicator} />
                )}
                <Text style={styles.statusValue}>
                  {connectionState.activeSession ? 'Streaming' : 'None'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Connected Glasses */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connected Glasses</Text>
          {connectionState.connectedGlasses.length === 0 ? (
            <View style={styles.statusCard}>
              <Text style={styles.statusLabel}>No glasses connected</Text>
            </View>
          ) : (
            connectionState.connectedGlasses.map((glasses) => (
              <View key={glasses.deviceId} style={styles.statusCard}>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Name</Text>
                  <Text style={styles.statusValue}>{glasses.deviceName}</Text>
                </View>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Device ID</Text>
                  <Text style={styles.statusValue}>{glasses.deviceId}</Text>
                </View>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Status</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={glasses.isStreaming ? styles.streamingIndicator : styles.connectedIndicator} />
                    <Text style={styles.statusValue}>
                      {glasses.isStreaming ? 'Streaming' : 'Connected'}
                    </Text>
                  </View>
                </View>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Last Seen</Text>
                  <Text style={styles.statusValue}>
                    {new Date(glasses.lastSeen).toLocaleTimeString()}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Live Streaming Status */}
        {connectionState.activeSession && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Live Streaming Status</Text>
            <View style={styles.statusCard}>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Button Status</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={liveStreamingState.buttonPressTime ? styles.streamingIndicator : styles.disconnectedIndicator} />
                  <Text style={styles.statusValue}>
                    {liveStreamingState.buttonPressTime ? 'Pressed' : 'Released'}
                  </Text>
                </View>
              </View>
              
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Audio Chunks</Text>
                <Text style={styles.statusValue}>{liveStreamingState.audioChunkCount}</Text>
              </View>
              
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Transcription</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {liveStreamingState.isTranscribing && (
                    <View style={styles.streamingIndicator} />
                  )}
                  <Text style={styles.statusValue}>
                    {liveStreamingState.isTranscribing ? 'Processing...' : 
                     liveStreamingState.currentTranscription || 'None'}
                  </Text>
                </View>
              </View>
              
              {liveStreamingState.lastAiResponse && (
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>AI Response</Text>
                  <Text style={styles.statusValue}>{liveStreamingState.lastAiResponse}</Text>
                </View>
              )}
              
              {liveStreamingState.processingTime > 0 && (
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Processing Time</Text>
                  <Text style={styles.statusValue}>{liveStreamingState.processingTime}ms</Text>
                </View>
              )}
              
              {liveStreamingState.toolsUsed.length > 0 && (
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Tools Used</Text>
                  <Text style={styles.statusValue}>{liveStreamingState.toolsUsed.length} tools</Text>
                </View>
              )}
              
              {liveStreamingState.buttonPressTime && (
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Session Duration</Text>
                  <Text style={styles.statusValue}>
                    {Math.floor((Date.now() - liveStreamingState.buttonPressTime) / 1000)}s
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Active Session Details */}
        {connectionState.activeSession && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Session Details</Text>
            <View style={styles.statusCard}>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Session ID</Text>
                <Text style={styles.statusValue}>{connectionState.activeSession.sessionId}</Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Device</Text>
                <Text style={styles.statusValue}>{connectionState.activeSession.deviceName}</Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Started</Text>
                <Text style={styles.statusValue}>
                  {new Date(connectionState.activeSession.startTime).toLocaleTimeString()}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Connection Controls */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connection Controls</Text>
          
          <Pressable
            style={[styles.button, (isConnecting || connectionState.isConnected) && styles.buttonDisabled]}
            onPress={handleConnect}
            disabled={isConnecting || connectionState.isConnected}
          >
            <Text style={styles.buttonText}>
              {isConnecting ? 'Connecting...' : 'Connect to Server'}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.button, !connectionState.isConnected && styles.buttonDisabled]}
            onPress={handleDisconnect}
            disabled={!connectionState.isConnected}
          >
            <Text style={styles.buttonText}>Disconnect</Text>
          </Pressable>
        </View>

        {/* Activity Log */}
        {lastActivity && (
          <Text style={styles.activityText}>
            Last Activity: {lastActivity}
          </Text>
        )}
      </ScrollView>
    </View>
  );
} 