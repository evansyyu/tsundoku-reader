import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
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
  const { getBook, updateLastRead, saveReadingProgress } = useBooks();
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

  // Track whether this is the first load (to restore saved page)
  const isInitialLoad = useRef(true);

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

  const handleMessage = useCallback(
    (message: WebViewToRNMessage) => {
      switch (message.type) {
        case 'ready':
          setIsReady(true);
          // After first load, clear the initial page flag
          if (isInitialLoad.current) {
            isInitialLoad.current = false;
          }
          break;
        case 'pageInfo':
        case 'pageChange':
          setCurrentLocation((prev) => ({
            ...prev,
            pageNumber: message.currentPage,
            chapterProgress:
              message.totalPages > 0
                ? message.currentPage / message.totalPages
                : 0,
          }));
          setTotalPages(message.totalPages);
          break;
        case 'chapterEnd': {
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
        case 'error':
          console.error('[ReaderScreen] WebView error:', message.message);
          break;
      }
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

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
    setCurrentLocation((prev) => {
      if (index === prev.chapterIndex) return prev;
      return { ...prev, chapterIndex: index, pageNumber: 0, chapterProgress: 0 };
    });
    setIsReady(false);
    setStartAtEnd(false);
    setControlsVisible(false);
  }, []);

  // Register the chapter selection handler so the chapters modal route can call it
  useEffect(() => {
    setChapterSelectionHandler(handleSelectChapter);
    return () => clearChapterSelectionHandler();
  }, [handleSelectChapter]);

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

      <ReaderControls
        visible={controlsVisible}
        book={book}
        currentPage={currentLocation.pageNumber}
        totalPages={totalPages}
        chapterIndex={currentLocation.chapterIndex}
        onBack={handleBack}
        onDismiss={handleDismissControls}
        onGoToPage={handleGoToPage}
        onSelectChapter={handleSelectChapter}
      />
    </View>
  );
}
