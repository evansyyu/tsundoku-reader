import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, BackHandler, Platform, Text, View } from 'react-native';
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
import { useReaderStatusBar } from '@/hooks/useReaderStatusBar';
import { mediumTap } from '@/utils/haptics';
import { mmkv } from '@/utils/storage';
import type { ReaderLocation, WebViewToRNMessage } from '@/types/reader';

/** MMKV key for the book currently open in the reader. */
export const ACTIVE_BOOK_KEY = 'active_reader_book_id';

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
    chapterProgress: book?.lastChapterProgress ?? 0,
  }));
  const [totalPages, setTotalPages] = useState(1);
  const [isReady, setIsReady] = useState(false);
  const [startAtEnd, setStartAtEnd] = useState(false);

  // Per-chapter page counts for book-wide progress in paginated mode.
  // Maps chapterIndex -> totalPages for that chapter.
  const chapterPageCountsRef = useRef<Map<number, number>>(new Map());

  // Prevent duplicate "book missing" alerts
  const hasShownMissingAlert = useRef(false);

  // Keep a ref so the stable handleMessage callback can always read the latest book
  const bookRef = useRef(book);
  bookRef.current = book;

  const readingTheme = useMemo(() => getReadingTheme(), [getReadingTheme]);
  const statusBarStyle = useReaderStatusBar(readingTheme);

  // Persist this book as the active reader session so the app
  // can reopen it on next launch if the user didn't leave explicitly.
  useEffect(() => {
    if (id) {
      mmkv.setString(ACTIVE_BOOK_KEY, id);
      updateLastRead(id);
    }
  }, [id, updateLastRead]);

  // Save progress whenever page, chapter, or chapter progress changes
  const saveProgressRef = useRef(saveReadingProgress);
  saveProgressRef.current = saveReadingProgress;
  useEffect(() => {
    if (!id || !isReady) return;
    saveProgressRef.current(id, currentLocation.chapterIndex, currentLocation.pageNumber, currentLocation.chapterProgress);
  }, [id, isReady, currentLocation.chapterIndex, currentLocation.pageNumber, currentLocation.chapterProgress]);

  // ANDROID_VERIFIED: BackHandler intercepts the hardware back button on Android
  // so that progress is saved and the active-reader key is cleared before exiting.
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      mmkv.delete(ACTIVE_BOOK_KEY);
      router.back();
      return true;
    });
    return () => handler.remove();
  }, [router]);

  // ANDROID_VERIFIED: AppState listener saves progress when the app goes to
  // background. On Android the OS may kill the process without unmounting
  // components, so relying on useEffect cleanup alone is insufficient.
  const currentLocationRef = useRef(currentLocation);
  currentLocationRef.current = currentLocation;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' && id && isReady) {
        const loc = currentLocationRef.current;
        saveProgressRef.current(id, loc.chapterIndex, loc.pageNumber, loc.chapterProgress);
      }
    });
    return () => sub.remove();
  }, [id, isReady]);

  // Keep a ref to settings so handleMessage can check viewMode without depending on it
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const handleMessage = useCallback(
    (message: WebViewToRNMessage) => {
      switch (message.type) {
        case 'ready':
          setIsReady(true);
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
                message.totalPages > 1
                  ? message.currentPage / (message.totalPages - 1)
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
          // Continuous mode: bridge reports which chapter section is visible
          // along with intra-chapter progress (0.0-1.0).
          setCurrentLocation((prev) => {
            if (prev.chapterIndex === message.chapterIndex && prev.chapterProgress === message.chapterProgress) return prev;
            return {
              ...prev,
              chapterIndex: message.chapterIndex,
              chapterProgress: message.chapterProgress,
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
    mmkv.delete(ACTIVE_BOOK_KEY);
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
              } catch {
                // removal failed silently
              }
            }
            router.back();
          },
        },
      ],
      { cancelable: false }
    );
  }, [id, removeBook, router]);

  // Guard against overlapping dictionary lookups / rapid modal opens
  const dictLookupInProgress = useRef(false);

  /**
   * Handle a dictionary lookup request from the WebView.
   * Finds all matches, highlights the longest, and opens the dictionary
   * modal with a pager for every match.
   */
  const handleDictionaryLookup = useCallback(
    async (text: string, offset: number) => {
      if (dictLookupInProgress.current) return;
      dictLookupInProgress.current = true;

      try {
        // Haptic feedback immediately
        mediumTap();

        const results = await findAllMatches(text, offset);
        if (results.length === 0) return;

        const primary = results[0];

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
      } catch {
        // lookup failed silently
      } finally {
        // Release guard after a short delay to prevent rapid re-triggers
        setTimeout(() => { dictLookupInProgress.current = false; }, 600);
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
    readerRef.current?.clearDictionaryHighlight();
  }, []);

  const handleCenterTap = useCallback(() => {
    setControlsVisible((prev) => !prev);
  }, []);

  const handleDismissControls = useCallback(() => {
    setControlsVisible(false);
  }, []);

  const handleBack = useCallback(() => {
    mmkv.delete(ACTIVE_BOOK_KEY);
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

  // Compute book-wide progress indicator off the render path.
  // chapterPageCountsRef is a ref (not reactive) but recalculates when
  // its dependent values (chapterIndex, pageNumber, totalPages) change.
  const progressInfo = useMemo(() => {
    if (!book) return { globalPage: 0, globalTotal: 0, pct: 0 };

    let globalPage: number;
    let globalTotal: number;

    if (settings.reading.viewMode === 'paginated') {
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
      globalPage = currentLocation.pageNumber + 1;
      globalTotal = totalPages;
    }

    const pct = globalTotal > 0
      ? Math.round((globalPage / globalTotal) * 100)
      : 0;

    return { globalPage, globalTotal, pct };
  }, [book, settings.reading.viewMode, currentLocation.chapterIndex, currentLocation.pageNumber, totalPages]);

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
          initialPage={book.lastPageNumber}
          initialChapterProgress={book.lastChapterProgress}
          onMessage={handleMessage}
          onCenterTap={handleCenterTap}
        />
      </View>

      {/* Progress indicator - visible at bottom-right when enabled */}
      {isReady && !controlsVisible && settings.reading.showProgressIndicator && (
        <View
          className="absolute z-10"
          style={{ bottom: insets.bottom + 8, right: 12 }}
          pointerEvents="none"
        >
          <Text
            className="text-[10px] text-right"
            style={{ color: readingTheme.textColor, opacity: 0.4 }}
          >
            {progressInfo.globalPage}/{progressInfo.globalTotal}{'  '}{progressInfo.pct}%
          </Text>
        </View>
      )}

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
