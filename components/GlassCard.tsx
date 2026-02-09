import React from 'react';
import { View, ViewStyle } from 'react-native';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
}

/**
 * Default (non-iOS) fallback for GlassCard.
 * Uses a semi-transparent background.
 */
export default function GlassCard({ children, style }: GlassCardProps) {
  return (
    <View className="rounded-app-lg overflow-hidden p-md bg-white/10" style={style}>
      {children}
    </View>
  );
}
