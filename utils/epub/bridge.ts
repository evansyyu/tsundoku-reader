/**
 * WebView <-> React Native bridge protocol utilities.
 *
 * Provides typed helpers for sending commands to the WebView
 * and parsing messages from the WebView.
 */

import type { WebView } from 'react-native-webview';
import type { RNToWebViewCommand, WebViewToRNMessage } from '@/types/reader';

/**
 * Send a command to the reader WebView.
 *
 * @param webViewRef - Ref to the WebView component
 * @param command - The command to send
 */
export function sendReaderCommand(
  webViewRef: React.RefObject<WebView | null>,
  command: RNToWebViewCommand
): void {
  if (!webViewRef.current) return;

  const js = buildCommandJS(command);
  webViewRef.current.injectJavaScript(js);
}

/**
 * Build JavaScript string to execute in the WebView for a given command.
 */
function buildCommandJS(command: RNToWebViewCommand): string {
  switch (command.type) {
    case 'goToPage':
      return `window.__readerBridge?.goToPage(${command.page}); true;`;

    case 'nextPage':
      return `window.__readerBridge?.nextPage(); true;`;

    case 'prevPage':
      return `window.__readerBridge?.prevPage(); true;`;

    case 'setTheme':
      return `window.__readerBridge?.setTheme('${command.textColor}', '${command.backgroundColor}'); true;`;

    case 'setTypography':
      return `window.__readerBridge?.setTypography(${command.fontSize}, ${command.lineHeight}, '${command.fontFamily}'); true;`;

    case 'setViewMode':
      // View mode changes require a full reload, so we just notify
      return `true;`;

    case 'getPageInfo':
      return `window.__readerBridge?.getPageInfo(); true;`;

    case 'highlightDictionary':
      return `window.__readerBridge?.highlightDictionary(${command.startOffset}, ${command.length}); true;`;

    case 'clearDictionaryHighlight':
      return `window.__readerBridge?.clearDictionaryHighlight(); true;`;

    case 'setDictionaryEnabled':
      return `window.__readerBridge?.setDictionaryEnabled(${command.enabled}); true;`;

    case 'setPageMargin':
      return `window.__readerBridge?.setPageMargin(${command.margin}); true;`;

    case 'setFurigana':
      return `window.__readerBridge?.setFurigana(${command.show}); true;`;

    default:
      return 'true;';
  }
}

/**
 * Parse a message received from the reader WebView.
 *
 * @param data - The raw message string from onMessage event
 * @returns Parsed message or null if invalid
 */
export function parseReaderMessage(data: string): WebViewToRNMessage | null {
  try {
    const parsed = JSON.parse(data);
    if (parsed && typeof parsed.type === 'string') {
      return parsed as WebViewToRNMessage;
    }
    return null;
  } catch {
    return null;
  }
}
