import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Step Boundary Component
 * Visual separator for multi-step tool invocations
 * Shows step numbers and provides clear boundaries between workflow steps
 */

interface StepBoundaryProps {
  stepNumber: number;
}

export default function StepBoundary({ stepNumber }: StepBoundaryProps) {
  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <View style={styles.stepIndicator}>
        <Text style={styles.stepText}>Step {stepNumber}</Text>
      </View>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    marginHorizontal: 16,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  stepIndicator: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginHorizontal: 8,
  },
  stepText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
}); 