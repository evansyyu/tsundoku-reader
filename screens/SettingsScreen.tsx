import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettings } from '@/contexts/SettingsContext';
import { BorderRadius, Spacing } from '@/constants/layout';
import { FONT_FAMILIES, FONT_SIZE_MAX, FONT_SIZE_MIN, FONT_SIZE_SCALE, LINE_HEIGHT_OPTIONS } from '@/constants/typography';
import type { AppThemeMode, ViewMode } from '@/types/settings';
import Slider from '@/components/Slider';
import ThemePicker from '@/components/ThemePicker';

export default function SettingsScreen() {
  const { colors, themeMode, setThemeMode, isDark } = useTheme();
  const { settings, updateReadingSettings, allThemes } = useSettings();

  const { reading } = settings;

  return (
    <SafeAreaView
      edges={['left', 'right']}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* App Theme Section */}
        <SectionHeader title="App Theme" color={colors.text} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {(['light', 'dark', 'auto'] as AppThemeMode[]).map((mode) => (
            <Pressable
              key={mode}
              style={[
                styles.optionRow,
                mode !== 'auto' && styles.optionRowBorder,
                { borderColor: colors.border },
              ]}
              onPress={() => setThemeMode(mode)}
            >
              <Text style={[styles.optionLabel, { color: colors.text }]}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Text>
              {themeMode === mode && (
                <Text style={[styles.checkmark, { color: colors.tint }]}>✓</Text>
              )}
            </Pressable>
          ))}
        </View>

        {/* Reading Theme Section */}
        <SectionHeader title="Reading Theme" color={colors.text} />
        <ThemePicker />

        {/* Typography Section */}
        <SectionHeader title="Text Size" color={colors.text} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.sliderRow}>
            <Text style={[styles.sliderLabel, { color: colors.textSecondary }]}>A</Text>
            <Slider
              value={reading.fontSizeScale}
              minimumValue={FONT_SIZE_MIN}
              maximumValue={FONT_SIZE_MAX}
              step={1}
              onValueChange={(v) => updateReadingSettings({ fontSizeScale: v })}
              tintColor={colors.tint}
              style={{ flex: 1 }}
            />
            <Text style={[styles.sliderLabelLarge, { color: colors.textSecondary }]}>A</Text>
          </View>
        </View>

        {/* Line Height Section */}
        <SectionHeader title="Line Height" color={colors.text} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {LINE_HEIGHT_OPTIONS.map((lh, i) => (
            <Pressable
              key={lh}
              style={[
                styles.optionRow,
                i < LINE_HEIGHT_OPTIONS.length - 1 && styles.optionRowBorder,
                { borderColor: colors.border },
              ]}
              onPress={() => updateReadingSettings({ lineHeight: lh })}
            >
              <Text style={[styles.optionLabel, { color: colors.text }]}>{lh}x</Text>
              {reading.lineHeight === lh && (
                <Text style={[styles.checkmark, { color: colors.tint }]}>✓</Text>
              )}
            </Pressable>
          ))}
        </View>

        {/* Font Family Section */}
        <SectionHeader title="Font" color={colors.text} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {FONT_FAMILIES.map((font, i) => (
            <Pressable
              key={font.id}
              style={[
                styles.optionRow,
                i < FONT_FAMILIES.length - 1 && styles.optionRowBorder,
                { borderColor: colors.border },
              ]}
              onPress={() => updateReadingSettings({ fontFamily: font.value })}
            >
              <Text style={[styles.optionLabel, { color: colors.text, fontFamily: font.value }]}>
                {font.name}
              </Text>
              {reading.fontFamily === font.value && (
                <Text style={[styles.checkmark, { color: colors.tint }]}>✓</Text>
              )}
            </Pressable>
          ))}
        </View>

        {/* View Mode Section */}
        <SectionHeader title="View Mode" color={colors.text} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {(['paginated', 'continuous'] as ViewMode[]).map((mode, i) => (
            <Pressable
              key={mode}
              style={[
                styles.optionRow,
                i === 0 && styles.optionRowBorder,
                { borderColor: colors.border },
              ]}
              onPress={() => updateReadingSettings({ viewMode: mode })}
            >
              <Text style={[styles.optionLabel, { color: colors.text }]}>
                {mode === 'paginated' ? 'Paginated' : 'Continuous Scroll'}
              </Text>
              {reading.viewMode === mode && (
                <Text style={[styles.checkmark, { color: colors.tint }]}>✓</Text>
              )}
            </Pressable>
          ))}
        </View>

        <View style={styles.footer} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ title, color }: { title: string; color: string }) {
  return (
    <Text style={[styles.sectionHeader, { color }]}>{title}</Text>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  card: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  optionRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionLabel: {
    fontSize: 16,
  },
  checkmark: {
    fontSize: 17,
    fontWeight: '600',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  sliderLabelLarge: {
    fontSize: 22,
    fontWeight: '500',
  },
  footer: {
    height: Spacing.xxl,
  },
});
