/**
 * Lightweight module-level callback store for chapter selection.
 *
 * Used to bridge the route-based chapters formSheet modal back to the
 * ReaderScreen. ReaderScreen registers its handleSelectChapter handler
 * on mount; the chapters modal calls notifyChapterSelected when a
 * chapter is tapped, which invokes the registered handler.
 *
 * No React context or state — just a plain function reference.
 */

let _onSelect: ((index: number) => void) | null = null;

/** Register the chapter selection handler (called by ReaderScreen on mount). */
export function setChapterSelectionHandler(fn: (index: number) => void) {
  _onSelect = fn;
}

/** Unregister the handler (called by ReaderScreen on unmount). */
export function clearChapterSelectionHandler() {
  _onSelect = null;
}

/** Notify the registered handler that a chapter was selected (called by the chapters modal). */
export function notifyChapterSelected(index: number) {
  _onSelect?.(index);
}
