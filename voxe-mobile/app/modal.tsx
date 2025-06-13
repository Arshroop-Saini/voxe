import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet } from 'react-native';
import { Text, View } from '@/components/Themed';

export default function ModalScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>About Voxe</Text>
      <View style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />
      
      <View style={styles.content}>
        <Text style={styles.description}>
          Voxe is your voice-controlled productivity assistant.
        </Text>
        <Text style={styles.description}>
          Connect your Google Workspace and Notion accounts to get started with voice commands.
        </Text>
        
        <View style={styles.versionInfo}>
          <Text style={styles.versionText}>Version 1.0.0 (MVP)</Text>
          <Text style={styles.versionText}>Phase 2A Complete ✅</Text>
        </View>
      </View>

      {/* Use a light status bar on iOS to account for the black space above the modal */}
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: '80%',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 20,
    maxWidth: 300,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    opacity: 0.7,
    lineHeight: 20,
  },
  versionInfo: {
    marginTop: 20,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 12,
    opacity: 0.5,
    marginBottom: 4,
  },
});
