/**
 * Reader engine constants: CSS templates and pagination config.
 */

import { DEFAULT_COLUMN_GAP, DEFAULT_PAGE_MARGIN } from './layout';

/**
 * Base CSS injected into every chapter WebView.
 * Variables are replaced at runtime with actual theme/typography values.
 */
export const BASE_READER_CSS = `
  :root {
    --text-color: {{TEXT_COLOR}};
    --bg-color: {{BG_COLOR}};
    --font-size: {{FONT_SIZE}}px;
    --line-height: {{LINE_HEIGHT}};
    --font-family: {{FONT_FAMILY}};
    --page-margin: {{PAGE_MARGIN}}px;
    --column-gap: {{COLUMN_GAP}}px;
  }

  * {
    box-sizing: border-box;
    -webkit-tap-highlight-color: transparent;
  }

  html, body {
    margin: 0;
    padding: 0;
    color: var(--text-color);
    background-color: var(--bg-color);
    font-size: var(--font-size);
    line-height: var(--line-height);
    font-family: var(--font-family);
    -webkit-text-size-adjust: none;
    text-size-adjust: none;
  }

  img {
    max-width: 100% !important;
    max-height: 100vh !important;
    height: auto !important;
    width: auto !important;
    object-fit: contain !important;
    display: block;
  }

  svg {
    max-width: 100% !important;
    max-height: 100vh !important;
    height: auto !important;
  }

  a {
    color: inherit;
    text-decoration: underline;
  }
`;

/**
 * CSS for horizontal (LTR) paginated mode.
 */
export const HORIZONTAL_PAGINATED_CSS = `
  html {
    column-width: calc(100vw - 2 * var(--page-margin));
    column-gap: var(--column-gap);
    column-fill: auto;
    overflow: hidden;
    height: 100vh;
    padding: 0 var(--page-margin);
  }

  body {
    margin: 0;
    padding: var(--page-margin) 0;
    orphans: 2;
    widows: 2;
  }
`;

/**
 * CSS for vertical (RTL, Japanese) paginated mode.
 * In vertical-rl, inline direction is top-to-bottom,
 * block direction is right-to-left.
 */
export const VERTICAL_PAGINATED_CSS = `
  html {
    writing-mode: vertical-rl;
    -webkit-writing-mode: vertical-rl;
    column-width: calc(100vh - 2 * var(--page-margin));
    column-gap: var(--column-gap);
    column-fill: auto;
    overflow: hidden;
    width: 100vw;
    padding: var(--page-margin) 0;
  }

  body {
    margin: 0;
    padding: 0 var(--page-margin);
    orphans: 2;
    widows: 2;
  }

  /* Tate-chu-yoko: horizontal numbers within vertical text */
  .tcy,
  .tate-chu-yoko {
    -webkit-text-combine: horizontal;
    text-combine-upright: all;
  }

  /* Ruby (furigana) styling */
  ruby {
    ruby-position: over;
  }
  rt {
    font-size: 0.5em;
    font-weight: normal;
  }

  /* Proper text orientation for mixed content */
  html {
    text-orientation: mixed;
    -webkit-text-orientation: mixed;
  }
`;

/**
 * CSS for continuous scroll mode (horizontal text).
 */
export const HORIZONTAL_SCROLL_CSS = `
  html {
    overflow-y: auto;
    overflow-x: hidden;
  }

  body {
    margin: 0;
    padding: var(--page-margin);
    max-width: 100vw;
  }
`;

/**
 * CSS for continuous scroll mode (vertical text).
 */
export const VERTICAL_SCROLL_CSS = `
  html {
    writing-mode: vertical-rl;
    -webkit-writing-mode: vertical-rl;
    overflow-x: auto;
    overflow-y: hidden;
  }

  body {
    margin: 0;
    padding: var(--page-margin);
    min-width: 100vw;
  }

  .tcy,
  .tate-chu-yoko {
    -webkit-text-combine: horizontal;
    text-combine-upright: all;
  }

  ruby {
    ruby-position: over;
  }
  rt {
    font-size: 0.5em;
    font-weight: normal;
  }

  html {
    text-orientation: mixed;
    -webkit-text-orientation: mixed;
  }
`;

/**
 * JavaScript bridge injected into the WebView to handle
 * pagination, navigation, and communication with React Native.
 */
export const READER_BRIDGE_JS = `
(function() {
  'use strict';

  // Diagnostic: forward WebView console to RN so logs appear in Metro
  var _origLog = console.log;
  var _origErr = console.error;
  console.log = function() {
    _origLog.apply(console, arguments);
    try {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'console', level: 'log', msg: Array.prototype.slice.call(arguments).join(' ')
      }));
    } catch(e) {}
  };
  console.error = function() {
    _origErr.apply(console, arguments);
    try {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'console', level: 'error', msg: Array.prototype.slice.call(arguments).join(' ')
      }));
    } catch(e) {}
  };

  console.log('[Bridge] IIFE entered, ReactNativeWebView available:', !!window.ReactNativeWebView);

  let isVertical = false;
  // Replaced at runtime via String.replace() in EpubReader
  let isPaginated = __PAGINATED__;
  let currentPage = 0;
  let totalPages = 1;
  let imagesLoaded = false;

  /**
   * Detect if the current document uses vertical writing mode.
   */
  function detectWritingMode() {
    const style = window.getComputedStyle(document.documentElement);
    const wm = style.writingMode || style.webkitWritingMode || '';
    isVertical = wm.includes('vertical');
  }

  /**
   * Calculate total number of pages in paginated mode.
   */
  function calculatePages() {
    if (!isPaginated) {
      totalPages = 1;
      currentPage = 0;
      return;
    }

    // Columns are on <html>, but html.scrollWidth is capped to the viewport
    // in WKWebView. The child (body) reports the true content width.
    var contentWidth = document.body.scrollWidth;
    var viewportWidth = window.innerWidth;

    console.log('[Bridge] calculatePages: body.scrollWidth=' + contentWidth + ', innerWidth=' + viewportWidth);

    if (viewportWidth <= 0) {
      totalPages = 1;
      return;
    }

    totalPages = Math.max(1, Math.round(contentWidth / viewportWidth));
    console.log('[Bridge] totalPages=' + totalPages);
  }

  /**
   * Navigate to a specific page (does NOT cross chapter boundaries).
   */
  function goToPage(page) {
    page = Math.max(0, Math.min(page, totalPages - 1));
    currentPage = page;

    if (isPaginated) {
      // Use CSS transform to paginate — scrollLeft is unreliable on the
      // root element in WKWebView with CSS columns.
      var offset = page * window.innerWidth;
      if (isVertical) {
        // Vertical RTL: page 0 = rightmost (no shift).
        // Higher pages shift body rightward to reveal left columns.
        document.body.style.transform = 'translateX(' + offset + 'px)';
      } else {
        // Horizontal LTR: shift body leftward for higher pages.
        document.body.style.transform = 'translateX(' + (-offset) + 'px)';
      }
    }

    sendPageInfo();
  }

  function nextPage() {
    if (currentPage >= totalPages - 1) {
      // Already on the last page of this chapter -- ask RN to load the next chapter
      sendMessage({ type: 'chapterEnd' });
      return;
    }
    goToPage(currentPage + 1);
  }

  function prevPage() {
    if (currentPage <= 0) {
      // Already on the first page of this chapter -- ask RN to load the previous chapter
      sendMessage({ type: 'chapterStart' });
      return;
    }
    goToPage(currentPage - 1);
  }

  /**
   * Send an arbitrary message to React Native.
   */
  function sendMessage(msg) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }
  }

  /**
   * Send current page info back to React Native.
   */
  function sendPageInfo() {
    sendMessage({
      type: 'pageInfo',
      currentPage: currentPage,
      totalPages: totalPages,
    });
  }

  /**
   * Apply a theme (colors) dynamically.
   */
  function setTheme(textColor, bgColor) {
    document.documentElement.style.setProperty('--text-color', textColor);
    document.documentElement.style.setProperty('--bg-color', bgColor);
  }

  /**
   * Apply typography settings dynamically.
   */
  function setTypography(fontSize, lineHeight, fontFamily) {
    document.documentElement.style.setProperty('--font-size', fontSize + 'px');
    document.documentElement.style.setProperty('--line-height', String(lineHeight));
    document.documentElement.style.setProperty('--font-family', fontFamily);
    // Recalculate pages since font change affects layout
    requestAnimationFrame(function() {
      calculatePages();
      goToPage(currentPage);
    });
  }

  // Prevent user touch-scrolling in paginated mode.
  document.addEventListener('touchmove', function(e) {
    if (isPaginated) e.preventDefault();
  }, { passive: false });

  // Prevent double-tap zoom / scroll-to-top in all modes.
  var lastTapTime = 0;
  document.addEventListener('touchend', function(e) {
    var now = Date.now();
    if (now - lastTapTime < 300) {
      e.preventDefault(); // suppress double-tap
    }
    lastTapTime = now;
  }, { passive: false });

  /**
   * Handle taps for page navigation and center tap (reader controls).
   * In paginated mode: left 1/3 = prev, right 1/3 = next, center = controls.
   * In continuous mode: center tap = controls (no page nav).
   */
  document.addEventListener('click', function(e) {
    var x = e.clientX;
    var width = window.innerWidth;
    var third = width / 3;
    var isCenterTap = (x >= third && x <= width - third);

    // Center tap always toggles controls regardless of mode
    if (isCenterTap) {
      sendMessage({ type: 'centerTap' });
      return;
    }

    // Edge taps only navigate pages in paginated mode
    if (!isPaginated) return;

    if (isVertical) {
      // RTL: left = next, right = prev (Japanese reading direction)
      if (x < third) {
        nextPage();
      } else {
        prevPage();
      }
    } else {
      // LTR: left = prev, right = next
      if (x < third) {
        prevPage();
      } else {
        nextPage();
      }
    }
  });

  /**
   * Listen for commands from React Native.
   */
  window.addEventListener('message', function(e) {
    try {
      const cmd = JSON.parse(e.data);
      switch (cmd.type) {
        case 'goToPage':
          goToPage(cmd.page);
          break;
        case 'nextPage':
          nextPage();
          break;
        case 'prevPage':
          prevPage();
          break;
        case 'setTheme':
          setTheme(cmd.textColor, cmd.backgroundColor);
          break;
        case 'setTypography':
          setTypography(cmd.fontSize, cmd.lineHeight, cmd.fontFamily);
          break;
        case 'getPageInfo':
          sendPageInfo();
          break;
      }
    } catch (err) {
      // Ignore non-JSON messages
    }
  });

  /**
   * Normalize images and SVG wrappers to prevent stretching.
   * EPUBs often use SVG with explicit width/height attributes or
   * inline styles that override our CSS constraints.
   */
  function normalizeImages() {
    // Fix inline styles on <img> that force dimensions
    var imgs = document.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      img.removeAttribute('width');
      img.removeAttribute('height');
      img.style.maxWidth = '100%';
      img.style.maxHeight = '100vh';
      img.style.width = 'auto';
      img.style.height = 'auto';
      img.style.objectFit = 'contain';
      img.style.display = 'block';
    }

    // Fix SVG wrappers (common EPUB cover pattern:
    //   <svg width="100%" height="100%" viewBox="0 0 W H"
    //        preserveAspectRatio="none"><image .../></svg>)
    var svgs = document.querySelectorAll('svg');
    for (var j = 0; j < svgs.length; j++) {
      var svg = svgs[j];
      if (svg.getAttribute('viewBox')) {
        var origW = svg.getAttribute('width') || '';
        var origH = svg.getAttribute('height') || '';
        var isFullPage = (origW === '100%' || origH === '100%');

        // Force aspect ratio preservation (EPUBs often set "none" to stretch)
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

        if (isFullPage) {
          // Full-page SVG (e.g. cover): disable column layout and center
          console.log('[Bridge] Full-page SVG detected, disabling columns');
          document.documentElement.style.columnWidth = 'auto';
          document.documentElement.style.columns = 'auto';
          document.documentElement.style.overflow = 'hidden';
          document.documentElement.style.width = '100vw';
          document.documentElement.style.height = '100vh';
          document.documentElement.style.display = 'flex';
          document.documentElement.style.alignItems = 'center';
          document.documentElement.style.justifyContent = 'center';
          document.documentElement.style.writingMode = 'horizontal-tb';
          document.body.style.margin = '0';
          document.body.style.padding = '0';
          document.body.style.display = 'flex';
          document.body.style.alignItems = 'center';
          document.body.style.justifyContent = 'center';
          document.body.style.width = '100vw';
          document.body.style.height = '100vh';
          // Size SVG to fit viewport
          svg.setAttribute('width', '100%');
          svg.setAttribute('height', '100%');
          svg.style.display = 'block';
          svg.style.maxWidth = '100vw';
          svg.style.maxHeight = '100vh';
        } else {
          // Inline SVG: constrain to available space
          svg.removeAttribute('width');
          svg.removeAttribute('height');
          svg.style.maxWidth = '100%';
          svg.style.maxHeight = '100vh';
          svg.style.display = 'block';
          svg.style.margin = '0 auto';
        }
      }
    }
    // Note: Do NOT remove width/height from <image> elements inside SVG —
    // those are viewBox coordinates required for the image to render.
  }

  /**
   * Wait for all images to load, then recalculate pages.
   * This is critical because images change content dimensions.
   */
  function watchImages() {
    var imgs = document.querySelectorAll('img');
    if (imgs.length === 0) {
      imagesLoaded = true;
      return;
    }
    var remaining = imgs.length;
    function onImgReady() {
      remaining--;
      if (remaining <= 0) {
        imagesLoaded = true;
        requestAnimationFrame(function() {
          calculatePages();
          sendPageInfo();
        });
      }
    }
    for (var i = 0; i < imgs.length; i++) {
      if (imgs[i].complete) {
        onImgReady();
      } else {
        imgs[i].addEventListener('load', onImgReady);
        imgs[i].addEventListener('error', onImgReady);
      }
    }
  }

  /**
   * Initialize on load.
   */
  function init() {
    try {
      console.log('[Bridge] init start, isPaginated=' + isPaginated + ', readyState=' + document.readyState);
      detectWritingMode();
      console.log('[Bridge] isVertical=' + isVertical);
      normalizeImages();
      calculatePages();
      currentPage = 0;
      console.log('[Bridge] totalPages=' + totalPages + ', RNWebView=' + !!window.ReactNativeWebView);

      sendMessage({ type: 'ready' });
      sendPageInfo();
      watchImages();
      console.log('[Bridge] init complete');
    } catch (err) {
      console.error('[Bridge] init error: ' + err.message);
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    requestAnimationFrame(init);
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      requestAnimationFrame(init);
    });
  }

  // Recalculate on resize (orientation change, etc.)
  window.addEventListener('resize', function() {
    calculatePages();
    goToPage(Math.min(currentPage, totalPages - 1));
  });

  // Expose global functions for injectJavaScript calls
  window.__readerBridge = {
    goToPage: goToPage,
    nextPage: nextPage,
    prevPage: prevPage,
    setTheme: setTheme,
    setTypography: setTypography,
    getPageInfo: sendPageInfo,
    getState: function() {
      return { currentPage: currentPage, totalPages: totalPages, isVertical: isVertical };
    },
  };
})();
true; // Required for injectJavaScript
`;
