import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Layout constants for the book library grid and general spacing.
 */

/** Number of columns in the book grid */
export const GRID_COLUMNS = 3;

/** Horizontal padding around the grid */
export const GRID_PADDING = 16;

/** Gap between grid items */
export const GRID_GAP = 12;

/** Calculated width for each book card in the grid */
export const BOOK_CARD_WIDTH =
  (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

/** Aspect ratio for book covers (roughly standard paperback) */
export const BOOK_COVER_ASPECT_RATIO = 1.5;

/** Height of book cover based on card width */
export const BOOK_COVER_HEIGHT = BOOK_CARD_WIDTH * BOOK_COVER_ASPECT_RATIO;

/** Default page margin in the reader (px) */
export const DEFAULT_PAGE_MARGIN = 24;

/** Default column gap in paginated mode (px) */
export const DEFAULT_COLUMN_GAP = 40;

/** General spacing values */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** Border radius values */
export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;
