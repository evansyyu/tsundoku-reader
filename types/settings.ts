/**
 * Settings and theme type definitions.
 */

export type ViewMode = 'paginated' | 'continuous';

export interface ReadingTheme {
  id: string;
  name: string;
  textColor: string;
  backgroundColor: string;
  /** Whether this is a user-created custom theme */
  isCustom: boolean;
}

export interface ReadingSettings {
  /** Font size scale: -3 to +3 (0 = default) */
  fontSizeScale: number;
  /** Line height multiplier (e.g., 1.4, 1.6, 1.8) */
  lineHeight: number;
  /** Font family name */
  fontFamily: string;
  /** Current reading theme ID */
  readingThemeId: string;
  /** View mode */
  viewMode: ViewMode;
  /** Page margin in px */
  pageMargin: number;
}

export interface AppSettings {
  /** Reading-specific settings */
  reading: ReadingSettings;
  /** User-created custom reading themes */
  customThemes: ReadingTheme[];
  /** Library display mode */
  libraryViewMode: 'grid' | 'list';
}
