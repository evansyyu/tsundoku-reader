import React, { memo, useCallback, useRef } from 'react';
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

interface SliderProps {
  value: number;
  minimumValue: number;
  maximumValue: number;
  step?: number;
  onValueChange: (value: number) => void;
  tintColor?: string;
  /** Color for the unfilled portion of the track */
  trackColor?: string;
  style?: ViewStyle;
  disabled?: boolean;
}

/**
 * Custom slider with full touch + drag support.
 * Uses View responder system for reliable gesture handling.
 */
function SliderComponent({
  value,
  minimumValue,
  maximumValue,
  step = 1,
  onValueChange,
  tintColor = '#007AFF',
  trackColor = 'rgba(120,120,128,0.3)',
  style,
  disabled = false,
}: SliderProps) {
  const trackWidth = useRef(0);

  const range = maximumValue - minimumValue;
  const fraction = range > 0 ? (value - minimumValue) / range : 0;

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
  }, []);

  const computeValue = useCallback(
    (locationX: number) => {
      const width = trackWidth.current;
      if (width <= 0 || range <= 0) return minimumValue;
      const ratio = Math.max(0, Math.min(1, locationX / width));
      const raw = minimumValue + ratio * range;
      const stepped = Math.round(raw / step) * step;
      return Math.max(minimumValue, Math.min(maximumValue, stepped));
    },
    [minimumValue, maximumValue, range, step]
  );

  const handleTouch = useCallback(
    (e: GestureResponderEvent) => {
      if (disabled) return;
      const newValue = computeValue(e.nativeEvent.locationX);
      onValueChange(newValue);
    },
    [computeValue, onValueChange, disabled]
  );

  return (
    <View
      style={[styles.container, style]}
      onLayout={handleLayout}
      onStartShouldSetResponder={() => !disabled && range > 0}
      onMoveShouldSetResponder={() => !disabled && range > 0}
      onResponderGrant={handleTouch}
      onResponderMove={handleTouch}
    >
      {/* Track background */}
      <View style={[styles.track, { backgroundColor: trackColor }]}>
        {/* Filled portion */}
        <View
          style={[
            styles.trackFilled,
            {
              backgroundColor: disabled ? 'rgba(120,120,128,0.5)' : tintColor,
              width: `${Math.max(0, Math.min(100, fraction * 100))}%`,
            },
          ]}
        />
      </View>

      {/* Thumb */}
      <View
        style={[
          styles.thumb,
          {
            backgroundColor: disabled ? '#A0A0A0' : '#FFFFFF',
            left: `${Math.max(0, Math.min(100, fraction * 100))}%`,
          },
        ]}
      />
    </View>
  );
}

export default memo(SliderComponent);

const styles = StyleSheet.create({
  container: {
    height: 30,
    justifyContent: 'center',
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  trackFilled: {
    height: '100%',
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: -10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
});
