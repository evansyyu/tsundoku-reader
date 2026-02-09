import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettings } from '@/contexts/SettingsContext';
import type { ReadingTheme } from '@/types/settings';
import { BorderRadius, Spacing } from '@/constants/layout';

/**
 * Reading theme picker: shows color swatches for each available theme.
 */
export default function ThemePicker() {
  const { colors } = useTheme();
  const { settings, updateReadingSettings, allThemes } = useSettings();

  const selectedId = settings.reading.readingThemeId;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={styles.row}>
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
    <Pressable onPress={onPress} style={styles.swatchContainer}>
      <View
        style={[
          styles.swatch,
          { backgroundColor: theme.backgroundColor, borderColor: theme.textColor },
          isSelected && { borderColor: colors.tint, borderWidth: 3 },
        ]}
      >
        <Text
          style={[styles.swatchText, { color: theme.textColor }]}
          numberOfLines={1}
        >
          Aa
        </Text>
      </View>
      <Text
        style={[styles.swatchLabel, { color: colors.textSecondary }]}
        numberOfLines={1}
      >
        {theme.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md - 2,
  },
  swatchContainer: {
    alignItems: 'center',
    width: 56,
  },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swatchText: {
    fontSize: 18,
    fontWeight: '600',
  },
  swatchLabel: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
});
