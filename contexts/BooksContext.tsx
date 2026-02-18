import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Book } from '@/types/book';
import {
  getAllBooks,
  insertBook as dbInsertBook,
  deleteBook as dbDeleteBook,
  updateBookLastRead as dbUpdateLastRead,
  updateReadingProgress as dbUpdateProgress,
} from '@/utils/database';
import { deleteBookFiles } from '@/utils/epub/metadata';

interface BooksContextValue {
  books: Book[];
  isLoading: boolean;
  /** Add a new book to the library */
  addBook: (book: Book) => void;
  /** Remove a book by ID (also deletes files) */
  removeBook: (id: string) => void;
  /** Update a book's last read timestamp */
  updateLastRead: (id: string) => void;
  /** Save reading progress for a book */
  saveReadingProgress: (id: string, chapterIndex: number, pageNumber: number, chapterProgress: number) => void;
  /** Find a book by ID */
  getBook: (id: string) => Book | undefined;
  /** Refresh books from storage */
  refreshBooks: () => Promise<void>;
}

const BooksContext = createContext<BooksContextValue | undefined>(undefined);

export function BooksProvider({ children }: { children: React.ReactNode }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load books from SQLite on mount
  useEffect(() => {
    loadBooks();
  }, []);

  async function loadBooks() {
    try {
      setIsLoading(true);
      const allBooks = await getAllBooks();
      setBooks(allBooks);
    } catch {
      // load failed silently
    } finally {
      setIsLoading(false);
    }
  }

  const addBook = useCallback((book: Book) => {
    setBooks((prev) => [book, ...prev]);
    // DB insert already handled by useBookImport
  }, []);

  const removeBook = useCallback(async (id: string) => {
    const bookToDelete = books.find((b) => b.id === id);
    setBooks((prev) => prev.filter((b) => b.id !== id));

    try {
      await dbDeleteBook(id);
      if (bookToDelete) {
        await deleteBookFiles(bookToDelete);
      }
    } catch {
      // delete failed silently
    }
  }, [books]);

  const updateLastRead = useCallback((id: string) => {
    const now = Date.now();
    setBooks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, lastReadAt: now } : b))
    );

    // Fire-and-forget DB update
    dbUpdateLastRead(id).catch(() => {});
  }, []);

  const saveReadingProgress = useCallback(
    (id: string, chapterIndex: number, pageNumber: number, chapterProgress: number) => {
      const now = Date.now();
      setBooks((prev) =>
        prev.map((b) =>
          b.id === id
            ? { ...b, lastChapterIndex: chapterIndex, lastPageNumber: pageNumber, lastChapterProgress: chapterProgress, lastReadAt: now }
            : b
        )
      );

      // Fire-and-forget DB update
      dbUpdateProgress(id, chapterIndex, pageNumber, chapterProgress).catch(() => {});
    },
    []
  );

  const getBook = useCallback(
    (id: string) => books.find((b) => b.id === id),
    [books]
  );

  const refreshBooks = useCallback(async () => {
    await loadBooks();
  }, []);

  const value = useMemo(
    () => ({
      books,
      isLoading,
      addBook,
      removeBook,
      updateLastRead,
      saveReadingProgress,
      getBook,
      refreshBooks,
    }),
    [books, isLoading, addBook, removeBook, updateLastRead, saveReadingProgress, getBook, refreshBooks]
  );

  return <BooksContext.Provider value={value}>{children}</BooksContext.Provider>;
}

export function useBooks(): BooksContextValue {
  const ctx = useContext(BooksContext);
  if (!ctx) {
    throw new Error('useBooks must be used within a BooksProvider');
  }
  return ctx;
}
