import React, { memo } from 'react';
import { Switch, type StyleProp, type ViewStyle } from 'react-native';

interface ToggleSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** Active track color */
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Android / default fallback — wraps the React Native Switch.
 */
function ToggleSwitch({ value, onValueChange, color, style }: ToggleSwitchProps) {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={color ? { true: color } : undefined}
      style={style}
    />
  );
}

export default memo(ToggleSwitch);
