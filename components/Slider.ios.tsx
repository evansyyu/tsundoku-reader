import React, { memo, useCallback } from 'react';
import { View, ViewStyle } from 'react-native';
import { Host } from '@expo/ui/swift-ui';
import { Slider as SwiftUISlider } from '@expo/ui/swift-ui';

interface SliderProps {
  value: number;
  minimumValue: number;
  maximumValue: number;
  step?: number;
  onValueChange: (value: number) => void;
  tintColor?: string;
  /** Color for the unfilled portion of the track (unused on iOS native) */
  trackColor?: string;
  style?: ViewStyle;
  disabled?: boolean;
}

/**
 * iOS-native slider using SwiftUI Slider via @expo/ui.
 * Accepts the same props as the custom Slider.tsx (Android fallback).
 */
function SliderComponent({
  value,
  minimumValue,
  maximumValue,
  step = 1,
  onValueChange,
  tintColor,
  style,
  disabled = false,
}: SliderProps) {
  const range = maximumValue - minimumValue;
  const steps = step > 0 && range > 0 ? Math.round(range / step) : 0;

  const handleValueChange = useCallback(
    (newValue: number) => {
      if (disabled) return;
      // Snap to step increments to match custom slider behavior
      const stepped = Math.round(newValue / step) * step;
      const clamped = Math.max(minimumValue, Math.min(maximumValue, stepped));
      onValueChange(clamped);
    },
    [disabled, step, minimumValue, maximumValue, onValueChange]
  );

  if (disabled || range <= 0) {
    return <View style={[{ height: 30, justifyContent: 'center' }, style]} />;
  }

  return (
    <View style={[{ height: 30, justifyContent: 'center' }, style]}>
      <Host style={{ flex: 1 }}>
        <SwiftUISlider
          value={value}
          min={minimumValue}
          max={maximumValue}
          steps={steps}
          color={tintColor}
          onValueChange={handleValueChange}
        />
      </Host>
    </View>
  );
}

export default memo(SliderComponent);
