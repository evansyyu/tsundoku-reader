/**
 * EPUB metadata extraction helpers.
 *
 * Higher-level functions that combine parsing + file extraction
 * for the book import flow.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { parseEpub, extractEpubFiles } from './parser';
import type { Book } from '@/types/book';

/** Directory where epub source files are stored */
export const EPUBS_DIR = `${FileSystem.documentDirectory}epubs/`;

/** Directory where extracted book files are stored */
export const BOOKS_DIR = `${FileSystem.documentDirectory}books/`;

/**
 * Ensure the storage directories exist.
 */
export async function ensureStorageDirs(): Promise<void> {
  await FileSystem.makeDirectoryAsync(EPUBS_DIR, { intermediates: true });
  await FileSystem.makeDirectoryAsync(BOOKS_DIR, { intermediates: true });
}

/**
 * Import an EPUB file: copy, parse, extract, and return a Book object.
 *
 * @param sourceUri - The URI from the document picker (may be a cache URI)
 * @returns A fully populated Book object ready for storage
 */
export async function importEpub(sourceUri: string): Promise<Book> {
  await ensureStorageDirs();

  const bookId = Crypto.randomUUID();

  // 1. Copy EPUB to our epubs directory
  const epubPath = `${EPUBS_DIR}${bookId}.epub`;
  await FileSystem.copyAsync({ from: sourceUri, to: epubPath });

  // 2. Parse the EPUB
  const parsed = await parseEpub(epubPath);

  // 3. Extract all files to the books directory
  const bookDir = `${BOOKS_DIR}${bookId}/`;
  await FileSystem.makeDirectoryAsync(bookDir, { intermediates: true });
  await extractEpubFiles(parsed.zip, bookDir);

  // 4. Extract cover image if available
  let coverPath: string | null = null;
  if (parsed.metadata.coverHref) {
    const coverSrc = `${bookDir}${parsed.basePath}${parsed.metadata.coverHref}`;
    const coverInfo = await FileSystem.getInfoAsync(coverSrc);
    if (coverInfo.exists) {
      coverPath = coverSrc;
    }
  }

  // 5. Determine page progression direction
  const ppd = parsed.metadata.pageProgressionDirection ?? 'default';
  // If language is Japanese and direction is default, assume RTL
  const effectivePpd =
    ppd === 'default' && parsed.metadata.language.startsWith('ja') ? 'rtl' : ppd;

  // 6. Build the Book object
  const book: Book = {
    id: bookId,
    title: parsed.metadata.title,
    author: parsed.metadata.author,
    coverPath,
    filePath: bookDir + parsed.basePath,
    epubPath,
    language: parsed.metadata.language,
    spine: parsed.spine,
    pageProgressionDirection: effectivePpd as 'ltr' | 'rtl' | 'default',
    addedAt: Date.now(),
    lastReadAt: null,
    lastChapterIndex: 0,
    lastPageNumber: 0,
  };

  return book;
}

/**
 * Delete a book's files from disk.
 *
 * @param book - The book to delete
 */
export async function deleteBookFiles(book: Book): Promise<void> {
  // Delete extracted book directory
  const bookDir = `${BOOKS_DIR}${book.id}/`;
  const dirInfo = await FileSystem.getInfoAsync(bookDir);
  if (dirInfo.exists) {
    await FileSystem.deleteAsync(bookDir, { idempotent: true });
  }

  // Delete original epub file
  const epubInfo = await FileSystem.getInfoAsync(book.epubPath);
  if (epubInfo.exists) {
    await FileSystem.deleteAsync(book.epubPath, { idempotent: true });
  }
}
