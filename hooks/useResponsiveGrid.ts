/**
 * Reactive grid layout hook for the book library.
 *
 * Computes the number of columns and maximum item width based on the
 * current window width (updates on rotation / resize). Uses
 * useWindowDimensions() so the layout is always in sync with the screen.
 */

import { useWindowDimensions } from 'react-native';

const MAX_BOOK_WIDTH = 130;

/**
 * Breakpoint-based column count targeting:
 *   iPad landscape large (>=1366): 12 books/row
 *   iPad landscape       (>=1024): 10 books/row
 *   iPad portrait        (>=768):   6 books/row
 *   Large phone landscape(>=600):   4 books/row
 *   Phone portrait       (<600):    3 books/row
 */
function getNumColumns(width: number): number {
  if (width >= 1366) return 12;
  if (width >= 1024) return 10;
  if (width >= 768) return 6;
  if (width >= 600) return 4;
  return 3;
}

export interface ResponsiveGrid {
  numColumns: number;
  itemWidth: number;
  screenWidth: number;
}

export function useResponsiveGrid(padding: number, gap: number): ResponsiveGrid {
  const { width } = useWindowDimensions();
  const numColumns = getNumColumns(width);
  const totalPadding = padding * 2 + gap * (numColumns - 1);
  const itemWidth = Math.min(MAX_BOOK_WIDTH, (width - totalPadding) / numColumns);
  return { numColumns, itemWidth, screenWidth: width };
}
