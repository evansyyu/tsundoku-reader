/**
 * Color styles for word-level frequency/JLPT tags displayed
 * in the dictionary lookup modal.
 *
 * Keys are matched (case-insensitively, trimmed) against tag strings
 * from the `tags` table in the dictionary database.
 */

export interface TagStyle {
  backgroundColor: string;
  color: string;
}

export const wordTagStyles: Record<string, TagStyle> = {
  n5:     { backgroundColor: '#4ea26e', color: '#FFFFFF' },
  n4:     { backgroundColor: '#00a2b4', color: '#FFFFFF' },
  n3:     { backgroundColor: '#6293da', color: '#FFFFFF' },
  n2:     { backgroundColor: '#bc77b9', color: '#FFFFFF' },
  n1:     { backgroundColor: '#d27070', color: '#FFFFFF' },
  common: { backgroundColor: '#8abc83', color: '#FFFFFF' },
  '★':   { backgroundColor: '#1c75c3', color: '#FFFFFF' },
};

/**
 * Resolve the style for a given tag string.
 * Matches against wordTagStyles keys case-insensitively.
 * Returns undefined if no matching style exists (falls back to default chip style).
 */
export function getTagStyle(tag: string): TagStyle | undefined {
  const trimmed = tag.trim().toLowerCase();
  for (const [key, style] of Object.entries(wordTagStyles)) {
    if (trimmed === key.toLowerCase() || trimmed.includes(key.toLowerCase())) {
      return style;
    }
  }
  return undefined;
}
