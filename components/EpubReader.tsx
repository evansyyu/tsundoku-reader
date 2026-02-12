import React, { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import type { Book } from '@/types/book';
import type { ReadingSettings, ReadingTheme } from '@/types/settings';
import type { WebViewToRNMessage } from '@/types/reader';
import { buildChapterHtml, buildContinuousHtml } from '@/utils/epub/css';
import { READER_BRIDGE_JS } from '@/constants/reader';
import { FONT_SIZE_SCALE } from '@/constants/typography';
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

  // Track whether continuous mode content is already loaded (all chapters at once)
  const continuousLoadedBookId = useRef<string | null>(null);
  // Fingerprint of settings+theme used for the current continuous build.
  // When this changes we must rebuild even if the book ID hasn't changed.
  const continuousSettingsFingerprint = useRef<string | null>(null);
  // Track the last chapter index we know about to avoid unnecessary scrollToChapter calls
  // when the bridge reports chapterIndexUpdate (which already reflects the current scroll).
  const lastKnownChapterRef = useRef(chapterIndex);

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


  // Load chapter content
  useEffect(() => {
    let cancelled = false;

    const isContinuous = settings.viewMode === 'continuous';
    const isVertical = book.language === 'ja' || book.pageProgressionDirection === 'rtl';
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
    };

    // Build a fingerprint from all values that affect the rendered HTML so we
    // can detect when continuous mode needs a full rebuild (not just a scroll).
    const fingerprint = JSON.stringify(commonOpts);

    async function loadContent() {
      const spine = book.spine;

      if (isContinuous) {
        // ── Continuous mode: load ALL chapters at once ──
        // If already loaded for this book AND settings haven't changed,
        // only scroll if the chapter changed from a user action.
        if (
          continuousLoadedBookId.current === book.id &&
          continuousSettingsFingerprint.current === fingerprint
        ) {
          if (chapterIndex !== lastKnownChapterRef.current) {
            console.log(`[EpubReader] Continuous already loaded, scrolling to ch ${chapterIndex}`);
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

        console.log(`[EpubReader] Loading all ${spine.length} chapters for continuous mode`);
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
          // Queue scroll to the initial chapter after the WebView loads
          if (chapterIndex > 0) {
            pendingScrollChapterRef.current = chapterIndex;
          }
          setHtmlContent(html);
          setBaseUrl(`${book.filePath}/`);
          continuousLoadedBookId.current = book.id;
          continuousSettingsFingerprint.current = fingerprint;
        } catch (error) {
          console.error('[EpubReader] Failed to load chapters:', error);
          onMessageRef.current({
            type: 'error',
            message: `Failed to load chapters: ${error}`,
          });
        }
      } else {
        // ── Paginated mode: load single chapter ──
        continuousLoadedBookId.current = null;
        continuousSettingsFingerprint.current = null;

        console.log(`[EpubReader] loadChapter called: chapterIndex=${chapterIndex}, spineLength=${spine.length}`);
        if (chapterIndex < 0 || chapterIndex >= spine.length) {
          console.warn(`[EpubReader] chapterIndex ${chapterIndex} out of range`);
          return;
        }

        const spineItem = spine[chapterIndex];
        const chapterPath = `${book.filePath}/${spineItem.href}`;

        try {
          const content = await FileSystem.readAsStringAsync(chapterPath, {
            encoding: FileSystem.EncodingType.UTF8,
          });

          if (cancelled) return;

          const html = buildChapterHtml(content, {
            ...commonOpts,
            isPaginated: true,
          });

          setHtmlContent(html);

          const lastSlash = chapterPath.lastIndexOf('/');
          const newBaseUrl = chapterPath.substring(0, lastSlash + 1);
          setBaseUrl(newBaseUrl);
        } catch (error) {
          console.error('[EpubReader] Failed to load chapter:', error);
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

  // Keep startAtEndRef in sync with prop
  useEffect(() => {
    startAtEndRef.current = startAtEnd;
  }, [startAtEnd]);

  // Keep initialPageRef in sync with prop
  useEffect(() => {
    initialPageRef.current = initialPage;
  }, [initialPage]);

  const handleWebViewMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);

        // Forward WebView console logs to Metro for debugging
        if (data.type === 'console') {
          const prefix = data.level === 'error' ? 'ERROR' : 'LOG';
          console.log(`[WebView ${prefix}] ${data.msg}`);
          return;
        }

        if (data.type === 'centerTap') {
          onCenterTap();
          return;
        }

        // When the bridge reports which chapter is visible, update our ref
        // so the loadContent effect knows not to inject an unnecessary scroll.
        if (data.type === 'chapterIndexUpdate') {
          lastKnownChapterRef.current = data.chapterIndex;
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
          } else if (initialPageRef.current != null && initialPageRef.current > 0) {
            const page = initialPageRef.current;
            initialPageRef.current = undefined;
            webViewRef.current?.injectJavaScript(
              `window.__readerBridge && window.__readerBridge.goToPage(${page}, false); true;`
            );
          }
        }

        onMessage(data);
      } catch (err) {
        console.warn('[EpubReader] Failed to parse WebView message:', err);
      }
    },
    [onMessage, onCenterTap]
  );

  // Keep bridge script in a ref so the onLoadEnd callback can use the latest version
  const bridgeScriptRef = useRef('');
  bridgeScriptRef.current = READER_BRIDGE_JS.replace('__PAGINATED__', String(settings.viewMode === 'paginated'));

  // Track whether dictionary should be enabled for this book
  const isJapanese = book.language === 'ja' || book.language.startsWith('ja-');

  // Track the initial chapter to scroll to when continuous mode first loads
  const pendingScrollChapterRef = useRef<number | null>(null);

  const handleLoadEnd = useCallback(() => {
    webViewRef.current?.injectJavaScript(bridgeScriptRef.current);
    // Enable dictionary lookup for Japanese books after bridge init
    if (isJapanese) {
      setTimeout(() => {
        webViewRef.current?.injectJavaScript(
          `window.__readerBridge && window.__readerBridge.setDictionaryEnabled(true); true;`
        );
      }, 100);
    }

    // In continuous mode, scroll to the requested chapter after the bridge initializes
    if (pendingScrollChapterRef.current != null && pendingScrollChapterRef.current > 0) {
      const ch = pendingScrollChapterRef.current;
      pendingScrollChapterRef.current = null;
      setTimeout(() => {
        webViewRef.current?.injectJavaScript(
          `window.__readerBridge && window.__readerBridge.scrollToChapter(${ch}, false); true;`
        );
      }, 150);
    }

    onMessage({ type: 'ready' });
  }, [onMessage, isJapanese]);

  if (!htmlContent) {
    return <View className="flex-1" />;
  }

  return (
    <View className="flex-1">
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent, baseUrl }}
        className="flex-1 bg-transparent"
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled={false}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        scrollEnabled={settings.viewMode === 'continuous'}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        onMessage={handleWebViewMessage}
        onLoadEnd={handleLoadEnd}
        onShouldStartLoadWithRequest={(request) => {
          return request.url.startsWith('file://') || request.url === 'about:blank';
        }}
      />
    </View>
  );
});

export default memo(EpubReader);
