/**
 * Hook encapsulating the WebView reader bridge logic.
 *
 * Manages communication between React Native and the reader WebView,
 * including page navigation, theme updates, and typography changes.
 */

import { useCallback, useRef } from 'react';
import type { WebView } from 'react-native-webview';
import { sendReaderCommand } from '@/utils/epub/bridge';
import type { RNToWebViewCommand } from '@/types/reader';

export function useEpubReader() {
  const webViewRef = useRef<WebView>(null);

  const sendCommand = useCallback((command: RNToWebViewCommand) => {
    sendReaderCommand(webViewRef, command);
  }, []);

  const goToPage = useCallback(
    (page: number) => sendCommand({ type: 'goToPage', page }),
    [sendCommand]
  );

  const nextPage = useCallback(
    () => sendCommand({ type: 'nextPage' }),
    [sendCommand]
  );

  const prevPage = useCallback(
    () => sendCommand({ type: 'prevPage' }),
    [sendCommand]
  );

  const setTheme = useCallback(
    (textColor: string, backgroundColor: string) =>
      sendCommand({ type: 'setTheme', textColor, backgroundColor }),
    [sendCommand]
  );

  const setTypography = useCallback(
    (fontSize: number, lineHeight: number, fontFamily: string) =>
      sendCommand({ type: 'setTypography', fontSize, lineHeight, fontFamily }),
    [sendCommand]
  );

  const requestPageInfo = useCallback(
    () => sendCommand({ type: 'getPageInfo' }),
    [sendCommand]
  );

  return {
    webViewRef,
    goToPage,
    nextPage,
    prevPage,
    setTheme,
    setTypography,
    requestPageInfo,
  };
}
