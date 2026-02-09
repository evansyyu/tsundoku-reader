/**
 * Hook for persisting and restoring reading positions via MMKV.
 */

import { useCallback, useEffect, useState } from 'react';
import { mmkv } from '@/utils/storage';
import type { ReaderLocation } from '@/types/reader';

const POSITION_KEY_PREFIX = 'reading_position:';

const DEFAULT_LOCATION: ReaderLocation = {
  chapterIndex: 0,
  pageNumber: 0,
  progress: 0,
  chapterProgress: 0,
};

interface UseReadingPositionResult {
  location: ReaderLocation;
  saveLocation: (location: ReaderLocation) => void;
  clearLocation: () => void;
}

export function useReadingPosition(bookId: string): UseReadingPositionResult {
  const key = `${POSITION_KEY_PREFIX}${bookId}`;

  const [location, setLocation] = useState<ReaderLocation>(() => {
    const saved = mmkv.getJSON<ReaderLocation>(key);
    return saved ?? DEFAULT_LOCATION;
  });

  const saveLocation = useCallback(
    (newLocation: ReaderLocation) => {
      setLocation(newLocation);
      mmkv.setJSON(key, newLocation);
    },
    [key]
  );

  const clearLocation = useCallback(() => {
    setLocation(DEFAULT_LOCATION);
    mmkv.delete(key);
  }, [key]);

  return { location, saveLocation, clearLocation };
}
