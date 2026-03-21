/**
 * Layout constants for the book library grid and general spacing.
 *
 * Dynamic, screen-size-dependent values (numColumns, itemWidth) are
 * computed in hooks/useResponsiveGrid.ts via useWindowDimensions().
 */

/** Horizontal padding around the grid */
export const GRID_PADDING = 16;

/** Gap between grid items */
export const GRID_GAP = 12;

/** Aspect ratio for book covers (roughly standard paperback) */
export const BOOK_COVER_ASPECT_RATIO = 1.5;

/** Default page margin in the reader (px) */
export const DEFAULT_PAGE_MARGIN = 16;

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
