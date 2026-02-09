import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { BlurView } from 'expo-blur';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
}

/**
 * iOS-specific glass card with Liquid Glass (iOS 26+) fallback to BlurView.
 */
export default function GlassCard({ children, style, intensity = 80 }: GlassCardProps) {
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView style={[styles.card, style]}>
        {children}
      </GlassView>
    );
  }

  return (
    <BlurView intensity={intensity} style={[styles.card, style]}>
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    padding: 16,
  },
});
