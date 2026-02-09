import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import type { AppThemeMode } from '@/types/settings';
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
  /** Resolved color scheme (never 'auto') */
  colorScheme: ColorScheme;
  /** User's theme preference */
  themeMode: AppThemeMode;
  /** Set the theme preference */
  setThemeMode: (mode: AppThemeMode) => void;
  /** Color palette for the current scheme */
  colors: ColorPalette;
  /** Whether dark mode is active */
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<AppThemeMode>('auto');

  const colorScheme: ColorScheme = useMemo(() => {
    if (themeMode === 'auto') {
      return systemScheme === 'dark' ? 'dark' : 'light';
    }
    return themeMode;
  }, [themeMode, systemScheme]);

  const colors = useMemo(() => Colors[colorScheme], [colorScheme]);
  const isDark = colorScheme === 'dark';

  const value = useMemo(
    () => ({ colorScheme, themeMode, setThemeMode, colors, isDark }),
    [colorScheme, themeMode, colors, isDark]
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
