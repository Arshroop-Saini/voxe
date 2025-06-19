import React from 'react';
import { View, StyleSheet, Platform, Text, Pressable, Linking } from 'react-native';

interface ElevenLabsVoiceWidgetProps {
  agentId: string;
  userId: string;
}

// Web implementation using iframe
const WebVoiceWidget: React.FC<ElevenLabsVoiceWidgetProps> = ({ agentId, userId }) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Voice Assistant</title>
        <style>
            body {
                margin: 0;
                padding: 20px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            elevenlabs-convai {
                width: 100%;
                height: 400px;
                border-radius: 16px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            }
        </style>
    </head>
    <body>
        <elevenlabs-convai 
            agent-id="${agentId}"
            dynamic-variables='{"user_id": "${userId}"}'
        ></elevenlabs-convai>
        
        <script 
            src="https://unpkg.com/@elevenlabs/convai-widget-embed" 
            async 
            type="text/javascript"
        ></script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' ? (
        <iframe
          srcDoc={htmlContent}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: '16px',
          }}
          allow="microphone"
          title="ElevenLabs Voice Assistant"
        />
      ) : (
        <Text style={styles.fallbackText}>Web view not available</Text>
      )}
    </View>
  );
};

// Native implementation with WebView
const NativeVoiceWidget: React.FC<ElevenLabsVoiceWidgetProps> = ({ agentId, userId }) => {
  const { WebView } = require('react-native-webview');
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Voice Assistant</title>
        <style>
            body {
                margin: 0;
                padding: 20px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            elevenlabs-convai {
                width: 100%;
                height: 400px;
                border-radius: 16px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            }
            
            .debug {
                position: fixed;
                top: 10px;
                left: 10px;
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 10px;
                border-radius: 4px;
                font-size: 12px;
                max-width: 300px;
                z-index: 1000;
            }
        </style>
    </head>
    <body>
        <div class="debug" id="debug">
            Loading agent: ${agentId}<br>
            User: ${userId}<br>
            Status: Initializing...
        </div>
        
        <elevenlabs-convai 
            agent-id="${agentId}"
            dynamic-variables='{"user_id": "${userId}"}'
        ></elevenlabs-convai>
        
        <script 
            src="https://unpkg.com/@elevenlabs/convai-widget-embed" 
            async 
            type="text/javascript"
            onload="document.getElementById('debug').innerHTML += '<br>Script loaded'"
            onerror="document.getElementById('debug').innerHTML += '<br>Script failed to load'"
        ></script>
        
        <script>
          // Debug logging
          console.log('Agent ID:', '${agentId}');
          console.log('User ID:', '${userId}');
          
          // Listen for widget events
          window.addEventListener('message', function(event) {
            console.log('Widget message:', event.data);
            document.getElementById('debug').innerHTML += '<br>Event: ' + JSON.stringify(event.data);
          });
          
          // Check if widget loads
          setTimeout(() => {
            const widget = document.querySelector('elevenlabs-convai');
            if (widget) {
              document.getElementById('debug').innerHTML += '<br>Widget found in DOM';
            } else {
              document.getElementById('debug').innerHTML += '<br>Widget NOT found in DOM';
            }
          }, 3000);
        </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        source={{ html: htmlContent }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        mixedContentMode="compatibility"
        onPermissionRequest={(request: any) => {
          if (request.nativeEvent.permission === 'microphone') {
            request.nativeEvent.grant();
          }
        }}
        onMessage={(event: any) => {
          console.log('WebView message:', event.nativeEvent.data);
        }}
        onError={(syntheticEvent: any) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView error:', nativeEvent);
        }}
        onHttpError={(syntheticEvent: any) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView HTTP error:', nativeEvent);
        }}
      />
    </View>
  );
};

// Fallback implementation for unsupported platforms
const FallbackVoiceWidget: React.FC<ElevenLabsVoiceWidgetProps> = ({ agentId }) => {
  const handleOpenInBrowser = () => {
    const url = `https://elevenlabs.io/app/talk-to?agent_id=${agentId}`;
    Linking.openURL(url);
  };

  return (
    <View style={[styles.container, styles.fallbackContainer]}>
      <Text style={styles.fallbackTitle}>Voice Assistant</Text>
      <Text style={styles.fallbackText}>
        Voice conversations are not supported on this platform.
      </Text>
      <Pressable style={styles.openBrowserButton} onPress={handleOpenInBrowser}>
        <Text style={styles.buttonText}>Open in Browser</Text>
      </Pressable>
    </View>
  );
};

export default function ElevenLabsVoiceWidget({ agentId, userId }: ElevenLabsVoiceWidgetProps) {
  // Platform-specific rendering
  if (Platform.OS === 'web') {
    return <WebVoiceWidget agentId={agentId} userId={userId} />;
  } else if (Platform.OS === 'ios' || Platform.OS === 'android') {
    return <NativeVoiceWidget agentId={agentId} userId={userId} />;
  } else {
    return <FallbackVoiceWidget agentId={agentId} userId={userId} />;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  webview: {
    flex: 1,
  },
  fallbackContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  fallbackTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
    textAlign: 'center',
  },
  fallbackText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  openBrowserButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 