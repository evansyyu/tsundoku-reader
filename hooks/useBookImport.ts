/**
 * Hook for importing EPUB files from the device.
 *
 * Handles the full import flow:
 * 1. Open document picker
 * 2. Validate: reject duplicate file names
 * 3. Copy EPUB to app storage, parse metadata + spine, extract files
 * 4. Insert into database
 * 5. Add to BooksContext
 */

import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useBooks } from '@/contexts/BooksContext';
import { importEpub } from '@/utils/epub/metadata';
import { insertBook } from '@/utils/database';
import { successNotification, errorNotification } from '@/utils/haptics';


interface UseBookImportResult {
  isImporting: boolean;
  error: string | null;
  importBook: () => Promise<void>;
}

export function useBookImport(): UseBookImportResult {
  const { addBook, books } = useBooks();
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importBook = useCallback(async () => {
    try {
      setIsImporting(true);
      setError(null);

      // 1. Open document picker for EPUB files
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/epub+zip',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) {
        setIsImporting(false);
        return;
      }

      const asset = result.assets[0];
      const fileName = asset.name ?? '';

      // 2. Check for duplicate file name
      if (fileName) {
        const duplicate = books.find(
          (b) => b.originalFileName.toLowerCase() === fileName.toLowerCase()
        );
        if (duplicate) {
          Alert.alert(
            'Duplicate Book',
            `A book with the file name "${fileName}" is already in your library.`
          );
          setIsImporting(false);
          return;
        }
      }

      // 3. Import: copy, parse, extract
      const book = await importEpub(asset.uri, fileName);

      // 4. Insert into database
      await insertBook(book);

      // 5. Add to in-memory state
      addBook(book);

      await successNotification();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to import EPUB';
      setError(message);
      console.error('[useBookImport] Import failed:', err);
      await errorNotification();
    } finally {
      setIsImporting(false);
    }
  }, [addBook, books]);

  return { isImporting, error, importBook };
}
