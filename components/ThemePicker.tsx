import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettings } from '@/contexts/SettingsContext';
import type { ReadingTheme } from '@/types/settings';

/**
 * Reading theme picker: shows color swatches for each available theme.
 */
export default function ThemePicker({ showLabel = true }: { showLabel?: boolean } = {}) {
  const { colors } = useTheme();
  const { settings, updateReadingSettings, allThemes } = useSettings();

  const selectedId = settings.reading.readingThemeId;

  return (
    <View className="rounded-app-lg p-md bg-surface dark:bg-surface-dark">
      {showLabel && <Text className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-2">Reader Theme</Text>}
      {/* StyleSheet kept: gap uses computed value (Spacing.md - 2 = 14) */}
      <View className="flex-row flex-wrap" style={styles.row}>
        {allThemes.map((theme) => (
          <ThemeSwatch
            key={theme.id}
            theme={theme}
            isSelected={selectedId === theme.id}
            onPress={() => updateReadingSettings({ readingThemeId: theme.id })}
          />
        ))}
      </View>
    </View>
  );
}

function ThemeSwatch({
  theme,
  isSelected,
  onPress,
}: {
  theme: ReadingTheme;
  isSelected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable onPress={onPress} className="items-center w-14">
      {/* StyleSheet kept: dynamic backgroundColor/borderColor from theme object */}
      <View
        className="w-12 h-12 rounded-app-md justify-center items-center"
        style={[
          {
            backgroundColor: theme.backgroundColor,
            borderColor: theme.textColor,
            borderWidth: 2,
          },
          isSelected && { borderColor: colors.tint, borderWidth: 3 },
        ]}
      >
        <Text
          className="text-lg font-semibold"
          style={{ color: theme.textColor }}
        >
          Aa
        </Text>
      </View>
      <Text
        className="text-[10px] mt-1 text-center text-text-secondary dark:text-text-secondary-dark"
      >
        {theme.name}
      </Text>
    </Pressable>
  );
}

// StyleSheet kept: gap value is a non-standard computed constant
const styles = StyleSheet.create({
  row: {
    gap: 14,
  },
});
