import React, { memo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Host } from '@expo/ui/swift-ui';
import { Switch as SwiftUISwitch } from '@expo/ui/swift-ui';

interface ToggleSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

function ToggleSwitch({ value, onValueChange, color, style }: ToggleSwitchProps) {
  return (
    <View style={[{ justifyContent: 'center' }, style]}>
      <Host matchContents>
        <SwiftUISwitch
          value={value}
          onValueChange={onValueChange}
        />
      </Host>
    </View>
  );
}

export default memo(ToggleSwitch);
