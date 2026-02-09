/**
 * Storage initialization and helpers.
 *
 * MMKV: Fast synchronous KV for settings, reading positions, theme prefs.
 * SQLite: Structured storage for book metadata and bookmarks.
 */

import { createMMKV } from 'react-native-mmkv';
import type { MMKV } from 'react-native-mmkv';

/**
 * Global MMKV instance for the app.
 */
export const storage: MMKV = createMMKV({
  id: 'yomu-reader-storage',
});

/**
 * Type-safe MMKV getters/setters.
 */
export const mmkv = {
  getString: (key: string): string | undefined => storage.getString(key),
  setString: (key: string, value: string): void => storage.set(key, value),
  getBoolean: (key: string): boolean | undefined => storage.getBoolean(key),
  setBoolean: (key: string, value: boolean): void => storage.set(key, value),
  getNumber: (key: string): number | undefined => storage.getNumber(key),
  setNumber: (key: string, value: number): void => storage.set(key, value),
  delete: (key: string): void => { storage.remove(key); },

  /** Get and parse a JSON value */
  getJSON: <T>(key: string): T | undefined => {
    const raw = storage.getString(key);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  },

  /** Stringify and set a JSON value */
  setJSON: <T>(key: string, value: T): void => {
    storage.set(key, JSON.stringify(value));
  },
};
