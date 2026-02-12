import React, { memo } from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import { Host, Picker } from '@expo/ui/swift-ui';
import { frame } from '@expo/ui/swift-ui/modifiers';

interface MenuPickerProps {
  label: string;
  options: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * iOS-native menu picker using SwiftUI Picker with variant="menu".
 * Shows a label on the left (RN Text) and the native dropdown on the right.
 * The selected value + chevron are rendered by the SwiftUI Picker in blue.
 */
function MenuPicker({
  label,
  options,
  selectedIndex,
  onSelect,
  color,
  style,
}: MenuPickerProps) {
  return (
    <View
      style={[
        {
          height: 44,
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: 16,
        },
        style,
      ]}
    >
      <Text className="text-lg text-black dark:text-white">{label}</Text>
      <View style={{ flex: 1 }}>
        <Host style={{ flex: 1 }}>
          <Picker
            options={options}
            selectedIndex={selectedIndex >= 0 ? selectedIndex : 0}
            onOptionSelected={({ nativeEvent: { index } }) => {
              if (index >= 0 && index < options.length) {
                onSelect(index);
              }
            }}
            variant="menu"
            color={color}
            modifiers={[frame({ maxWidth: 10000, alignment: 'trailing' })]}
          />
        </Host>
      </View>
    </View>
  );
}

export default memo(MenuPicker);
