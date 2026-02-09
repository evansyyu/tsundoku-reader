import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/theme';

type ColorScheme = 'light' | 'dark';

type ColorPalette = {
  text: string;
  textSecondary: string;
  background: string;
  surface: string;
  surfaceSecondary: string;
  border: string;
  tint: string;
  tintSecondary: string;
  danger: string;
  success: string;
  tabBar: string;
  tabBarBorder: string;
};

interface ThemeContextValue {
  /** Resolved color scheme — always follows the system */
  colorScheme: ColorScheme;
  /** Color palette for the current scheme */
  colors: ColorPalette;
  /** Whether dark mode is active */
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const colorScheme: ColorScheme = systemScheme === 'dark' ? 'dark' : 'light';
  const colors = useMemo(() => Colors[colorScheme], [colorScheme]);
  const isDark = colorScheme === 'dark';

  const value = useMemo(
    () => ({ colorScheme, colors, isDark }),
    [colorScheme, colors, isDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
