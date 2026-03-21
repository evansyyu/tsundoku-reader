/**
 * Hook that returns the correct StatusBar style for the reader screen.
 *
 * When a reading theme is provided, the style is derived from the theme's
 * background color (dark background -> light icons, light background -> dark icons).
 * When no theme is provided (null), falls back to the OS color scheme.
 */

import { useColorScheme } from 'react-native';
import type { StatusBarStyle } from 'expo-status-bar';
import type { ReadingTheme } from '@/types/settings';
import { isDarkColor } from '@/utils/color';

export function useReaderStatusBar(readingTheme: ReadingTheme | null): StatusBarStyle {
  const colorScheme = useColorScheme();

  if (readingTheme) {
    return isDarkColor(readingTheme.backgroundColor) ? 'light' : 'dark';
  }

  // Fallback: follow the OS appearance when not actively reading
  return colorScheme === 'dark' ? 'light' : 'dark';
}
