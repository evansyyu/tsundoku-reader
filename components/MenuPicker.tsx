import React, { memo, useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface MenuPickerProps {
  label: string;
  options: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Android fallback for MenuPicker.
 * Renders as a tappable row that opens a modal dropdown with options.
 */
function MenuPicker({
  label,
  options,
  selectedIndex,
  onSelect,
  color,
  style,
}: MenuPickerProps) {
  const { colors, isDark } = useTheme();
  const [visible, setVisible] = useState(false);
  const currentValue = options[selectedIndex] ?? '';

  const handleSelect = useCallback(
    (index: number) => {
      onSelect(index);
      setVisible(false);
    },
    [onSelect]
  );

  const tint = color ?? colors.tint;

  return (
    <>
      <Pressable
        style={[styles.row, style]}
        onPress={() => setVisible(true)}
      >
        <Text
          className="text-base text-black dark:text-white"
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text
          className="text-base"
          style={{ color: tint }}
          numberOfLines={1}
        >
          {currentValue} ⇅
        </Text>
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <View
            style={[
              styles.menu,
              {
                backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF',
                shadowColor: '#000',
              },
            ]}
          >
            {options.map((opt, i) => (
              <Pressable
                key={i}
                style={[
                  styles.menuItem,
                  i < options.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => handleSelect(i)}
              >
                <Text
                  className="text-base text-black dark:text-white"
                  style={i === selectedIndex ? { color: tint, fontWeight: '600' } : undefined}
                >
                  {opt}
                </Text>
                {i === selectedIndex && (
                  <Text style={{ color: tint, fontSize: 17, fontWeight: '600' }}>✓</Text>
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

export default memo(MenuPicker);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 44,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  menu: {
    width: 280,
    borderRadius: 14,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
