import React, { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import type { Book } from '@/types/book';
import type { ReadingSettings, ReadingTheme } from '@/types/settings';
import type { WebViewToRNMessage } from '@/types/reader';
import { buildChapterHtml, buildContinuousHtml } from '@/utils/epub/css';
import { READER_BRIDGE_JS } from '@/constants/reader';
import { FONT_SIZE_SCALE } from '@/constants/typography';
// TODO: migrate to expo-file-system (non-legacy) when upgrading to SDK 55+
import * as FileSystem from 'expo-file-system/legacy';

export interface EpubReaderHandle {
  /** Navigate to a specific page within the current chapter */
  goToPage: (page: number) => void;
  /** Highlight matched dictionary text in the WebView */
  highlightDictionary: (startOffset: number, length: number) => void;
  /** Clear dictionary highlight from the WebView */
  clearDictionaryHighlight: () => void;
  /** Scroll to a specific chapter section in continuous mode */
  scrollToChapter: (chapterIndex: number, smooth?: boolean) => void;
}

interface EpubReaderProps {
  book: Book;
  chapterIndex: number;
  settings: ReadingSettings;
  readingTheme: ReadingTheme;
  /** When true, navigate to the last page after the chapter loads */
  startAtEnd?: boolean;
  /** Navigate to a specific page once the chapter loads (for restoring progress) */
  initialPage?: number;
  /** Fraction (0.0-1.0) through the chapter for cross-mode position restoration */
  initialChapterProgress?: number;
  /** Live chapter progress from ReaderScreen state (used for position guard on settings change) */
  currentChapterProgress?: number;
  onMessage: (message: WebViewToRNMessage) => void;
  onCenterTap: () => void;
}

/**
 * Core EPUB reader component.
 *
 * Loads chapter XHTML into a WebView with injected CSS for
 * pagination, theming, and vertical text support.
 * Communicates with React Native via postMessage bridge.
 */
const EpubReader = forwardRef<EpubReaderHandle, EpubReaderProps>(function EpubReader(
  {
    book,
    chapterIndex,
    settings,
    readingTheme,
    startAtEnd = false,
    initialPage,
    initialChapterProgress,
    currentChapterProgress,
    onMessage,
    onCenterTap,
  },
  ref
) {
  const webViewRef = useRef<WebView>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState<string>('');
  const startAtEndRef = useRef(startAtEnd);
  const initialPageRef = useRef(initialPage);
  const initialChapterProgressRef = useRef(initialChapterProgress);

  // Track whether continuous mode content is already loaded (all chapters at once)
  const continuousLoadedBookId = useRef<string | null>(null);
  // Structural fingerprint: settings that require full HTML rebuild (writing mode, blur, etc.)
  const continuousStructuralFP = useRef<string | null>(null);
  // Styling fingerprint: CSS-only settings that can be applied via bridge commands
  const continuousStylingFP = useRef<string | null>(null);
  // Track the last chapter index we know about to avoid unnecessary scrollToChapter calls
  // when the bridge reports chapterIndexUpdate (which already reflects the current scroll).
  const lastKnownChapterRef = useRef(chapterIndex);
  // Pending position restore for structural rebuilds in continuous mode.
  // Set before rebuild, consumed when bridge sends 'ready'.
  const pendingPositionRestoreRef = useRef<{ chapterIndex: number; progress: number } | null>(null);
  // LINK NAV: Track whether the initial HTML has been loaded into the WebView.
  // After initial load, all navigations are blocked to prevent raw XHTML loading.
  const initialLoadCompleteRef = useRef(false);

  // Cache for adjacent chapter content (paginated mode pre-read)
  const chapterCacheRef = useRef<Map<number, string>>(new Map());

  // Expose imperative methods to parent
  useImperativeHandle(ref, () => ({
    goToPage: (page: number) => {
      webViewRef.current?.injectJavaScript(
        `window.__readerBridge && window.__readerBridge.goToPage(${page}); true;`
      );
    },
    highlightDictionary: (startOffset: number, length: number) => {
      webViewRef.current?.injectJavaScript(
        `window.__readerBridge && window.__readerBridge.highlightDictionary(${startOffset}, ${length}); true;`
      );
    },
    clearDictionaryHighlight: () => {
      webViewRef.current?.injectJavaScript(
        `window.__readerBridge && window.__readerBridge.clearDictionaryHighlight(); true;`
      );
    },
    scrollToChapter: (chapterIndex: number, smooth?: boolean) => {
      webViewRef.current?.injectJavaScript(
        `window.__readerBridge && window.__readerBridge.scrollToChapter(${chapterIndex}, ${smooth !== false}); true;`
      );
    },
  }));

  // Keep a ref for onMessage so the effect can use it without depending on it.
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const isJapanese = book.language === 'ja' || book.language.startsWith('ja-');

  // Memoize bridge script to avoid rebuilding the ~1300-line string every render.
  // Placeholders are resolved once per meaningful parameter change.
  const bridgeScript = useMemo(() => {
    return READER_BRIDGE_JS
      .replace('__PAGINATED__', String(settings.viewMode === 'paginated'))
      .replace('__BLUR_IMAGES__', String(settings.blurImages))
      .replace('__DICT_ENABLED__', String(isJapanese));
  }, [settings.viewMode, settings.blurImages, isJapanese]);

  // Keep a ref so the WebView prop always has the latest version
  const bridgeScriptRef = useRef(bridgeScript);
  bridgeScriptRef.current = bridgeScript;

  /**
   * Pre-read adjacent chapters for paginated mode so chapter transitions
   * don't wait for disk I/O. Runs non-blocking after the current chapter loads.
   */
  function preReadAdjacentChapters(bookPath: string, spine: Book['spine'], currentIdx: number) {
    const toPreRead = [currentIdx - 1, currentIdx + 1].filter(
      (i) => i >= 0 && i < spine.length && !chapterCacheRef.current.has(i)
    );

    for (const idx of toPreRead) {
      const path = `${bookPath}/${spine[idx].href}`;
      FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.UTF8 })
        .then((content) => {
          chapterCacheRef.current.set(idx, content);
        })
        .catch(() => {});
    }
  }

  // Keep live progress accessible to the effect without adding it as a dependency
  const currentChapterProgressRef = useRef(currentChapterProgress ?? 0);
  currentChapterProgressRef.current = currentChapterProgress ?? 0;

  // Load chapter content
  useEffect(() => {
    let cancelled = false;

    // Reset navigation guard so the WebView accepts the new HTML source.
    // Without this, onShouldStartLoadWithRequest may block the load after
    // a link tap or settings change sets initialLoadCompleteRef to true.
    initialLoadCompleteRef.current = false;

    const isContinuous = settings.viewMode === 'continuous';
    const isJapaneseBook = book.language === 'ja' || book.language.startsWith('ja-');
    const isVertical = isJapaneseBook
      ? settings.japaneseTextDirection !== 'horizontal'
      : book.pageProgressionDirection === 'rtl';
    const fontSize = FONT_SIZE_SCALE[settings.fontSizeScale] ?? 18;

    const commonOpts = {
      isVertical,
      textColor: readingTheme.textColor,
      backgroundColor: readingTheme.backgroundColor,
      fontSize,
      lineHeight: settings.lineHeight,
      fontFamily: settings.fontFamily,
      pageMargin: settings.pageMargin,
      showFurigana: settings.showFurigana,
      blurImages: settings.blurImages,
    };

    // Structural fingerprint: changes that require full HTML rebuild
    const structuralFP = JSON.stringify({
      isVertical,
      blurImages: settings.blurImages,
    });

    // Styling fingerprint: CSS-only changes that can be applied via bridge commands
    const stylingFP = JSON.stringify({
      textColor: readingTheme.textColor,
      backgroundColor: readingTheme.backgroundColor,
      fontSize,
      lineHeight: settings.lineHeight,
      fontFamily: settings.fontFamily,
      pageMargin: settings.pageMargin,
      showFurigana: settings.showFurigana,
    });

    async function loadContent() {
      const spine = book.spine;

      // currentChapterProgressRef always reflects the latest position: it starts
      // from the saved progress (via initial state in ReaderScreen) and is updated
      // in real-time by pageInfo / chapterIndexUpdate bridge messages.
      initialChapterProgressRef.current = currentChapterProgressRef.current;

      if (isContinuous) {
        // ── Continuous mode: load ALL chapters at once ──
        if (continuousLoadedBookId.current === book.id) {
          // Book is already loaded. Check what changed.
          if (continuousStructuralFP.current === structuralFP) {
            // CSS variable changes (theme, font, margin) are applied via bridge
            // commands which preserve scroll position (no full rebuild needed).
            if (continuousStylingFP.current !== stylingFP) {
              const wv = webViewRef.current;
              if (wv) {
                wv.injectJavaScript(
                  `window.__readerBridge && window.__readerBridge.setTheme('${readingTheme.textColor}', '${readingTheme.backgroundColor}'); true;`
                );
                wv.injectJavaScript(
                  `window.__readerBridge && window.__readerBridge.setTypography(${fontSize}, ${settings.lineHeight}, '${settings.fontFamily}'); true;`
                );
                wv.injectJavaScript(
                  `window.__readerBridge && window.__readerBridge.setPageMargin(${settings.pageMargin}); true;`
                );
                wv.injectJavaScript(
                  `window.__readerBridge && window.__readerBridge.setFurigana(${settings.showFurigana}); true;`
                );
              }
              continuousStylingFP.current = stylingFP;
            }

            // Handle chapter scroll from TOC selection
            if (chapterIndex !== lastKnownChapterRef.current) {
              lastKnownChapterRef.current = chapterIndex;
              setTimeout(() => {
                webViewRef.current?.injectJavaScript(
                  `window.__readerBridge && window.__readerBridge.scrollToChapter(${chapterIndex}, true); true;`
                );
              }, 50);
            }
            // Tell parent we're ready immediately (content is already in WebView)
            onMessageRef.current({ type: 'ready' });
            return;
          }
        }

        // Full (re)build: structural change or first load.
        // Capture position so we can restore after the WebView reloads.
        pendingPositionRestoreRef.current = {
          chapterIndex,
          progress: currentChapterProgressRef.current,
        };

        try {
          const allContents: string[] = [];
          for (const item of spine) {
            const path = `${book.filePath}/${item.href}`;
            const content = await FileSystem.readAsStringAsync(path, {
              encoding: FileSystem.EncodingType.UTF8,
            });
            if (cancelled) return;
            allContents.push(content);
          }

          const chapterHrefs = spine.map((item) => item.href);
          const html = buildContinuousHtml(allContents, chapterHrefs, commonOpts);

          setHtmlContent(html);
          setBaseUrl(`${book.filePath}/`);
          continuousLoadedBookId.current = book.id;
          continuousStructuralFP.current = structuralFP;
          continuousStylingFP.current = stylingFP;
        } catch (error) {
          onMessageRef.current({
            type: 'error',
            message: `Failed to load chapters: ${error}`,
          });
        }
      } else {
        // ── Paginated mode: load single chapter ──
        continuousLoadedBookId.current = null;
        continuousStructuralFP.current = null;
        continuousStylingFP.current = null;

        if (chapterIndex < 0 || chapterIndex >= spine.length) {
          return;
        }

        const spineItem = spine[chapterIndex];
        const chapterPath = `${book.filePath}/${spineItem.href}`;

        try {
          // Use pre-read cache if available, otherwise read from disk
          const cached = chapterCacheRef.current.get(chapterIndex);
          const content = cached ?? await FileSystem.readAsStringAsync(chapterPath, {
            encoding: FileSystem.EncodingType.UTF8,
          });

          if (cancelled) return;

          // Clear used cache entry
          if (cached) chapterCacheRef.current.delete(chapterIndex);

          const html = buildChapterHtml(content, {
            ...commonOpts,
            isPaginated: true,
          });

          setHtmlContent(html);

          const lastSlash = chapterPath.lastIndexOf('/');
          const newBaseUrl = chapterPath.substring(0, lastSlash + 1);
          setBaseUrl(newBaseUrl);

          // Pre-read adjacent chapters in background for faster navigation
          preReadAdjacentChapters(book.filePath, spine, chapterIndex);
        } catch (error) {
          onMessageRef.current({
            type: 'error',
            message: `Failed to load chapter: ${error}`,
          });
        }
      }
    }

    loadContent();

    return () => {
      cancelled = true;
    };
  }, [book, chapterIndex, settings, readingTheme]);

  // Clear chapter cache when the book changes
  useEffect(() => {
    chapterCacheRef.current.clear();
  }, [book.id]);

  // Keep startAtEndRef in sync with prop
  useEffect(() => {
    startAtEndRef.current = startAtEnd;
  }, [startAtEnd]);

  const handleWebViewMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);

        if (data.type === 'centerTap') {
          onCenterTap();
          return;
        }

        // When the bridge reports which chapter is visible, update our ref
        // so the loadContent effect knows not to inject an unnecessary scroll.
        if (data.type === 'chapterIndexUpdate') {
          lastKnownChapterRef.current = data.chapterIndex;
        }

        // Position restore after structural rebuild in continuous mode.
        // The bridge has initialized; now scroll to the captured position.
        if (data.type === 'ready' && pendingPositionRestoreRef.current) {
          const restore = pendingPositionRestoreRef.current;
          pendingPositionRestoreRef.current = null;
          setTimeout(() => {
            webViewRef.current?.injectJavaScript(
              `window.__readerBridge && window.__readerBridge.scrollToChapterWithProgress(${restore.chapterIndex}, ${restore.progress}); true;`
            );
          }, 50);
        }

        // When the bridge reports initial page info, jump to requested page (no animation)
        if (data.type === 'pageInfo') {
          if (startAtEndRef.current) {
            startAtEndRef.current = false;
            if (data.totalPages > 1) {
              webViewRef.current?.injectJavaScript(
                `window.__readerBridge && window.__readerBridge.goToPage(${data.totalPages - 1}, false); true;`
              );
            }
          } else if (initialChapterProgressRef.current != null && initialChapterProgressRef.current > 0) {
            // Restore from chapterProgress (works across mode switches)
            const page = Math.floor(initialChapterProgressRef.current * (data.totalPages - 1));
            initialChapterProgressRef.current = undefined;
            initialPageRef.current = undefined;
            if (page > 0) {
              webViewRef.current?.injectJavaScript(
                `window.__readerBridge && window.__readerBridge.goToPage(${page}, false); true;`
              );
            }
          } else if (initialPageRef.current != null && initialPageRef.current > 0) {
            const page = initialPageRef.current;
            initialPageRef.current = undefined;
            webViewRef.current?.injectJavaScript(
              `window.__readerBridge && window.__readerBridge.goToPage(${page}, false); true;`
            );
          }
        }

        onMessage(data);
      } catch {
        // ignore non-JSON messages
      }
    },
    [onMessage, onCenterTap]
  );

  const handleLoadStart = useCallback(() => {
    initialLoadCompleteRef.current = false;
  }, []);

  // Lightweight onLoadEnd: bridge is injected via the injectedJavaScript prop,
  // so we only notify the parent that the WebView is ready.
  const handleLoadEnd = useCallback(() => {
    initialLoadCompleteRef.current = true;
    onMessage({ type: 'ready' });
  }, [onMessage]);

  if (!htmlContent) {
    return <View className="flex-1" />;
  }

  return (
    <View className="flex-1">
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent, baseUrl }}
        // ANDROID_VERIFIED: injectedJavaScript runs after page load on both
        // iOS (WKWebView) and Android (Chromium WebView).
        injectedJavaScript={bridgeScriptRef.current}
        className="flex-1 bg-transparent"
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled={false}
        // ANDROID_VERIFIED: file access props are supported on Android WebView
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        scrollEnabled={settings.viewMode === 'continuous'}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        onMessage={handleWebViewMessage}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onShouldStartLoadWithRequest={(request) => {
          // LINK NAV: After the initial HTML load, block all navigations.
          // In-book links are intercepted by the bridge JS click handler and
          // routed through React Native's chapter loader instead.
          if (initialLoadCompleteRef.current) {
            return false;
          }
          return request.url.startsWith('file://') || request.url === 'about:blank';
        }}
      />
    </View>
  );
});

export default memo(EpubReader);
