/**
 * Typography constants for the reader and app UI.
 */

/** Base font size in px for the reader WebView */
export const BASE_READER_FONT_SIZE = 18;

/**
 * Font size scale levels (-3 to +3).
 * Each step is roughly 2px change.
 */
export const FONT_SIZE_SCALE: Record<number, number> = {
  [-3]: 12,
  [-2]: 14,
  [-1]: 16,
  [0]: 18,
  [1]: 20,
  [2]: 22,
  [3]: 26,
};

export const FONT_SIZE_MIN = -3;
export const FONT_SIZE_MAX = 3;

/** Available line height options */
export const LINE_HEIGHT_OPTIONS = [1.2, 1.4, 1.6, 1.8, 2.0];
export const DEFAULT_LINE_HEIGHT = 1.6;

/**
 * Available font families.
 * System fonts that work across iOS.
 */
export const FONT_FAMILIES = [
  { id: 'system', name: 'System Default', value: '-apple-system, system-ui, sans-serif' },
  { id: 'serif', name: 'Serif', value: 'Georgia, "Times New Roman", serif' },
  { id: 'sans-serif', name: 'Sans Serif', value: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  // Japanese fonts
  { id: 'hiragino-mincho', name: 'Hiragino Mincho', value: '"Hiragino Mincho ProN", "Yu Mincho", serif' },
  { id: 'hiragino-sans', name: 'Hiragino Sans', value: '"Hiragino Sans", "Hiragino Kaku Gothic ProN", sans-serif' },
  { id: 'yu-gothic', name: 'Yu Gothic', value: '"YuGothic", "Yu Gothic", sans-serif' },
  { id: 'noto-serif-jp', name: 'Noto Serif JP', value: '"Noto Serif CJK JP", "Noto Serif JP", serif' },
];

export const DEFAULT_FONT_FAMILY = FONT_FAMILIES[0].value;
