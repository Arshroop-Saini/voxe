import React, { useState, useEffect } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Text, View } from '@/components/Themed';
import { FontAwesome } from '@expo/vector-icons';
import { emailEmbeddingService, EmbedEmailsResponse } from '@/services/emailEmbeddingService';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

interface EmailEmbeddingButtonProps {
  onSuccess?: (result: EmbedEmailsResponse) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  style?: any;
  size?: 'small' | 'medium' | 'large';
  variant?: 'primary' | 'secondary' | 'ghost';
}

export const EmailEmbeddingButton: React.FC<EmailEmbeddingButtonProps> = ({
  onSuccess,
  onError,
  disabled = false,
  style,
  size = 'medium',
  variant = 'primary'
}) => {
  const [isEmbedding, setIsEmbedding] = useState(false);
  const [lastEmbedding, setLastEmbedding] = useState<string | null>(null);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Animation for pulse effect during loading
  const pulseAnim = new Animated.Value(1);

  useEffect(() => {
    if (isEmbedding) {
      // Start pulsing animation
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.7,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();

      return () => {
        pulse.stop();
        pulseAnim.setValue(1);
      };
    }
  }, [isEmbedding, pulseAnim]);

  const handleEmbedEmails = async () => {
    if (isEmbedding || disabled) return;

    setIsEmbedding(true);
    
    try {
      console.log('🔄 EmailEmbeddingButton: Starting email embedding...');
      const result = await emailEmbeddingService.embedDailyEmails();

      if (result.success) {
        const successMessage = result.data 
          ? `Successfully embedded ${result.data.successful} out of ${result.data.totalEmails} emails!`
          : 'Emails embedded successfully!';

        Alert.alert(
          'Success! 📧',
          successMessage,
          [
            { 
              text: 'Great!', 
              style: 'default',
              onPress: () => {
                setLastEmbedding(new Date().toLocaleTimeString());
              }
            }
          ]
        );

        onSuccess?.(result);
      } else {
        throw new Error(result.message || 'Email embedding failed');
      }
    } catch (error: any) {
      console.error('❌ EmailEmbeddingButton: Email embedding failed:', error);
      
      // Parse error message for user-friendly display
      let errorMessage = 'Failed to embed emails. Please try again.';
      
      if (error.message?.includes('authentication')) {
        errorMessage = 'Please sign in to embed emails.';
      } else if (error.message?.includes('Gmail')) {
        errorMessage = 'Gmail connection issue. Please check your Gmail connection in Settings.';
      } else if (error.message?.includes('rate limit')) {
        errorMessage = 'Too many requests. Please wait a moment and try again.';
      } else if (error.message?.includes('network')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }

      Alert.alert(
        'Error 😞',
        errorMessage,
        [
          { text: 'OK', style: 'default' },
          { 
            text: 'Retry', 
            style: 'default',
            onPress: () => handleEmbedEmails()
          }
        ]
      );

      onError?.(error.message || errorMessage);
    } finally {
      setIsEmbedding(false);
    }
  };

  // Get button styles based on variant and size
  const getButtonStyles = () => {
    const baseStyle: any[] = [styles.button];
    
    // Size styles
    switch (size) {
      case 'small':
        baseStyle.push(styles.buttonSmall);
        break;
      case 'large':
        baseStyle.push(styles.buttonLarge);
        break;
      default:
        baseStyle.push(styles.buttonMedium);
    }

    // Variant styles
    switch (variant) {
      case 'primary':
        baseStyle.push(styles.buttonPrimary);
        baseStyle.push({ backgroundColor: colors.tint });
        break;
      case 'secondary':
        baseStyle.push(styles.buttonSecondary);
        baseStyle.push({ 
          backgroundColor: colors.background,
          borderColor: colors.tint,
          borderWidth: 1
        });
        break;
      case 'ghost':
        baseStyle.push(styles.buttonGhost);
        break;
    }

    // Disabled state
    if (disabled || isEmbedding) {
      baseStyle.push(styles.buttonDisabled);
    }

    return baseStyle;
  };

  const getTextStyles = () => {
    const baseStyle: any[] = [styles.buttonText];
    
    // Size text styles
    switch (size) {
      case 'small':
        baseStyle.push(styles.textSmall);
        break;
      case 'large':
        baseStyle.push(styles.textLarge);
        break;
      default:
        baseStyle.push(styles.textMedium);
    }

    // Variant text styles
    switch (variant) {
      case 'primary':
        baseStyle.push({ color: '#FFFFFF' });
        break;
      case 'secondary':
        baseStyle.push({ color: colors.tint });
        break;
      case 'ghost':
        baseStyle.push({ color: colors.text });
        break;
    }

    // Disabled text color
    if (disabled || isEmbedding) {
      baseStyle.push({ color: colors.tabIconDefault });
    }

    return baseStyle;
  };

  const getIconSize = () => {
    switch (size) {
      case 'small': return 14;
      case 'large': return 24;
      default: return 18;
    }
  };

  const getIconColor = () => {
    if (disabled || isEmbedding) return colors.tabIconDefault;
    
    switch (variant) {
      case 'primary': return '#FFFFFF';
      case 'secondary': return colors.tint;
      case 'ghost': return colors.text;
      default: return '#FFFFFF';
    }
  };

  return (
    <View style={[styles.container, style]}>
      <Animated.View style={{ opacity: pulseAnim }}>
        <TouchableOpacity
          style={getButtonStyles()}
          onPress={handleEmbedEmails}
          disabled={disabled || isEmbedding}
          activeOpacity={0.7}
        >
          <View style={styles.buttonContent}>
            {isEmbedding ? (
              <ActivityIndicator 
                size="small" 
                color={getIconColor()} 
                style={styles.icon}
              />
            ) : (
              <FontAwesome
                name="envelope"
                size={getIconSize()}
                color={getIconColor()}
                style={styles.icon}
              />
            )}
            <Text style={getTextStyles()}>
              {isEmbedding ? 'Embedding...' : 'Embed Today\'s Emails'}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
      
      {lastEmbedding && !isEmbedding && (
        <Text style={[styles.lastEmbeddingText, { color: colors.tabIconDefault }]}>
          Last embedded: {lastEmbedding}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 8,
  },
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonSmall: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
  },
  buttonMedium: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
  },
  buttonLarge: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    minHeight: 52,
  },
  buttonPrimary: {
    // backgroundColor set dynamically
  },
  buttonSecondary: {
    // backgroundColor and borderColor set dynamically
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  buttonText: {
    fontWeight: '600',
    textAlign: 'center',
  },
  textSmall: {
    fontSize: 14,
  },
  textMedium: {
    fontSize: 16,
  },
  textLarge: {
    fontSize: 18,
  },
  icon: {
    marginRight: 8,
  },
  lastEmbeddingText: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    fontStyle: 'italic',
  },
}); 