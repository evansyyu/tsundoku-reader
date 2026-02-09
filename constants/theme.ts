import type { ReadingTheme } from '@/types/settings';

/**
 * App-wide color palette following Apple HIG.
 */
export const Colors = {
  light: {
    text: '#000000',
    textSecondary: '#6B7280',
    background: '#FFFFFF',
    surface: '#F2F2F7',
    surfaceSecondary: '#E5E5EA',
    border: '#C7C7CC',
    tint: '#007AFF',
    tintSecondary: '#5856D6',
    danger: '#FF3B30',
    success: '#34C759',
    tabBar: '#F8F8F8',
    tabBarBorder: '#D1D1D6',
  },
  dark: {
    text: '#FFFFFF',
    textSecondary: '#9CA3AF',
    background: '#000000',
    surface: '#1C1C1E',
    surfaceSecondary: '#2C2C2E',
    border: '#38383A',
    tint: '#0A84FF',
    tintSecondary: '#5E5CE6',
    danger: '#FF453A',
    success: '#30D158',
    tabBar: '#1C1C1E',
    tabBarBorder: '#38383A',
  },
} as const;

/**
 * Built-in reading themes.
 */
export const READING_THEMES: ReadingTheme[] = [
  {
    id: 'light',
    name: 'Light',
    textColor: '#000000',
    backgroundColor: '#FFFFFF',
    isCustom: false,
  },
  {
    id: 'dark',
    name: 'Dark',
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    isCustom: false,
  },
  {
    id: 'sepia',
    name: 'Sepia',
    textColor: '#000000',
    backgroundColor: '#F4ECD8',
    isCustom: false,
  },
  {
    id: 'gray-on-black',
    name: 'Gray on Black',
    textColor: '#999999',
    backgroundColor: '#000000',
    isCustom: false,
  },
  {
    id: 'warm-dark',
    name: 'Warm Dark',
    textColor: '#D4C5A9',
    backgroundColor: '#1A1A2E',
    isCustom: false,
  },
];

export const DEFAULT_READING_THEME_ID = 'light';
