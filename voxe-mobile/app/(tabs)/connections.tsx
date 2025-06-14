import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Text, View } from '@/components/Themed';
import { supabaseService } from '@/services/supabase';
import { composioService, ConnectionStatus, AppConnection } from '@/services/composio';

interface AppConnectionCardProps {
  appName: string;
  connection: AppConnection;
  onConnect: (appName: string) => void;
  onDisconnect: (appName: string) => void;
  isConnecting: boolean;
}

function AppConnectionCard({ 
  appName, 
  connection, 
  onConnect, 
  onDisconnect, 
  isConnecting 
}: AppConnectionCardProps) {
  const displayName = composioService.getAppDisplayName(appName);
  const description = composioService.getAppDescription(appName);
  const icon = composioService.getAppIcon(appName);
  
  const getStatusColor = () => {
    switch (connection.status) {
      case 'CONNECTED': return '#10b981'; // green
      case 'CONNECTING': return '#f59e0b'; // yellow
      case 'ERROR': return '#ef4444'; // red
      default: return '#6b7280'; // gray
    }
  };

  const getStatusText = () => {
    switch (connection.status) {
      case 'CONNECTED': return 'Connected';
      case 'CONNECTING': return 'Connecting...';
      case 'ERROR': return 'Error';
      default: return 'Not Connected';
    }
  };

  return (
    <View style={styles.appCard}>
      <View style={styles.appHeader}>
        <Text style={styles.appIcon}>{icon}</Text>
        <View style={styles.appInfo}>
          <Text style={styles.appName}>{displayName}</Text>
          <Text style={styles.appDescription}>{description}</Text>
          <Text style={[styles.appStatus, { color: getStatusColor() }]}>
            {getStatusText()}
          </Text>
        </View>
        <View style={styles.appActions}>
          {connection.connected ? (
            <Text
              style={[styles.actionButton, styles.disconnectButton]}
              onPress={() => onDisconnect(appName)}
            >
              Disconnect
            </Text>
          ) : (
            <Text
              style={[
                styles.actionButton, 
                styles.connectButton,
                isConnecting && styles.disabledButton
              ]}
              onPress={() => !isConnecting && onConnect(appName)}
            >
              {isConnecting ? 'Connecting...' : 'Connect'}
            </Text>
          )}
        </View>
      </View>
      {connection.connectedAt && (
        <Text style={styles.connectedAt}>
          Connected: {new Date(connection.connectedAt).toLocaleDateString()}
        </Text>
      )}
      {connection.error && (
        <Text style={styles.errorText}>
          Error: {connection.error}
        </Text>
      )}
    </View>
  );
}

export default function ConnectionsScreen() {
  const [user, setUser] = useState<any>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connectingApps, setConnectingApps] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadUser();
    
    // Listen to auth state changes
    const { data: { subscription } } = supabaseService.onAuthStateChange((user) => {
      setUser(user);
      if (user) {
        loadConnectionStatus(user.id);
      } else {
        setConnectionStatus(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await supabaseService.getCurrentUser();
      setUser(currentUser);
      
      if (currentUser) {
        await loadConnectionStatus(currentUser.id);
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadConnectionStatus = async (userId: string) => {
    try {
      const status = await composioService.getConnectionStatus(userId);
      console.log('Connection status loaded:', status);
      
      // Validate the response structure
      if (!status || typeof status !== 'object') {
        throw new Error('Invalid connection status response');
      }
      
      // Ensure supportedApps is an array
      if (!Array.isArray(status.supportedApps)) {
        console.warn('supportedApps is not an array, using default apps');
        status.supportedApps = ['gmail', 'googlecalendar', 'googledocs', 'googledrive', 'googlesheets', 'notion'];
      }
      
      // Ensure connections object exists
      if (!status.connections || typeof status.connections !== 'object') {
        console.warn('connections object is missing, creating default structure');
        status.connections = {
          gmail: { connected: false, status: 'NOT_CONNECTED' },
          googlecalendar: { connected: false, status: 'NOT_CONNECTED' },
          googledocs: { connected: false, status: 'NOT_CONNECTED' },
          googledrive: { connected: false, status: 'NOT_CONNECTED' },
          googlesheets: { connected: false, status: 'NOT_CONNECTED' },
          notion: { connected: false, status: 'NOT_CONNECTED' },
        };
      }
      
      setConnectionStatus(status);
    } catch (error) {
      console.error('Error loading connection status:', error);
      Alert.alert('Error', 'Failed to load connection status');
      
      // Set a default connection status to prevent crashes
      setConnectionStatus({
        userId,
        supportedApps: ['gmail', 'googlecalendar', 'googledocs', 'googledrive', 'googlesheets', 'notion'],
        connections: {
          gmail: { connected: false, status: 'NOT_CONNECTED' },
          googlecalendar: { connected: false, status: 'NOT_CONNECTED' },
          googledocs: { connected: false, status: 'NOT_CONNECTED' },
          googledrive: { connected: false, status: 'NOT_CONNECTED' },
          googlesheets: { connected: false, status: 'NOT_CONNECTED' },
          notion: { connected: false, status: 'NOT_CONNECTED' },
        },
      });
    }
  };

  const handleConnect = async (appName: string) => {
    if (!user) {
      Alert.alert('Error', 'Please sign in first');
      return;
    }

    setConnectingApps(prev => new Set(prev).add(appName));

    try {
      const success = await composioService.connectApp(user.id, appName);
      
      if (success) {
        Alert.alert(
          'Success', 
          `${composioService.getAppDisplayName(appName)} connected successfully!`
        );
        await loadConnectionStatus(user.id);
      } else {
        Alert.alert('Cancelled', 'OAuth connection was cancelled');
      }
    } catch (error) {
      console.error(`Error connecting ${appName}:`, error);
      Alert.alert(
        'Connection Failed', 
        `Failed to connect ${composioService.getAppDisplayName(appName)}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setConnectingApps(prev => {
        const newSet = new Set(prev);
        newSet.delete(appName);
        return newSet;
      });
    }
  };

  const handleDisconnect = async (appName: string) => {
    if (!user) return;

    Alert.alert(
      'Disconnect App',
      `Are you sure you want to disconnect ${composioService.getAppDisplayName(appName)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log(`Disconnecting ${appName} for user ${user.id}`);
              
              const result = await composioService.disconnectApp(user.id, appName);
              
              if (result.success) {
                Alert.alert('Success', `${composioService.getAppDisplayName(appName)} disconnected successfully`);
                await loadConnectionStatus(user.id);
              } else {
                Alert.alert('Error', `Failed to disconnect ${composioService.getAppDisplayName(appName)}`);
              }
            } catch (error) {
              console.error(`Error disconnecting ${appName}:`, error);
              Alert.alert(
                'Disconnect Failed', 
                `Failed to disconnect ${composioService.getAppDisplayName(appName)}: ${error instanceof Error ? error.message : 'Unknown error'}`
              );
            }
          },
        },
      ]
    );
  };

  const handleRefresh = async () => {
    if (!user) return;
    
    setRefreshing(true);
    try {
      await loadConnectionStatus(user.id);
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading connections...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>App Connections</Text>
        <Text style={styles.subtitle}>Please sign in to manage your app connections</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <Text style={styles.title}>App Connections</Text>
      <Text style={styles.subtitle}>
        Connect your apps using secure OAuth to enable AI voice and text commands
      </Text>

      {connectionStatus && connectionStatus.supportedApps && (
        <View style={styles.appsContainer}>
          {connectionStatus.supportedApps.map((appName) => {
            const connection = connectionStatus.connections?.[appName as keyof typeof connectionStatus.connections];
            
            // Skip if connection data is missing
            if (!connection) {
              console.warn(`Missing connection data for app: ${appName}`);
              return null;
            }
            
            return (
              <AppConnectionCard
                key={appName}
                appName={appName}
                connection={connection}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                isConnecting={connectingApps.has(appName)}
              />
            );
          })}
        </View>
      )}

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>How Connections Work</Text>
        <Text style={styles.infoText}>
          • Each app uses secure OAuth authentication through Composio{'\n'}
          • Your credentials are never stored - only secure access tokens{'\n'}
          • AI commands can access your real data and perform actions{'\n'}
          • You can disconnect any app at any time{'\n'}
          • All actions are performed with your explicit permission
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    marginBottom: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    opacity: 0.7,
  },
  appsContainer: {
    marginBottom: 32,
  },
  appCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  appInfo: {
    flex: 1,
  },
  appName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  appDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 6,
    lineHeight: 18,
  },
  appStatus: {
    fontSize: 14,
    fontWeight: '500',
  },
  appActions: {
    marginLeft: 16,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    minWidth: 100,
  },
  connectButton: {
    backgroundColor: '#6366f1',
    color: '#ffffff',
  },
  disconnectButton: {
    backgroundColor: '#ef4444',
    color: '#ffffff',
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
    opacity: 0.6,
  },
  connectedAt: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 8,
  },
  infoSection: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
}); 