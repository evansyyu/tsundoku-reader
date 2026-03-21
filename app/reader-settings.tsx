import React, { useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useBooks } from '@/contexts/BooksContext';
import { FONT_FAMILIES, FONT_SIZE_MAX, FONT_SIZE_MIN } from '@/constants/typography';
import { LINE_HEIGHT_OPTIONS } from '@/constants/typography';
import type { ViewMode, TextDirection } from '@/types/settings';
import Slider from '@/components/Slider';
import MenuPicker from '@/components/MenuPicker';
import ToggleSwitch from '@/components/ToggleSwitch';
import ThemePicker from '@/components/ThemePicker';

export default function ReaderSettingsModal() {
  const { bookId } = useLocalSearchParams<{ bookId?: string }>();
  const { colors } = useTheme();
  const { settings, updateReadingSettings } = useSettings();
  const { getBook } = useBooks();
  const { reading } = settings;

  const book = bookId ? getBook(bookId) : undefined;
  const isJapanese = book
    ? book.language === 'ja' || book.language.startsWith('ja-')
    : false;

  const lineHeightLabels = useMemo(
    () => LINE_HEIGHT_OPTIONS.map((lh) => `${lh}x`),
    []
  );
  const currentLineHeightIndex = LINE_HEIGHT_OPTIONS.indexOf(reading.lineHeight);

  const fontFamilyNames = useMemo(
    () => FONT_FAMILIES.map((f) => f.name),
    []
  );
  const currentFontIndex = FONT_FAMILIES.findIndex(
    (f) => f.value === reading.fontFamily
  );
  const viewModeOptions = useMemo(() => ['Paginated', 'Continuous Scroll'], []);
  const currentViewModeIndex = reading.viewMode === 'paginated' ? 0 : 1;
  const VIEW_MODES: ViewMode[] = ['paginated', 'continuous'];
  const textDirectionOptions = useMemo(() => ['Vertical', 'Horizontal'], []);
  const currentTextDirectionIndex = reading.japaneseTextDirection === 'vertical' ? 0 : 1;
  const TEXT_DIRECTIONS: TextDirection[] = ['vertical', 'horizontal'];

  return (
    <View collapsable={false} style={{ flex: 1 }}>
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      scrollToOverflowEnabled
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}
      showsVerticalScrollIndicator={false}
    >
      <SectionHeader title="Reader" />

      {/* Text Size */}
      <View className="rounded-app-lg overflow-hidden bg-surface dark:bg-surface-dark">
        <View className="flex-col items-center pt-sm">
          <Text className="text-xl text-black dark:text-white">Font Size</Text>
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

        {/* Font Family */}
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
          <Text className="text-lg text-black dark:text-white">Furigana</Text>
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
          <Text className="text-lg text-black dark:text-white">Blur Images</Text>
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
          <Text className="text-lg text-black dark:text-white">Progress Counter</Text>
          <ToggleSwitch
            value={reading.showProgressIndicator}
            onValueChange={(v) => updateReadingSettings({ showProgressIndicator: v })}
            color={colors.tint}
          />
        </View>

        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
          <MenuPicker
            label="Page View"
            options={viewModeOptions}
            selectedIndex={currentViewModeIndex}
            onSelect={(index) => {
              if (index >= 0 && index < VIEW_MODES.length) {
                updateReadingSettings({ viewMode: VIEW_MODES[index] });
              }
            }}
          />
        </View>

        {isJapanese && (
          <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
            <MenuPicker
              label="Text Direction"
              options={textDirectionOptions}
              selectedIndex={currentTextDirectionIndex}
              onSelect={(index) => {
                if (index >= 0 && index < TEXT_DIRECTIONS.length) {
                  updateReadingSettings({ japaneseTextDirection: TEXT_DIRECTIONS[index] });
                }
              }}
            />
          </View>
        )}

        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
          <ThemePicker />
        </View>
      </View>

      <View className="h-xxl" />
    </ScrollView>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-[13px] font-semibold uppercase tracking-wider mt-lg mb-sm ml-xs text-black dark:text-white">
      {title}
    </Text>
  );
}
