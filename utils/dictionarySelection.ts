/**
 * Lightweight module-level callback store for dictionary modal dismiss.
 *
 * Used to bridge the route-based dictionary formSheet modal back to the
 * ReaderScreen. ReaderScreen registers a dismiss handler on mount;
 * the dictionary modal calls notifyDictionaryDismissed when it closes,
 * which invokes the registered handler to clear highlights.
 *
 * Same pattern as chapterSelection.ts -- no React context or state,
 * just a plain function reference.
 */

let _onDismiss: (() => void) | null = null;

/** Register the dictionary dismiss handler (called by ReaderScreen on mount). */
export function setDictionaryDismissHandler(fn: () => void) {
  _onDismiss = fn;
}

/** Unregister the handler (called by ReaderScreen on unmount). */
export function clearDictionaryDismissHandler() {
  _onDismiss = null;
}

/** Notify the registered handler that the dictionary modal was dismissed. */
export function notifyDictionaryDismissed() {
  _onDismiss?.();
}
