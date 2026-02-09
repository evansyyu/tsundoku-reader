import React from 'react';
import { ViewStyle } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { BlurView } from 'expo-blur';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  /**
   * When true, uses the SwiftUI glassEffect modifier via @expo/ui
   * for enhanced Liquid Glass on iOS 26+.
   * Falls back to GlassView / BlurView when false or unavailable.
   */
  useSwiftUIGlass?: boolean;
}

/**
 * iOS-specific glass card with Liquid Glass (iOS 26+) fallback to BlurView.
 *
 * The primary implementation uses expo-glass-effect's GlassView which
 * provides Liquid Glass on iOS 26+ and falls back to BlurView for older iOS.
 *
 * For components rendered inside a SwiftUI Host context, use the
 * glassEffect modifier from @expo/ui/swift-ui/modifiers directly instead:
 *
 *   import { glassEffect } from '@expo/ui/swift-ui/modifiers';
 *   <Text modifiers={[glassEffect({ glass: { variant: 'clear' } })]} />
 */
export default function GlassCard({ children, style, intensity = 80 }: GlassCardProps) {
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView className="rounded-app-lg overflow-hidden p-md" style={style}>
        {children}
      </GlassView>
    );
  }

  return (
    <BlurView intensity={intensity} className="rounded-app-lg overflow-hidden p-md" style={style}>
      {children}
    </BlurView>
  );
}
