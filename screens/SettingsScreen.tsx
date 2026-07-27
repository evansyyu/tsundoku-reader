import React, { useMemo } from 'react';
import {
  Linking,
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
import MenuPicker from '@/components/MenuPicker';
import ToggleSwitch from '@/components/ToggleSwitch';
import ThemePicker from '@/components/ThemePicker';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { settings, updateReadingSettings } = useSettings();

  const { reading } = settings;

  const lineHeightLabels = useMemo(
    () => LINE_HEIGHT_OPTIONS.map((lh) => `${lh}x`),
    [],
  );
  const currentLineHeightIndex = LINE_HEIGHT_OPTIONS.indexOf(reading.lineHeight);

  const fontFamilyNames = useMemo(
    () => FONT_FAMILIES.map((f) => f.name),
    [],
  );
  const currentFontIndex = FONT_FAMILIES.findIndex(
    (f) => f.value === reading.fontFamily,
  );

  const viewModeOptions = useMemo(() => ['Paginated', 'Continuous Scroll'], []);
  const currentViewModeIndex = reading.viewMode === 'paginated' ? 0 : 1;
  const VIEW_MODES: ViewMode[] = ['paginated', 'continuous'];

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

        {/* Reader settings group */}
        <View className="rounded-app-lg overflow-hidden bg-surface dark:bg-surface-dark">
          {/* Text Size */}
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

          <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
          <MenuPicker
            label="Line Height"
            options={lineHeightLabels}
            selectedIndex={currentLineHeightIndex >= 0 ? currentLineHeightIndex : 2}
            onSelect={(index) => {
              if (index >= 0 && index < LINE_HEIGHT_OPTIONS.length) {
                updateReadingSettings({ lineHeight: LINE_HEIGHT_OPTIONS[index] });
              }
            }}
          />
          </View>

          <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
          <MenuPicker
            label="Font Family"
            options={fontFamilyNames}
            selectedIndex={currentFontIndex >= 0 ? currentFontIndex : 0}
            onSelect={(index) => {
              if (index >= 0 && index < FONT_FAMILIES.length) {
                updateReadingSettings({ fontFamily: FONT_FAMILIES[index].value });
              }
            }}
          />
          </View>

          {/* Furigana Toggle */}
          <View
            style={{
              borderTopWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
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

          {/* Blur Images Toggle */}
          <View
            style={{
              borderTopWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              height: 44,
            }}
          >
            <Text className="text-base text-black dark:text-white">Blur Images</Text>
            <ToggleSwitch
              value={reading.blurImages}
              onValueChange={(v) => updateReadingSettings({ blurImages: v })}
              color={colors.tint}
            />
          </View>

          {/* Progress Counter Toggle */}
          <View
            style={{
              borderTopWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              height: 44,
            }}
          >
            <Text className="text-base text-black dark:text-white">Progress Counter</Text>
            <ToggleSwitch
              value={reading.showProgressIndicator}
              onValueChange={(v) => updateReadingSettings({ showProgressIndicator: v })}
              color={colors.tint}
            />
          </View>

          <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
            <MenuPicker
              label="View Mode"
              options={viewModeOptions}
              selectedIndex={currentViewModeIndex}
              onSelect={(index) => {
                if (index >= 0 && index < VIEW_MODES.length) {
                  updateReadingSettings({ viewMode: VIEW_MODES[index] });
                }
              }}
            />
          </View>

          <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
            <ThemePicker />
          </View>
        </View>

        <SectionHeader title="About" />

        <View className="rounded-app-lg overflow-hidden bg-surface dark:bg-surface-dark">
          {/* Terms */}
          <Pressable
            className="flex-row items-center justify-between px-md py-3.5"
            style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}
            onPress={() => Linking.openURL('https://gadge.to/tsundoku/changelog')}
          >
            <Text className="text-base text-black dark:text-white">Changelog</Text>
            <Text className="text-base text-text-secondary dark:text-text-secondary-dark">›</Text>
          </Pressable>

          {/* Privacy Policy */}
          <Pressable
            className="flex-row items-center justify-between px-md py-3.5"
            style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}
            onPress={() => Linking.openURL('https://gadge.to/tsundoku/privacy')}
          >
            <Text className="text-base text-black dark:text-white">Privacy Policy</Text>
            <Text className="text-base text-text-secondary dark:text-text-secondary-dark">›</Text>
          </Pressable>

          {/* Version */}
          <View
            className="flex-row items-center justify-between px-md py-3.5"
            style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}
          >
            <Text className="text-base text-black dark:text-white">Version</Text>
            <Text className="text-base text-text-secondary dark:text-text-secondary-dark">1.0.0</Text>
          </View>
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
