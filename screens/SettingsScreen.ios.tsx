/**
 * iOS-specific Settings Screen using SwiftUI components via @expo/ui.
 * The existing SettingsScreen.tsx serves as the Android fallback.
 *
 * Uses native SwiftUI Form with a single "Reader" section containing
 * text size, line height, font, view mode, and the reading theme picker
 * (a React Native view embedded via UIViewRepresentable).
 */
import React, { useMemo } from 'react';
import {
  Host,
  Form,
  Section,
  Picker,
  Slider,
  HStack,
  VStack,
  Text,
} from '@expo/ui/swift-ui';
import { frame } from '@expo/ui/swift-ui/modifiers';
import { useSettings } from '@/contexts/SettingsContext';
import { FONT_FAMILIES, FONT_SIZE_MAX, FONT_SIZE_MIN } from '@/constants/typography';
import { LINE_HEIGHT_OPTIONS } from '@/constants/typography';
import type { ViewMode } from '@/types/settings';
import ThemePicker from '@/components/ThemePicker';

const VIEW_MODES: ViewMode[] = ['paginated', 'continuous'];
const VIEW_MODE_LABELS = ['Paginated', 'Continuous Scroll'];

export default function SettingsScreen() {
  const { settings, updateReadingSettings } = useSettings();
  const { reading } = settings;

  const lineHeightLabels = useMemo(
    () => LINE_HEIGHT_OPTIONS.map((lh) => `${lh}x`),
    []
  );
  const currentLineHeightIndex = LINE_HEIGHT_OPTIONS.indexOf(reading.lineHeight);

  const fontFamilyNames = useMemo(
    () => FONT_FAMILIES.map((f) => f.name),
    []
  );
  const currentFontIndex = FONT_FAMILIES.findIndex((f) => f.value === reading.fontFamily);

  const viewModeIndex = VIEW_MODES.indexOf(reading.viewMode);

  // Normalize font size scale from [-3, 3] to [0, 1] for SwiftUI Slider
  const fontSizeRange = FONT_SIZE_MAX - FONT_SIZE_MIN;
  const normalizedFontSize = fontSizeRange > 0
    ? (reading.fontSizeScale - FONT_SIZE_MIN) / fontSizeRange
    : 0.5;

  const handleFontSizeChange = (normalized: number) => {
    const raw = FONT_SIZE_MIN + normalized * fontSizeRange;
    const stepped = Math.round(raw);
    const clamped = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, stepped));
    updateReadingSettings({ fontSizeScale: clamped });
  };

  return (
    <Host style={{ flex: 1 }}>
      <Form>
          <Section title="Reader">
            {/* Font Size */}
            <VStack spacing={4}>
              <Text>Font Size</Text>
              <HStack spacing={8}>
                <Text size={12}>A</Text>
                <Slider
                  value={normalizedFontSize}
                  min={0}
                  max={1}
                  steps={fontSizeRange}
                  onValueChange={handleFontSizeChange}
                />
                <Text size={22}>A</Text>
              </HStack>
            </VStack>

            {/* Line Height */}
            <Picker
              options={lineHeightLabels}
              selectedIndex={currentLineHeightIndex >= 0 ? currentLineHeightIndex : 2}
              onOptionSelected={({ nativeEvent: { index } }) => {
                if (index >= 0 && index < LINE_HEIGHT_OPTIONS.length) {
                  updateReadingSettings({ lineHeight: LINE_HEIGHT_OPTIONS[index] });
                }
              }}
              variant="menu"
              label="Line Height"
            />

            {/* Font Family */}
            <Picker
              options={fontFamilyNames}
              selectedIndex={currentFontIndex >= 0 ? currentFontIndex : 0}
              onOptionSelected={({ nativeEvent: { index } }) => {
                if (index >= 0 && index < FONT_FAMILIES.length) {
                  updateReadingSettings({ fontFamily: FONT_FAMILIES[index].value });
                }
              }}
              variant="menu"
              label="Font Family"
            />

            {/* Page View */}
            <VStack spacing={4}>
              <Text>Page View</Text>
              <Picker
                options={VIEW_MODE_LABELS}
                selectedIndex={viewModeIndex >= 0 ? viewModeIndex : 0}
                onOptionSelected={({ nativeEvent: { index } }) => {
                  if (index >= 0 && index < VIEW_MODES.length) {
                    updateReadingSettings({ viewMode: VIEW_MODES[index] });
                  }
                }}
                variant="segmented"
              />
            </VStack>

            {/* Reading Theme — React Native view embedded in SwiftUI.
               frame modifier is required because SwiftUI controls the
               UIViewRepresentable's bounds; RN layout props are ignored. */}
            <VStack modifiers={[frame({ height: 120 })]}>
              <ThemePicker />
            </VStack>
          </Section>
      </Form>
    </Host>
  );
}
