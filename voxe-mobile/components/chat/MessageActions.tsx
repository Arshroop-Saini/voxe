import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Share,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

/**
 * Message Actions Component
 * Provides interactive features for individual chat messages
 * Supports copy, regenerate, rate, and share functionality
 */

interface MessageActionsProps {
  messageId: string;
  content: string;
  isUser: boolean;
  onRegenerate?: (messageId: string) => void;
  onRate?: (messageId: string, rating: number) => void;
  onDelete?: (messageId: string) => void;
}

export default function MessageActions({
  messageId,
  content,
  isUser,
  onRegenerate,
  onRate,
  onDelete,
}: MessageActionsProps) {
  const [showActions, setShowActions] = useState(false);
  const [rating, setRating] = useState<number | null>(null);

  // Copy message content to clipboard
  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(content);
      Alert.alert('Copied', 'Message copied to clipboard');
      setShowActions(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to copy message');
    }
  };

  // Share message content
  const handleShare = async () => {
    try {
      const result = await Share.share({
        message: content,
        title: 'Shared from Voxe',
      });
      
      if (result.action === Share.sharedAction) {
        setShowActions(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to share message');
    }
  };

  // Regenerate AI response
  const handleRegenerate = () => {
    if (onRegenerate) {
      Alert.alert(
        'Regenerate Response',
        'Generate a new response for this message?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Regenerate',
            onPress: () => {
              onRegenerate(messageId);
              setShowActions(false);
            },
          },
        ]
      );
    }
  };

  // Rate message quality
  const handleRate = (newRating: number) => {
    setRating(newRating);
    if (onRate) {
      onRate(messageId, newRating);
    }
    Alert.alert('Thank you!', 'Your rating helps improve Voxe');
    setShowActions(false);
  };

  // Delete message
  const handleDelete = () => {
    if (onDelete) {
      Alert.alert(
        'Delete Message',
        'Are you sure you want to delete this message?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              onDelete(messageId);
              setShowActions(false);
            },
          },
        ]
      );
    }
  };

  // Show action sheet on iOS, custom modal on Android
  const showActionSheet = () => {
    if (Platform.OS === 'ios') {
      const options = ['Copy', 'Share'];
      
      if (!isUser && onRegenerate) {
        options.push('Regenerate');
      }
      
      if (!isUser && onRate) {
        options.push('Rate');
      }
      
      if (onDelete) {
        options.push('Delete');
      }
      
      options.push('Cancel');

      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: options.length - 1,
          destructiveButtonIndex: onDelete ? options.indexOf('Delete') : undefined,
        },
        (buttonIndex) => {
          switch (options[buttonIndex]) {
            case 'Copy':
              handleCopy();
              break;
            case 'Share':
              handleShare();
              break;
            case 'Regenerate':
              handleRegenerate();
              break;
            case 'Rate':
              setShowActions(true);
              break;
            case 'Delete':
              handleDelete();
              break;
          }
        }
      );
    } else {
      setShowActions(true);
    }
  };

  // Render rating stars
  const renderRatingStars = () => (
    <View style={styles.ratingContainer}>
      <Text style={styles.ratingTitle}>Rate this response:</Text>
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => handleRate(star)}
            style={styles.starButton}
          >
            <Ionicons
              name={star <= (rating || 0) ? 'star' : 'star-outline'}
              size={24}
              color="#FFD700"
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // Render action buttons for Android
  const renderActionButtons = () => (
    <View style={styles.actionsContainer}>
      <TouchableOpacity onPress={handleCopy} style={styles.actionButton}>
        <Ionicons name="copy-outline" size={20} color="#007AFF" />
        <Text style={styles.actionText}>Copy</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
        <Ionicons name="share-outline" size={20} color="#007AFF" />
        <Text style={styles.actionText}>Share</Text>
      </TouchableOpacity>

      {!isUser && onRegenerate && (
        <TouchableOpacity onPress={handleRegenerate} style={styles.actionButton}>
          <Ionicons name="refresh-outline" size={20} color="#007AFF" />
          <Text style={styles.actionText}>Regenerate</Text>
        </TouchableOpacity>
      )}

      {onDelete && (
        <TouchableOpacity onPress={handleDelete} style={styles.actionButton}>
          <Ionicons name="trash-outline" size={20} color="#ff4444" />
          <Text style={[styles.actionText, { color: '#ff4444' }]}>Delete</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={() => setShowActions(false)}
        style={styles.actionButton}
      >
        <Ionicons name="close-outline" size={20} color="#666" />
        <Text style={[styles.actionText, { color: '#666' }]}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Action trigger button */}
      <TouchableOpacity onPress={showActionSheet} style={styles.triggerButton}>
        <Ionicons name="ellipsis-horizontal" size={16} color="#666" />
      </TouchableOpacity>

      {/* Action modal for Android */}
      {showActions && Platform.OS === 'android' && (
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            {!isUser && onRate ? renderRatingStars() : renderActionButtons()}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  triggerButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    marginLeft: 8,
  },
  modal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    minWidth: 280,
    maxWidth: 320,
  },
  actionsContainer: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
  },
  actionText: {
    fontSize: 16,
    color: '#007AFF',
    marginLeft: 12,
    fontWeight: '500',
  },
  ratingContainer: {
    alignItems: 'center',
  },
  ratingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
}); 