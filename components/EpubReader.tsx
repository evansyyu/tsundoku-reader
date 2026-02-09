import React, { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import type { Book } from '@/types/book';
import type { ReadingSettings, ReadingTheme } from '@/types/settings';
import type { WebViewToRNMessage } from '@/types/reader';
import { buildChapterHtml } from '@/utils/epub/css';
import { READER_BRIDGE_JS } from '@/constants/reader';
import { FONT_SIZE_SCALE } from '@/constants/typography';
import * as FileSystem from 'expo-file-system/legacy';

export interface EpubReaderHandle {
  /** Navigate to a specific page within the current chapter */
  goToPage: (page: number) => void;
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

  // Expose imperative methods to parent
  useImperativeHandle(ref, () => ({
    goToPage: (page: number) => {
      webViewRef.current?.injectJavaScript(
        `window.__readerBridge && window.__readerBridge.goToPage(${page}); true;`
      );
    },
  }));

  // Keep a ref for onMessage so the effect can use it without depending on it.
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  // Load chapter content
  useEffect(() => {
    let cancelled = false;

    async function loadChapter() {
      const spine = book.spine;
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

        const isVertical = book.language === 'ja' || book.pageProgressionDirection === 'rtl';
        const fontSize = FONT_SIZE_SCALE[settings.fontSizeScale] ?? 18;

        const html = buildChapterHtml(content, {
          isVertical,
          isPaginated: settings.viewMode === 'paginated',
          textColor: readingTheme.textColor,
          backgroundColor: readingTheme.backgroundColor,
          fontSize,
          lineHeight: settings.lineHeight,
          fontFamily: settings.fontFamily,
          pageMargin: settings.pageMargin,
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

    loadChapter();

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

        // When the bridge reports initial page info, jump to requested page
        if (data.type === 'pageInfo') {
          if (startAtEndRef.current) {
            startAtEndRef.current = false;
            if (data.totalPages > 1) {
              webViewRef.current?.injectJavaScript(
                `window.__readerBridge && window.__readerBridge.goToPage(${data.totalPages - 1}); true;`
              );
            }
          } else if (initialPageRef.current != null && initialPageRef.current > 0) {
            const page = initialPageRef.current;
            initialPageRef.current = undefined;
            webViewRef.current?.injectJavaScript(
              `window.__readerBridge && window.__readerBridge.goToPage(${page}); true;`
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

  const handleLoadEnd = useCallback(() => {
    webViewRef.current?.injectJavaScript(bridgeScriptRef.current);
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
