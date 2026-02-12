import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useBooks } from '@/contexts/BooksContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useTheme } from '@/contexts/ThemeContext';
import EpubReader from '@/components/EpubReader';
import type { EpubReaderHandle } from '@/components/EpubReader';
import ReaderControls from '@/components/ReaderControls';
import { setChapterSelectionHandler, clearChapterSelectionHandler } from '@/utils/chapterSelection';
import { setDictionaryDismissHandler, clearDictionaryDismissHandler } from '@/utils/dictionarySelection';
import { findAllMatches } from '@/utils/dictionary';
import { mediumTap } from '@/utils/haptics';
import type { ReaderLocation, WebViewToRNMessage } from '@/types/reader';

/**
 * Returns true if a hex color is "dark" (luminance < 0.5).
 */
function isDarkColor(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  // Perceived luminance formula
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance < 0.5;
}

export default function ReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getBook, updateLastRead, saveReadingProgress, removeBook } = useBooks();
  const { settings, getReadingTheme } = useSettings();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const book = getBook(id ?? '');
  const readerRef = useRef<EpubReaderHandle>(null);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<ReaderLocation>(() => ({
    chapterIndex: book?.lastChapterIndex ?? 0,
    pageNumber: book?.lastPageNumber ?? 0,
    progress: 0,
    chapterProgress: 0,
  }));
  const [totalPages, setTotalPages] = useState(1);
  const [isReady, setIsReady] = useState(false);
  const [startAtEnd, setStartAtEnd] = useState(false);

  // Per-chapter page counts for book-wide progress in paginated mode.
  // Maps chapterIndex -> totalPages for that chapter.
  const chapterPageCountsRef = useRef<Map<number, number>>(new Map());

  // Track whether this is the first load (to restore saved page)
  const isInitialLoad = useRef(true);

  // Prevent duplicate "book missing" alerts
  const hasShownMissingAlert = useRef(false);

  // Keep a ref so the stable handleMessage callback can always read the latest book
  const bookRef = useRef(book);
  bookRef.current = book;

  const readingTheme = useMemo(() => getReadingTheme(), [getReadingTheme]);
  const statusBarStyle = isDarkColor(readingTheme.backgroundColor) ? 'light' : 'dark';

  // Update last read timestamp
  useEffect(() => {
    if (id) {
      updateLastRead(id);
    }
  }, [id, updateLastRead]);

  // Save progress whenever page or chapter changes
  const saveProgressRef = useRef(saveReadingProgress);
  saveProgressRef.current = saveReadingProgress;
  useEffect(() => {
    if (!id || !isReady) return;
    saveProgressRef.current(id, currentLocation.chapterIndex, currentLocation.pageNumber);
  }, [id, isReady, currentLocation.chapterIndex, currentLocation.pageNumber]);

  // Keep a ref to settings so handleMessage can check viewMode without depending on it
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const handleMessage = useCallback(
    (message: WebViewToRNMessage) => {
      switch (message.type) {
        case 'ready':
          setIsReady(true);
          if (isInitialLoad.current) {
            isInitialLoad.current = false;
          }
          break;
        case 'pageInfo':
        case 'pageChange':
          setCurrentLocation((prev) => {
            // Record this chapter's page count for book-wide progress
            chapterPageCountsRef.current.set(prev.chapterIndex, message.totalPages);
            return {
              ...prev,
              pageNumber: message.currentPage,
              chapterProgress:
                message.totalPages > 0
                  ? message.currentPage / message.totalPages
                  : 0,
            };
          });
          setTotalPages(message.totalPages);
          break;
        case 'chapterEnd': {
          // In continuous mode (all chapters loaded), chapterEnd is not fired.
          // This only fires in paginated mode.
          const spineLen = bookRef.current?.spine.length ?? 0;
          setCurrentLocation((prev) => {
            if (prev.chapterIndex < spineLen - 1) {
              return {
                ...prev,
                chapterIndex: prev.chapterIndex + 1,
                pageNumber: 0,
                chapterProgress: 0,
              };
            }
            return prev;
          });
          setIsReady(false);
          setStartAtEnd(false);
          break;
        }
        case 'chapterStart': {
          // Only fires in paginated mode.
          setCurrentLocation((prev) => {
            if (prev.chapterIndex > 0) {
              return {
                ...prev,
                chapterIndex: prev.chapterIndex - 1,
                pageNumber: 0,
                chapterProgress: 1,
              };
            }
            return prev;
          });
          setIsReady(false);
          setStartAtEnd(true);
          break;
        }
        case 'chapterIndexUpdate':
          // Continuous mode: bridge reports which chapter section is visible.
          // Update location without triggering a content reload.
          setCurrentLocation((prev) => {
            if (prev.chapterIndex === message.chapterIndex) return prev;
            return {
              ...prev,
              chapterIndex: message.chapterIndex,
            };
          });
          break;
        case 'scrollProgress':
          // Continuous mode: bridge reports virtual page from scroll position.
          setCurrentLocation((prev) => ({
            ...prev,
            pageNumber: message.currentPage,
          }));
          setTotalPages(message.totalPages);
          break;
        case 'dictionaryLookup':
          handleDictionaryLookup(message.text, message.offset);
          break;
        case 'error':
          console.error('[ReaderScreen] WebView error:', message.message);
          if (
            (message.message?.includes('is not readable') ||
              message.message?.includes('could not be read') ||
              message.message?.includes('No such file')) &&
            !hasShownMissingAlert.current
          ) {
            hasShownMissingAlert.current = true;
            handleBookFileMissing();
          }
          break;
      }
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  /**
   * Handle a missing/corrupt book file: alert the user, remove the book, and go back.
   */
  const handleBookFileMissing = useCallback(() => {
    Alert.alert(
      'Book Unavailable',
      'This book\u2019s files could not be found. It may have been deleted or corrupted. The book will be removed from your library.',
      [
        {
          text: 'OK',
          onPress: async () => {
            if (id) {
              try {
                await removeBook(id);
              } catch (err) {
                console.error('[ReaderScreen] Failed to remove missing book:', err);
              }
            }
            router.back();
          },
        },
      ],
      { cancelable: false }
    );
  }, [id, removeBook, router]);

  /**
   * Handle a dictionary lookup request from the WebView.
   * Finds all matches, highlights the longest, and opens the dictionary
   * modal with a pager for every match.
   */
  const handleDictionaryLookup = useCallback(
    async (text: string, offset: number) => {
      try {
        // Haptic feedback immediately
        mediumTap();

        const results = await findAllMatches(text, offset);
        if (results.length === 0) {
          console.log('[ReaderScreen] No dictionary match found');
          return;
        }

        const primary = results[0];
        console.log(
          `[ReaderScreen] ${results.length} match(es), primary: "${primary.matchedTerm}" (id=${primary.entry.id})` +
            (primary.originalForm ? ` [from "${primary.originalForm}"]` : '')
        );

        // Highlight the primary (longest) match in the WebView
        readerRef.current?.highlightDictionary(primary.matchStartOffset, primary.matchLength);

        // Encode match metadata for the dictionary modal
        const matchInfo = results.map((r) => ({
          id: r.entry.id,
          term: r.matchedTerm,
          original: r.originalForm,
          rules: r.deinflectionRules,
        }));

        const route =
          `/dictionary/${encodeURIComponent(primary.matchedTerm)}` +
          `?matches=${encodeURIComponent(JSON.stringify(matchInfo))}`;

        router.push(route);
      } catch (err) {
        console.error('[ReaderScreen] Dictionary lookup error:', err);
      }
    },
    [router]
  );

  /**
   * When the dictionary modal is dismissed, leave native text selection
   * intact so the user can adjust the selection handles or copy text.
   * The selection will clear naturally when the user taps elsewhere,
   * or when a new dictionary lookup replaces it.
   */
  const handleDictionaryDismiss = useCallback(() => {
    // Intentionally no-op: preserve native selection after modal dismiss.
  }, []);

  const handleCenterTap = useCallback(() => {
    setControlsVisible((prev) => !prev);
  }, []);

  const handleDismissControls = useCallback(() => {
    setControlsVisible(false);
  }, []);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleGoToPage = useCallback((page: number) => {
    readerRef.current?.goToPage(page);
  }, []);

  const handleSelectChapter = useCallback((index: number) => {
    const isContinuous = settingsRef.current.reading.viewMode === 'continuous';

    if (isContinuous) {
      // Continuous mode: all chapters are already loaded, just scroll
      readerRef.current?.scrollToChapter(index);
      setCurrentLocation((prev) => {
        if (index === prev.chapterIndex) return prev;
        return { ...prev, chapterIndex: index, chapterProgress: 0 };
      });
    } else {
      // Paginated mode: trigger full reload
      setCurrentLocation((prev) => {
        if (index === prev.chapterIndex) return prev;
        return { ...prev, chapterIndex: index, pageNumber: 0, chapterProgress: 0 };
      });
      setIsReady(false);
      setStartAtEnd(false);
    }

    setControlsVisible(false);
  }, []);

  // Register the chapter selection handler so the chapters modal route can call it
  useEffect(() => {
    setChapterSelectionHandler(handleSelectChapter);
    return () => clearChapterSelectionHandler();
  }, [handleSelectChapter]);

  // Register the dictionary dismiss handler so the dictionary modal can clear highlights
  useEffect(() => {
    setDictionaryDismissHandler(handleDictionaryDismiss);
    return () => clearDictionaryDismissHandler();
  }, [handleDictionaryDismiss]);

  if (!book) {
    return (
      <View className="flex-1 justify-center items-center bg-white dark:bg-black">
        <Text className="text-black dark:text-white">Book not found.</Text>
      </View>
    );
  }

  return (
    // StyleSheet kept: backgroundColor is a dynamic reading theme color, not dark/light mode
    <View className="flex-1" style={{ backgroundColor: readingTheme.backgroundColor }}>
      <StatusBar style={statusBarStyle} />

      {!isReady && (
        <View
          className="absolute inset-0 justify-center items-center z-10"
        >
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      )}

      {/* StyleSheet kept: paddingTop is a dynamic safe area inset value */}
      <View className="flex-1" style={{ paddingTop: insets.top }}>
        <EpubReader
          ref={readerRef}
          book={book}
          chapterIndex={currentLocation.chapterIndex}
          settings={settings.reading}
          readingTheme={readingTheme}
          startAtEnd={startAtEnd}
          initialPage={isInitialLoad.current ? book.lastPageNumber : undefined}
          onMessage={handleMessage}
          onCenterTap={handleCenterTap}
        />
      </View>

      {/* Progress indicator - always visible at bottom-right */}
      {isReady && !controlsVisible && (() => {
        let globalPage: number;
        let globalTotal: number;

        if (settings.reading.viewMode === 'paginated') {
          // Build book-wide page numbers from per-chapter counts.
          // For chapters not yet visited, estimate using the average of known counts.
          const spineLen = book.spine.length;
          const known = chapterPageCountsRef.current;
          let knownSum = 0;
          let knownCount = 0;
          known.forEach((pages) => { knownSum += pages; knownCount++; });
          const avgPages = knownCount > 0 ? knownSum / knownCount : totalPages;

          let pagesBeforeCurrent = 0;
          for (let i = 0; i < currentLocation.chapterIndex; i++) {
            pagesBeforeCurrent += known.get(i) ?? avgPages;
          }

          globalPage = Math.round(pagesBeforeCurrent) + currentLocation.pageNumber + 1;
          globalTotal = Math.round(pagesBeforeCurrent)
            + (known.get(currentLocation.chapterIndex) ?? totalPages);
          for (let i = currentLocation.chapterIndex + 1; i < spineLen; i++) {
            globalTotal += Math.round(known.get(i) ?? avgPages);
          }
        } else {
          // Continuous mode: scrollProgress already covers the whole book
          globalPage = currentLocation.pageNumber + 1;
          globalTotal = totalPages;
        }

        const pct = globalTotal > 0
          ? Math.round((globalPage / globalTotal) * 100)
          : 0;

        return (
          <View
            className="absolute z-10"
            style={{ bottom: insets.bottom + 8, right: 12 }}
            pointerEvents="none"
          >
            <Text
              className="text-[10px] text-right"
              style={{ color: readingTheme.textColor, opacity: 0.4 }}
            >
              {globalPage}/{globalTotal}{'  '}{pct}%
            </Text>
          </View>
        );
      })()}

      <ReaderControls
        visible={controlsVisible}
        book={book}
        currentPage={currentLocation.pageNumber}
        totalPages={totalPages}
        chapterIndex={currentLocation.chapterIndex}
        viewMode={settings.reading.viewMode}
        onBack={handleBack}
        onDismiss={handleDismissControls}
        onGoToPage={handleGoToPage}
        onSelectChapter={handleSelectChapter}
      />
    </View>
  );
}
