import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettings } from '@/contexts/SettingsContext';
import { FONT_FAMILIES, FONT_SIZE_MAX, FONT_SIZE_MIN } from '@/constants/typography';
import { LINE_HEIGHT_OPTIONS } from '@/constants/typography';
import type { ViewMode } from '@/types/settings';
import Slider from '@/components/Slider';
import ToggleSwitch from '@/components/ToggleSwitch';
import ThemePicker from '@/components/ThemePicker';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { settings, updateReadingSettings } = useSettings();

  const { reading } = settings;

  return (
    <SafeAreaView
      edges={['left', 'right']}
      className="flex-1 bg-white dark:bg-black"
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        scrollToOverflowEnabled
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader title="Reader" />

        {/* Text Size */}
        <View className="rounded-app-lg overflow-hidden bg-surface dark:bg-surface-dark">
          <View className="flex-row items-center px-md py-sm gap-sm">
            <Text className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">A</Text>
            <Slider
              value={reading.fontSizeScale}
              minimumValue={FONT_SIZE_MIN}
              maximumValue={FONT_SIZE_MAX}
              step={1}
              onValueChange={(v) => updateReadingSettings({ fontSizeScale: v })}
              tintColor={colors.tint}
              style={{ flex: 1 }}
            />
            <Text className="text-[22px] font-medium text-text-secondary dark:text-text-secondary-dark">A</Text>
          </View>
        </View>

        {/* Line Height */}
        <View className="rounded-app-lg overflow-hidden bg-surface dark:bg-surface-dark mt-sm">
          {LINE_HEIGHT_OPTIONS.map((lh, i) => (
            <Pressable
              key={lh}
              className="flex-row items-center justify-between px-md py-3.5"
              style={i < LINE_HEIGHT_OPTIONS.length - 1 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border } : undefined}
              onPress={() => updateReadingSettings({ lineHeight: lh })}
            >
              <Text className="text-base text-black dark:text-white">{lh}x</Text>
              {reading.lineHeight === lh && (
                <Text className="text-[17px] font-semibold text-tint dark:text-tint-dark">✓</Text>
              )}
            </Pressable>
          ))}
        </View>

        {/* Font Family */}
        <View className="rounded-app-lg overflow-hidden bg-surface dark:bg-surface-dark mt-sm">
          {FONT_FAMILIES.map((font, i) => (
            <Pressable
              key={font.id}
              className="flex-row items-center justify-between px-md py-3.5"
              style={i < FONT_FAMILIES.length - 1 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border } : undefined}
              onPress={() => updateReadingSettings({ fontFamily: font.value })}
            >
              <Text
                className="text-base text-black dark:text-white"
                // StyleSheet kept: fontFamily is a dynamic runtime value
                style={{ fontFamily: font.value }}
              >
                {font.name}
              </Text>
              {reading.fontFamily === font.value && (
                <Text className="text-[17px] font-semibold text-tint dark:text-tint-dark">✓</Text>
              )}
            </Pressable>
          ))}
        </View>

        {/* Furigana Toggle */}
        <View className="rounded-app-lg overflow-hidden bg-surface dark:bg-surface-dark mt-sm">
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              height: 44,
            }}
          >
            <Text className="text-base text-black dark:text-white">Furigana</Text>
            <ToggleSwitch
              value={reading.showFurigana}
              onValueChange={(v) => updateReadingSettings({ showFurigana: v })}
              color={colors.tint}
            />
          </View>
        </View>

        {/* View Mode */}
        <View className="rounded-app-lg overflow-hidden bg-surface dark:bg-surface-dark mt-sm">
          {(['paginated', 'continuous'] as ViewMode[]).map((mode, i) => (
            <Pressable
              key={mode}
              className="flex-row items-center justify-between px-md py-3.5"
              style={i === 0 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border } : undefined}
              onPress={() => updateReadingSettings({ viewMode: mode })}
            >
              <Text className="text-base text-black dark:text-white">
                {mode === 'paginated' ? 'Paginated' : 'Continuous Scroll'}
              </Text>
              {reading.viewMode === mode && (
                <Text className="text-[17px] font-semibold text-tint dark:text-tint-dark">✓</Text>
              )}
            </Pressable>
          ))}
        </View>

        {/* Reading Theme */}
        <View className="mt-sm">
          <ThemePicker />
        </View>

        <View className="h-xxl" />
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-[13px] font-semibold uppercase tracking-wider mt-lg mb-sm ml-xs text-black dark:text-white">
      {title}
    </Text>
  );
}
