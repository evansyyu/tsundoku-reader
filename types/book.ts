/**
 * Core book-related type definitions.
 */

export interface SpineItem {
  /** Unique ID from the OPF manifest */
  id: string;
  /** Relative href to the XHTML file within the unzipped book */
  href: string;
  /** Media type (typically 'application/xhtml+xml') */
  mediaType: string;
  /** Optional linear reading order flag */
  linear: boolean;
}

export interface BookMetadata {
  title: string;
  author: string;
  language: string;
  publisher?: string;
  description?: string;
  /** Cover image relative path within the book */
  coverHref?: string;
  /** Page progression direction from the OPF spine */
  pageProgressionDirection?: 'ltr' | 'rtl' | 'default';
}

export interface Book {
  /** UUID generated on import */
  id: string;
  title: string;
  author: string;
  /** Absolute path to extracted cover image on disk */
  coverPath: string | null;
  /** Absolute path to the unzipped book directory */
  filePath: string;
  /** Absolute path to the original .epub file */
  epubPath: string;
  /** Original file name from the device (used for duplicate detection) */
  originalFileName: string;
  /** Primary language code (e.g., 'ja', 'en') */
  language: string;
  /** JSON-serialized SpineItem[] */
  spine: SpineItem[];
  /** Page progression direction */
  pageProgressionDirection: 'ltr' | 'rtl' | 'default';
  /** Timestamp (ms since epoch) when the book was added */
  addedAt: number;
  /** Timestamp (ms since epoch) of last reading session */
  lastReadAt: number | null;
  /** Last chapter index the user was reading */
  lastChapterIndex: number;
  /** Last page number within that chapter */
  lastPageNumber: number;
  /** Progress through the last chapter (0.0 to 1.0) */
  lastChapterProgress: number;
}

export interface BookRow {
  id: string;
  title: string;
  author: string | null;
  cover_path: string | null;
  file_path: string;
  epub_path: string;
  original_file_name: string | null;
  language: string;
  spine: string;
  page_progression_direction: string;
  added_at: number;
  last_read_at: number | null;
  last_chapter_index: number;
  last_page_number: number;
  last_chapter_progress: number;
}
