/**
 * Reader engine type definitions for WebView communication.
 */

export interface ReaderLocation {
  /** Current chapter index in the spine */
  chapterIndex: number;
  /** Current page number within the chapter (0-indexed) */
  pageNumber: number;
  /** Overall progress through the book (0.0 to 1.0) */
  progress: number;
  /** Chapter-level progress (0.0 to 1.0) */
  chapterProgress: number;
}

export interface PageInfo {
  currentPage: number;
  totalPages: number;
  chapterIndex: number;
}

/** Messages sent from WebView -> React Native */
export type WebViewToRNMessage =
  | { type: 'ready' }
  | { type: 'pageInfo'; currentPage: number; totalPages: number }
  | { type: 'pageChange'; currentPage: number; totalPages: number }
  | { type: 'chapterEnd' }
  | { type: 'chapterStart' }
  | { type: 'linkTap'; href: string }
  | { type: 'selectionChange'; text: string }
  | { type: 'contentHeight'; height: number }
  | { type: 'error'; message: string };

/** Commands sent from React Native -> WebView via injectJavaScript */
export type RNToWebViewCommand =
  | { type: 'goToPage'; page: number }
  | { type: 'nextPage' }
  | { type: 'prevPage' }
  | { type: 'setTheme'; textColor: string; backgroundColor: string }
  | {
      type: 'setTypography';
      fontSize: number;
      lineHeight: number;
      fontFamily: string;
    }
  | { type: 'setViewMode'; mode: 'paginated' | 'continuous' }
  | { type: 'getPageInfo' };

export interface TOCItem {
  /** Title of the chapter/section */
  title: string;
  /** Spine index this TOC item maps to */
  spineIndex: number;
  /** Nesting level (0 = top level) */
  level: number;
  /** Children TOC items */
  children: TOCItem[];
}

export interface BookmarkData {
  id: string;
  bookId: string;
  chapterIndex: number;
  pageNumber: number | null;
  progress: number;
  label: string | null;
  createdAt: number;
}
