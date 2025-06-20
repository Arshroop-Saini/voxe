import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Text, View } from '@/components/Themed';
import { triggerService, TriggerConfig, AvailableTrigger } from '@/services/triggerService';
import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

export default function MonitoringScreen() {
  const [triggers, setTriggers] = useState<TriggerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState<string>('');
  const [availableTriggers, setAvailableTriggers] = useState<AvailableTrigger[]>([]);
  const [selectedTrigger, setSelectedTrigger] = useState<string>('');
  const [triggerConfig, setTriggerConfig] = useState<string>('{}');
  const [appConnections, setAppConnections] = useState<Record<string, boolean>>({});
  const [selectedTriggerCard, setSelectedTriggerCard] = useState<string>('');
  const [loadingTriggers, setLoadingTriggers] = useState<boolean>(false);

  // Supported apps for MVP
  const supportedApps = [
    { name: 'gmail', display: 'Gmail', icon: 'envelope' },
    { name: 'googlecalendar', display: 'Google Calendar', icon: 'calendar' },
    { name: 'notion', display: 'Notion', icon: 'book' },
    { name: 'slack', display: 'Slack', icon: 'slack' },
    { name: 'github', display: 'GitHub', icon: 'github' },
  ];

  const loadTriggers = useCallback(async () => {
    try {
      setLoading(true);
      const userTriggers = await triggerService.getUserTriggers();
      setTriggers(userTriggers);
      
      // Also load connection status for all supported apps
      await loadAppConnections();
    } catch (error) {
      console.error('Error loading triggers:', error);
      Alert.alert('Error', 'Failed to load triggers. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAppConnections = useCallback(async () => {
    try {
      const connections: Record<string, boolean> = {};
      
      // Check connection status for each supported app
      for (const app of supportedApps) {
        const isConnected = await triggerService.checkAppConnection(app.name);
        connections[app.name] = isConnected;
      }
      
      setAppConnections(connections);
    } catch (error) {
      console.error('Error loading app connections:', error);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTriggers();
    setRefreshing(false);
  }, [loadTriggers]);

  useFocusEffect(
    useCallback(() => {
      loadTriggers();
    }, [loadTriggers])
  );

  const handleAppSelection = async (appName: string) => {
    // Check if app is connected before proceeding
    if (!appConnections[appName]) {
      Alert.alert(
        'App Not Connected',
        `Please connect ${supportedApps.find(app => app.name === appName)?.display || appName} in the Connections tab before creating triggers.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Connections', onPress: () => {
            setShowCreateModal(false);
            // Navigate to connections tab - this would need navigation prop
          }}
        ]
      );
      return;
    }

    setSelectedApp(appName);
    setSelectedTrigger('');
    setSelectedTriggerCard('');
    setAvailableTriggers([]);
    setLoadingTriggers(true);
    
    try {
      const triggers = await triggerService.getAvailableTriggers(appName);
      setAvailableTriggers(triggers);
    } catch (error) {
      console.error('Error loading available triggers:', error);
      Alert.alert('Error', 'Failed to load available triggers for this app.');
    } finally {
      setLoadingTriggers(false);
    }
  };

  // Generate trigger cards from available triggers fetched from Composio
  const getTriggerCards = (appName: string) => {
    if (availableTriggers.length === 0) {
      return [];
    }

    return availableTriggers.map((trigger, index) => ({
      id: `${appName}_${trigger.name}_${index}`,
      title: trigger.display_name || trigger.name,
      description: trigger.description || `Trigger for ${trigger.name}`,
      triggerName: trigger.name,
      config: getDefaultConfigForTrigger(appName, trigger.name),
      icon: getIconForTrigger(appName, trigger.name)
    }));
  };

  // Get default configuration for specific trigger types
  const getDefaultConfigForTrigger = (appName: string, triggerName: string) => {
    if (appName === 'gmail') {
      // For Gmail triggers, default to INBOX monitoring (string format, not array)
      return { labelIds: "INBOX" };
    }
    if (appName === 'googlecalendar') {
      // For Calendar triggers, default to primary calendar
      return { calendarId: "primary" };
    }
    // Default empty config for other triggers
    return {};
  };

  // Get appropriate icon for trigger types
  const getIconForTrigger = (appName: string, triggerName: string): React.ComponentProps<typeof FontAwesome>['name'] => {
    // Gmail trigger icons
    if (appName === 'gmail') {
      return 'envelope';
    }
    // Calendar trigger icons
    if (appName === 'googlecalendar') {
      return 'calendar';
    }
    // Notion trigger icons
    if (appName === 'notion') {
      return 'file-text-o';
    }
    // Slack trigger icons
    if (appName === 'slack') {
      return 'slack';
    }
    // GitHub trigger icons
    if (appName === 'github') {
      return 'github';
    }
    // Default icon
    return 'bell';
  };

  const getDefaultConfig = (appName: string, triggerName: string): string => {
    // Use the same logic as getDefaultConfigForTrigger but return as JSON string
    const config = getDefaultConfigForTrigger(appName, triggerName);
    return JSON.stringify(config, null, 2);
  };

  const handleCreateTrigger = async () => {
    if (!selectedApp || !selectedTriggerCard) {
      Alert.alert('Error', 'Please select an app and trigger type.');
      return;
    }

    try {
      let config = {};
      try {
        config = JSON.parse(triggerConfig);
      } catch (parseError) {
        Alert.alert('Error', 'Invalid JSON configuration. Please check your syntax.');
        return;
      }

      // Get user ID
      const { supabaseService } = await import('@/services/supabase');
      const user = await supabaseService.getCurrentUser();
      
      if (!user?.id) {
        Alert.alert('Error', 'Please sign in to create triggers.');
        return;
      }

      await triggerService.createTrigger({
        user_id: user.id,
        app_name: selectedApp,
        trigger_name: selectedTrigger,
        config,
      });

      setShowCreateModal(false);
      setSelectedApp('');
      setSelectedTrigger('');
      setSelectedTriggerCard('');
      setTriggerConfig('{}');
      await loadTriggers();

      Alert.alert('Success', 'Trigger created successfully!');
    } catch (error) {
      console.error('Error creating trigger:', error);
      Alert.alert('Error', `Failed to create trigger: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleToggleTrigger = async (trigger: TriggerConfig) => {
    try {
      if (trigger.is_active) {
        await triggerService.disableTrigger(trigger.id);
      } else {
        await triggerService.enableTrigger(trigger.id);
      }
      await loadTriggers();
    } catch (error) {
      console.error('Error toggling trigger:', error);
      Alert.alert('Error', 'Failed to toggle trigger status.');
    }
  };

  const handleDeleteTrigger = async (trigger: TriggerConfig) => {
    const isActive = trigger.is_active;
    const action = isActive ? 'disable' : 'reactivate';
    
    console.log(`🔄 ${action} button pressed for trigger:`, trigger.id);
    console.log('🗑️ Trigger details:', { 
      id: trigger.id, 
      app_name: trigger.app_name, 
      trigger_name: trigger.trigger_name,
      composio_trigger_id: trigger.composio_trigger_id,
      is_active: trigger.is_active
    });
    
    const confirmMessage = isActive 
      ? `Are you sure you want to disable the ${trigger.trigger_name} trigger for ${trigger.app_name}? You can reactivate it later.`
      : `Reactivate the ${trigger.trigger_name} trigger for ${trigger.app_name}?`;
      
    const buttonText = isActive ? 'Disable' : 'Reactivate';
    const successMessage = isActive ? 'Trigger disabled successfully!' : 'Trigger reactivated successfully!';
    
    Alert.alert(
      `${isActive ? 'Disable' : 'Reactivate'} Trigger`,
      confirmMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: buttonText,
          style: isActive ? 'destructive' : 'default',
          onPress: async () => {
            try {
              console.log(`🔄 Starting ${action} process for trigger:`, trigger.id);
              
              if (isActive) {
                // Disable trigger
                const result = await triggerService.deleteTrigger(trigger.id);
                console.log('✅ Disable result:', result);
              } else {
                // Reactivate trigger by creating it again (will reactivate existing)
                const result = await triggerService.createTrigger({
                  user_id: trigger.user_id,
                  app_name: trigger.app_name,
                  trigger_name: trigger.trigger_name,
                  config: trigger.config
                });
                console.log('✅ Reactivate result:', result);
              }
              
              console.log('🔄 Reloading triggers list...');
              await loadTriggers();
              console.log('✅ Triggers reloaded');
              
              Alert.alert('Success', successMessage);
            } catch (error) {
              console.error(`❌ Error ${action}ing trigger:`, error);
              Alert.alert('Error', `Failed to ${action} trigger: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          },
        },
      ]
    );
    
    // Original confirmation dialog (commented out for testing)
    /*
    Alert.alert(
      'Delete Trigger',
      `Are you sure you want to delete the ${trigger.trigger_name} trigger for ${trigger.app_name}?`,
      [
        { 
          text: 'Cancel', 
          style: 'cancel',
          onPress: () => console.log('🚫 Delete cancelled by user')
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            console.log('🔥 User confirmed delete - starting process...');
            try {
              console.log('🔄 Starting delete process for trigger:', trigger.id);
              const result = await triggerService.deleteTrigger(trigger.id);
              console.log('✅ Delete result:', result);
              
              console.log('🔄 Reloading triggers list...');
              await loadTriggers();
              console.log('✅ Triggers reloaded');
              
              Alert.alert('Success', 'Trigger deleted successfully!');
            } catch (error) {
              console.error('❌ Error deleting trigger:', error);
              Alert.alert('Error', `Failed to delete trigger: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          },
        },
      ]
    );
    */
  };

  const testWebhook = async () => {
    try {
      const result = await triggerService.testWebhook();
      Alert.alert('Test Result', result.message);
    } catch (error) {
      console.error('Error testing webhook:', error);
      Alert.alert('Error', 'Failed to test webhook.');
    }
  };

  const testGmailTriggers = async () => {
    try {
      const triggers = await triggerService.getAvailableTriggers('gmail');
      Alert.alert(
        'Gmail Triggers Test', 
        `Found ${triggers.length} available Gmail triggers:\n\n${triggers.map(t => `• ${t.display_name || t.name}`).join('\n')}`
      );
    } catch (error) {
      console.error('Error testing Gmail triggers:', error);
      Alert.alert('Error', `Failed to test Gmail triggers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString() + ' ' + 
           new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getAppIcon = (appName: string): React.ComponentProps<typeof FontAwesome>['name'] => {
    const app = supportedApps.find(a => a.name === appName);
    return (app?.icon as React.ComponentProps<typeof FontAwesome>['name']) || 'cog';
  };

  const getAppDisplayName = (appName: string) => {
    const app = supportedApps.find(a => a.name === appName);
    return app?.display || appName;
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading triggers...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Event Monitoring</Text>
          <Text style={styles.subtitle}>
            Monitor and respond to events from your connected apps
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setShowCreateModal(true)}
          >
            <FontAwesome name="plus" size={16} color="white" />
            <Text style={styles.buttonText}>Create Trigger</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={testWebhook}
          >
            <FontAwesome name="flask" size={16} color="#007AFF" />
            <Text style={styles.secondaryButtonText}>Test Webhook</Text>
          </TouchableOpacity>
        </View>

        {/* Gmail Test Button (for Step 5 testing) */}
        <View style={styles.testSection}>
          <TouchableOpacity
            style={styles.testButton}
            onPress={testGmailTriggers}
          >
            <FontAwesome name="envelope" size={16} color="#FF9500" />
            <Text style={styles.testButtonText}>Test Gmail Triggers</Text>
          </TouchableOpacity>
        </View>

        {/* Triggers List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Triggers ({triggers.length})</Text>
          
          {triggers.length === 0 ? (
            <View style={styles.emptyState}>
              <FontAwesome name="bell-slash" size={48} color="#ccc" />
              <Text style={styles.emptyStateTitle}>No triggers configured</Text>
              <Text style={styles.emptyStateText}>
                Create your first trigger to start monitoring events from your connected apps.
              </Text>
            </View>
          ) : (
            triggers.map((trigger) => (
              <View key={trigger.id} style={[
                styles.triggerCard,
                !trigger.is_active && styles.inactiveTriggerCard
              ]}>
                <View style={styles.triggerHeader}>
                  <View style={styles.triggerInfo}>
                    <FontAwesome 
                      name={getAppIcon(trigger.app_name)} 
                      size={20} 
                      color={trigger.is_active ? "#007AFF" : "#999"} 
                    />
                    <View style={styles.triggerDetails}>
                      <Text style={[
                        styles.triggerTitle,
                        !trigger.is_active && styles.inactiveTriggerText
                      ]}>
                        {getAppDisplayName(trigger.app_name)}
                      </Text>
                      <Text style={[
                        styles.triggerSubtitle,
                        !trigger.is_active && styles.inactiveTriggerText
                      ]}>
                        {trigger.trigger_name}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.triggerActions}>
                    <TouchableOpacity
                      style={[
                        styles.statusButton,
                        trigger.is_active ? styles.activeButton : styles.inactiveButton
                      ]}
                      onPress={() => handleToggleTrigger(trigger)}
                    >
                      <Text style={[
                        styles.statusButtonText,
                        trigger.is_active ? styles.activeButtonText : styles.inactiveButtonText
                      ]}>
                        {trigger.is_active ? 'Active' : 'Inactive'}
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.deleteButton,
                        !trigger.is_active && styles.reactivateButton
                      ]}
                      onPress={() => handleDeleteTrigger(trigger)}
                    >
                      <FontAwesome 
                        name={trigger.is_active ? "trash" : "refresh"} 
                        size={16} 
                        color={trigger.is_active ? "#FF3B30" : "#34C759"} 
                      />
                    </TouchableOpacity>
                  </View>
                </View>
                
                <View style={styles.triggerMeta}>
                  <Text style={styles.metaText}>
                    Created: {formatDate(trigger.created_at)}
                  </Text>
                  {trigger.updated_at !== trigger.created_at && (
                    <Text style={styles.metaText}>
                      Updated: {formatDate(trigger.updated_at)}
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Create Trigger Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowCreateModal(false)}
            >
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Create Trigger</Text>
            <TouchableOpacity
              onPress={handleCreateTrigger}
              disabled={!selectedApp || !selectedTrigger}
            >
              <Text style={[
                styles.createButton,
                (!selectedApp || !selectedTrigger) && styles.disabledButton
              ]}>
                Create
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* App Selection */}
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Select App</Text>
              <View style={styles.appGrid}>
                                {supportedApps.map((app) => {
                  const isConnected = appConnections[app.name];
                  const isSelected = selectedApp === app.name;
                  
                  return (
                    <TouchableOpacity
                      key={app.name}
                      style={[
                        styles.appCard,
                        isSelected && styles.selectedAppCard,
                        !isConnected && styles.disconnectedAppCard
                      ]}
                      onPress={() => handleAppSelection(app.name)}
                    >
                      <View style={styles.appCardIconContainer}>
                        <FontAwesome 
                          name={app.icon as React.ComponentProps<typeof FontAwesome>['name']} 
                          size={24} 
                          color={isSelected ? 'white' : isConnected ? '#007AFF' : '#ccc'} 
                        />
                        {isConnected && (
                          <View style={styles.connectedIndicator}>
                            <FontAwesome name="check" size={8} color="white" />
                          </View>
                        )}
                      </View>
                      <Text style={[
                        styles.appCardText,
                        isSelected && styles.selectedAppCardText,
                        !isConnected && styles.disconnectedAppCardText
                      ]}>
                        {app.display}
                      </Text>
                      {!isConnected && (
                        <Text style={styles.notConnectedText}>
                          Not Connected
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Trigger Cards Selection */}
            {selectedApp && (
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Select Trigger Type</Text>
                {loadingTriggers ? (
                  <View style={styles.loadingTriggersContainer}>
                    <ActivityIndicator size="small" color="#007AFF" />
                    <Text style={styles.loadingTriggersText}>Loading available triggers...</Text>
                  </View>
                ) : (
                  <ScrollView style={styles.triggerCardsContainer} showsVerticalScrollIndicator={false}>
                    {getTriggerCards(selectedApp).length === 0 ? (
                      <View style={styles.noTriggersContainer}>
                        <FontAwesome name="exclamation-triangle" size={24} color="#FF9500" />
                        <Text style={styles.noTriggersText}>No triggers available for {selectedApp}</Text>
                      </View>
                    ) : (
                      getTriggerCards(selectedApp).map((card) => (
                        <TouchableOpacity
                          key={card.id}
                          style={[
                            styles.triggerCardOption,
                            selectedTriggerCard === card.id && styles.selectedTriggerCardOption
                          ]}
                          onPress={() => {
                            setSelectedTriggerCard(card.id);
                            setSelectedTrigger(card.triggerName);
                            setTriggerConfig(JSON.stringify(card.config, null, 2));
                          }}
                        >
                          <View style={styles.triggerCardHeader}>
                            <FontAwesome 
                              name={card.icon as React.ComponentProps<typeof FontAwesome>['name']} 
                              size={20} 
                              color={selectedTriggerCard === card.id ? 'white' : '#007AFF'} 
                            />
                            <Text style={[
                              styles.triggerCardTitle,
                              selectedTriggerCard === card.id && styles.selectedTriggerCardTitle
                            ]}>
                              {card.title}
                            </Text>
                          </View>
                          <Text style={[
                            styles.triggerCardDescription,
                            selectedTriggerCard === card.id && styles.selectedTriggerCardDescription
                          ]}>
                            {card.description}
                          </Text>
                          {selectedTriggerCard === card.id && (
                            <View style={styles.triggerCardConfigPreview}>
                              <Text style={styles.triggerCardConfigLabel}>Configuration:</Text>
                              <Text style={styles.triggerCardConfigText}>
                                {JSON.stringify(card.config, null, 2)}
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                )}
              </View>
            )}

            {/* Configuration Preview */}
            {selectedTriggerCard && (
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Selected Configuration</Text>
                <View style={styles.configPreview}>
                  <Text style={styles.configPreviewText}>
                    {triggerConfig}
                  </Text>
                </View>
                <Text style={styles.configHint}>
                  This configuration will be automatically applied when you create the trigger.
                </Text>
              </View>
            )}
          </ScrollView>
          
          {/* Modal Footer */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                !selectedTriggerCard && { backgroundColor: '#ccc', opacity: 0.6 }
              ]}
              onPress={handleCreateTrigger}
              disabled={!selectedTriggerCard}
            >
              <Text style={[
                styles.buttonText,
                !selectedTriggerCard && { color: '#999' }
              ]}>
                Create Trigger
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    gap: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    color: '#333',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  triggerCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  triggerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  triggerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  triggerDetails: {
    marginLeft: 12,
    flex: 1,
  },
  triggerTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  triggerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  triggerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  activeButton: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  inactiveButton: {
    backgroundColor: 'white',
    borderColor: '#FF9500',
  },
  statusButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeButtonText: {
    color: 'white',
  },
  inactiveButtonText: {
    color: '#FF9500',
  },
  deleteButton: {
    padding: 8,
  },
  reactivateButton: {
    backgroundColor: '#E8F5E8',
    borderRadius: 4,
  },
  inactiveTriggerCard: {
    opacity: 0.6,
    backgroundColor: '#F5F5F5',
  },
  inactiveTriggerText: {
    color: '#999',
  },
  triggerMeta: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  metaText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  cancelButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  createButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  disabledButton: {
    color: '#ccc',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  formSection: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  appGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  appCard: {
    width: '30%',
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  selectedAppCard: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  appCardText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
  selectedAppCardText: {
    color: 'white',
  },
  disconnectedAppCard: {
    opacity: 0.6,
    borderColor: '#ccc',
  },
  appCardIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectedIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#34C759',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disconnectedAppCardText: {
    color: '#999',
  },
  notConnectedText: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
    marginTop: 2,
  },
  noTriggersText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  triggerOption: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  selectedTriggerOption: {
    backgroundColor: '#f0f8ff',
    borderColor: '#007AFF',
  },
  triggerOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  selectedTriggerOptionTitle: {
    color: '#007AFF',
  },
  triggerOptionDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  configInput: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    fontFamily: 'monospace',
    textAlignVertical: 'top',
  },
  configHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  testSection: {
    marginVertical: 10,
    paddingHorizontal: 20,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5E6',
    borderColor: '#FF9500',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  testButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#FF9500',
    fontWeight: '600',
  },
  triggerCardsContainer: {
    maxHeight: 300,
  },
  triggerCardOption: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E5E7',
  },
  selectedTriggerCardOption: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  triggerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  triggerCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
    color: '#333',
  },
  selectedTriggerCardTitle: {
    color: 'white',
  },
  triggerCardDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  selectedTriggerCardDescription: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  triggerCardConfigPreview: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  triggerCardConfigLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  triggerCardConfigText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 16,
  },
  configPreview: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E5E7',
  },
  configPreviewText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#333',
    lineHeight: 18,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: 'white',
  },
  loadingTriggersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginVertical: 10,
  },
  loadingTriggersText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#666',
  },
  noTriggersContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff8f0',
    borderRadius: 8,
    marginVertical: 10,
  },
}); 