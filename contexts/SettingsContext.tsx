import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AppSettings, ReadingSettings, ReadingTheme } from '@/types/settings';
import { DEFAULT_READING_THEME_ID, READING_THEMES } from '@/constants/theme';
import { DEFAULT_FONT_FAMILY, DEFAULT_LINE_HEIGHT } from '@/constants/typography';
import { DEFAULT_PAGE_MARGIN } from '@/constants/layout';
import { mmkv } from '@/utils/storage';

const SETTINGS_KEY = 'app_settings';

const DEFAULT_READING_SETTINGS: ReadingSettings = {
  fontSizeScale: 0,
  lineHeight: DEFAULT_LINE_HEIGHT,
  fontFamily: DEFAULT_FONT_FAMILY,
  readingThemeId: DEFAULT_READING_THEME_ID,
  viewMode: 'paginated',
  pageMargin: DEFAULT_PAGE_MARGIN,
  showFurigana: true,
};

const DEFAULT_SETTINGS: AppSettings = {
  reading: DEFAULT_READING_SETTINGS,
  customThemes: [],
  libraryViewMode: 'grid',
};

interface SettingsContextValue {
  settings: AppSettings;
  updateReadingSettings: (partial: Partial<ReadingSettings>) => void;
  setLibraryViewMode: (mode: 'grid' | 'list') => void;
  addCustomTheme: (theme: ReadingTheme) => void;
  removeCustomTheme: (id: string) => void;
  /** Get the full reading theme object by ID */
  getReadingTheme: (id?: string) => ReadingTheme;
  /** All available themes (built-in + custom) */
  allThemes: ReadingTheme[];
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    // Load persisted settings from MMKV on init
    const saved = mmkv.getJSON<AppSettings>(SETTINGS_KEY);
    return saved ? { ...DEFAULT_SETTINGS, ...saved } : DEFAULT_SETTINGS;
  });

  // Persist settings to MMKV whenever they change
  useEffect(() => {
    mmkv.setJSON(SETTINGS_KEY, settings);
  }, [settings]);

  const updateReadingSettings = useCallback((partial: Partial<ReadingSettings>) => {
    setSettings((prev) => ({
      ...prev,
      reading: { ...prev.reading, ...partial },
    }));
  }, []);

  const setLibraryViewMode = useCallback((mode: 'grid' | 'list') => {
    setSettings((prev) => ({ ...prev, libraryViewMode: mode }));
  }, []);

  const addCustomTheme = useCallback((theme: ReadingTheme) => {
    setSettings((prev) => ({
      ...prev,
      customThemes: [...prev.customThemes.filter((t) => t.id !== theme.id), theme],
    }));
  }, []);

  const removeCustomTheme = useCallback((id: string) => {
    setSettings((prev) => ({
      ...prev,
      customThemes: prev.customThemes.filter((t) => t.id !== id),
    }));
  }, []);

  const allThemes = useMemo(
    () => [...READING_THEMES, ...settings.customThemes],
    [settings.customThemes]
  );

  const getReadingTheme = useCallback(
    (id?: string): ReadingTheme => {
      const themeId = id ?? settings.reading.readingThemeId;
      return allThemes.find((t) => t.id === themeId) ?? READING_THEMES[0];
    },
    [allThemes, settings.reading.readingThemeId]
  );

  const value = useMemo(
    () => ({
      settings,
      updateReadingSettings,
      setLibraryViewMode,
      addCustomTheme,
      removeCustomTheme,
      getReadingTheme,
      allThemes,
    }),
    [settings, updateReadingSettings, setLibraryViewMode, addCustomTheme, removeCustomTheme, getReadingTheme, allThemes]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return ctx;
}
