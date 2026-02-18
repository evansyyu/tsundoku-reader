/**
 * SQLite database layer for books and bookmarks.
 *
 * Uses expo-sqlite's new synchronous API (SDK 54+).
 */

import * as SQLite from 'expo-sqlite';
import type { Book, BookRow } from '@/types/book';
import type { BookmarkData } from '@/types/reader';

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Open (or create) the database and run migrations.
 */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  db = await SQLite.openDatabaseAsync('tsundoku-reader.db');

  // Run migrations
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      author TEXT,
      cover_path TEXT,
      file_path TEXT NOT NULL,
      epub_path TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'en',
      spine TEXT NOT NULL DEFAULT '[]',
      page_progression_direction TEXT NOT NULL DEFAULT 'default',
      added_at INTEGER NOT NULL,
      last_read_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY NOT NULL,
      book_id TEXT NOT NULL,
      chapter_index INTEGER NOT NULL,
      page_number INTEGER,
      progress REAL NOT NULL DEFAULT 0,
      label TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_bookmarks_book_id ON bookmarks(book_id);
    CREATE INDEX IF NOT EXISTS idx_books_last_read ON books(last_read_at);
  `);

  // Migration: add reading progress columns (safe to re-run)
  try {
    await db.execAsync(`ALTER TABLE books ADD COLUMN last_chapter_index INTEGER NOT NULL DEFAULT 0`);
  } catch (_) {
    // Column already exists
  }
  try {
    await db.execAsync(`ALTER TABLE books ADD COLUMN last_page_number INTEGER NOT NULL DEFAULT 0`);
  } catch (_) {
    // Column already exists
  }
  try {
    await db.execAsync(`ALTER TABLE books ADD COLUMN original_file_name TEXT`);
  } catch (_) {
    // Column already exists
  }
  try {
    await db.execAsync(`ALTER TABLE books ADD COLUMN last_chapter_progress REAL NOT NULL DEFAULT 0`);
  } catch (_) {
    // Column already exists
  }

  return db;
}

/**
 * Get the database instance (must be initialized first).
 */
export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// ──── Books CRUD ─────────────────────────────────────────────

/**
 * Insert a new book into the database.
 */
export async function insertBook(book: Book): Promise<void> {
  const database = getDatabase();
  await database.runAsync(
    `INSERT INTO books (id, title, author, cover_path, file_path, epub_path, original_file_name, language, spine, page_progression_direction, added_at, last_read_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      book.id,
      book.title,
      book.author,
      book.coverPath,
      book.filePath,
      book.epubPath,
      book.originalFileName,
      book.language,
      JSON.stringify(book.spine),
      book.pageProgressionDirection,
      book.addedAt,
      book.lastReadAt,
    ]
  );
}

/**
 * Get all books, ordered by most recently read/added.
 */
export async function getAllBooks(): Promise<Book[]> {
  const database = getDatabase();
  const rows = await database.getAllAsync<BookRow>(
    `SELECT * FROM books ORDER BY COALESCE(last_read_at, added_at) DESC`
  );
  return rows.map(rowToBook);
}

/**
 * Get a single book by ID.
 */
export async function getBookById(id: string): Promise<Book | null> {
  const database = getDatabase();
  const row = await database.getFirstAsync<BookRow>(
    `SELECT * FROM books WHERE id = ?`,
    [id]
  );
  return row ? rowToBook(row) : null;
}

/**
 * Update the last_read_at timestamp for a book.
 */
export async function updateBookLastRead(id: string): Promise<void> {
  const database = getDatabase();
  await database.runAsync(
    `UPDATE books SET last_read_at = ? WHERE id = ?`,
    [Date.now(), id]
  );
}

/**
 * Delete a book by ID.
 */
export async function deleteBook(id: string): Promise<void> {
  const database = getDatabase();
  await database.runAsync(`DELETE FROM books WHERE id = ?`, [id]);
}

// ──── Bookmarks CRUD ─────────────────────────────────────────

/**
 * Insert a bookmark.
 */
export async function insertBookmark(bookmark: BookmarkData): Promise<void> {
  const database = getDatabase();
  await database.runAsync(
    `INSERT INTO bookmarks (id, book_id, chapter_index, page_number, progress, label, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      bookmark.id,
      bookmark.bookId,
      bookmark.chapterIndex,
      bookmark.pageNumber,
      bookmark.progress,
      bookmark.label,
      bookmark.createdAt,
    ]
  );
}

/**
 * Get all bookmarks for a book.
 */
export async function getBookmarks(bookId: string): Promise<BookmarkData[]> {
  const database = getDatabase();
  return database.getAllAsync<BookmarkData>(
    `SELECT * FROM bookmarks WHERE book_id = ? ORDER BY created_at DESC`,
    [bookId]
  );
}

/**
 * Delete a bookmark by ID.
 */
export async function deleteBookmark(id: string): Promise<void> {
  const database = getDatabase();
  await database.runAsync(`DELETE FROM bookmarks WHERE id = ?`, [id]);
}

// ──── Reading Progress ──────────────────────────────────────

/**
 * Save reading progress for a book.
 */
export async function updateReadingProgress(
  bookId: string,
  chapterIndex: number,
  pageNumber: number,
  chapterProgress: number = 0
): Promise<void> {
  const database = getDatabase();
  await database.runAsync(
    `UPDATE books SET last_chapter_index = ?, last_page_number = ?, last_chapter_progress = ?, last_read_at = ? WHERE id = ?`,
    [chapterIndex, pageNumber, chapterProgress, Date.now(), bookId]
  );
}

/**
 * Get reading progress for a book.
 */
export async function getReadingProgress(
  bookId: string
): Promise<{ chapterIndex: number; pageNumber: number; chapterProgress: number } | null> {
  const database = getDatabase();
  const row = await database.getFirstAsync<{
    last_chapter_index: number;
    last_page_number: number;
    last_chapter_progress: number;
  }>(
    `SELECT last_chapter_index, last_page_number, last_chapter_progress FROM books WHERE id = ?`,
    [bookId]
  );
  if (!row) return null;
  return {
    chapterIndex: row.last_chapter_index,
    pageNumber: row.last_page_number,
    chapterProgress: row.last_chapter_progress ?? 0,
  };
}

// ──── Helpers ────────────────────────────────────────────────

/**
 * Convert a database row to a Book object.
 */
function rowToBook(row: BookRow): Book {
  return {
    id: row.id,
    title: row.title,
    author: row.author ?? 'Unknown Author',
    coverPath: row.cover_path,
    filePath: row.file_path,
    epubPath: row.epub_path,
    originalFileName: row.original_file_name ?? '',
    language: row.language,
    spine: JSON.parse(row.spine),
    pageProgressionDirection: row.page_progression_direction as 'ltr' | 'rtl' | 'default',
    addedAt: row.added_at,
    lastReadAt: row.last_read_at,
    lastChapterIndex: row.last_chapter_index ?? 0,
    lastPageNumber: row.last_page_number ?? 0,
    lastChapterProgress: row.last_chapter_progress ?? 0,
  };
}
