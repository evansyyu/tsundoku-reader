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

  /* Furigana annotations: unselectable for clean dictionary lookups */
  rt, rp {
    -webkit-user-select: none;
    user-select: none;
  }
`;

/**
 * CSS for horizontal (LTR) paginated mode.
 */
export const HORIZONTAL_PAGINATED_CSS = `
  html {
    overflow: hidden;
    height: 100vh;
    margin: 0;
    padding: 0;
  }

  body {
    margin: 0;
    padding: var(--page-margin);
    width: 100vw;
    height: 100vh;
    column-width: calc(100vw - 2 * var(--page-margin));
    column-gap: var(--column-gap);
    column-fill: auto;
    overflow-x: scroll;
    overflow-y: hidden;
    scrollbar-width: none;
    -ms-overflow-style: none;
    touch-action: none;
    orphans: 2;
    widows: 2;
  }
  body::-webkit-scrollbar { display: none; }
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
    text-orientation: mixed;
    -webkit-text-orientation: mixed;
    overflow: hidden;
    margin: 0;
    padding: 0;
  }

  body {
    margin: 0;
    padding: var(--page-margin);
    width: 100vw;
    height: 100vh;
    column-width: calc(100vh - 2 * var(--page-margin));
    column-gap: var(--column-gap);
    column-fill: auto;
    /* In vertical-rl, columns stack top-to-bottom (inline direction),
       so the overflow is VERTICAL, not horizontal. */
    overflow-x: hidden;
    overflow-y: scroll;
    scrollbar-width: none;
    -ms-overflow-style: none;
    touch-action: none;
    orphans: 2;
    widows: 2;
  }
  body::-webkit-scrollbar { display: none; }

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
`;

/**
 * CSS for continuous scroll mode (horizontal text).
 */
export const HORIZONTAL_SCROLL_CSS = `
  html {
    overflow-y: auto;
    overflow-x: hidden;
    display: block !important;
    width: 100vw;
  }

  body {
    margin: 0 !important;
    padding: var(--page-margin) !important;
    display: block !important;
    max-width: 100vw;
    width: 100vw !important;
    height: auto !important;
    min-height: auto !important;
    overflow-x: hidden !important;
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
    display: block !important;
    height: 100vh;
  }

  body {
    margin: 0 !important;
    padding: var(--page-margin) !important;
    display: block !important;
    text-align: start !important;
    min-width: 100vw;
    height: 100vh !important;
    max-height: 100vh !important;
    overflow-y: hidden !important;
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
  let pagePitch = 0; // horizontal distance between consecutive pages
  let imagesLoaded = false;

  // ── Dictionary lookup state ────────────────────────────────────
  let dictEnabled = false;
  let longPressTimer = null;
  let longPressTriggered = false;
  let touchStartX = 0;
  let touchStartY = 0;
  // The text node and offset from the last long-press (for highlighting)
  let dictTextNode = null;
  let dictTextOffset = 0;

  // ── Ruby annotation helpers ────────────────────────────────────
  /**
   * Check if a DOM node is inside a ruby annotation (<rt> or <rp>).
   */
  function isRubyAnnotation(node) {
    var p = node.parentNode;
    while (p) {
      if (p.nodeName === 'RT' || p.nodeName === 'RP') return true;
      if (p === document.body) return false;
      p = p.parentNode;
    }
    return false;
  }

  /**
   * Get text content from a DOM node, excluding ruby annotations.
   * For dictionary lookup we want only the base kanji, not furigana
   * (e.g. "陽炎" instead of "陽かげ炎ろう").
   */
  function getBaseText(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
    if (node.nodeName === 'RT' || node.nodeName === 'RP') return '';
    var text = '';
    var child = node.firstChild;
    while (child) {
      text += getBaseText(child);
      child = child.nextSibling;
    }
    return text;
  }

  /**
   * Find the nearest block-level ancestor for scoping text extraction.
   */
  function findBlockParent(node) {
    var blocks = {P:1, DIV:1, LI:1, TD:1, TH:1, SECTION:1, ARTICLE:1, BLOCKQUOTE:1, BODY:1, H1:1, H2:1, H3:1, H4:1, H5:1, H6:1};
    var p = node.parentNode;
    while (p && !blocks[p.nodeName]) {
      p = p.parentNode;
    }
    return p || document.body;
  }

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
   *
   * Key insight for vertical-rl: CSS multi-column arranges columns in the
   * INLINE direction, which is top-to-bottom for vertical-rl. So the column
   * overflow is VERTICAL (scrollHeight), not horizontal (scrollWidth).
   * We use scrollTop to navigate, not scrollLeft.
   *
   * For horizontal-tb: columns overflow horizontally as expected.
   */
  function calculatePages() {
    if (!isPaginated) {
      totalPages = 1;
      currentPage = 0;
      return;
    }

    var rootStyle = getComputedStyle(document.documentElement);
    var pm = parseFloat(rootStyle.getPropertyValue('--page-margin')) || 0;
    var gap = parseFloat(rootStyle.getPropertyValue('--column-gap')) || 0;

    var maxScroll, scrollSize, clientSize;

    if (isVertical) {
      // vertical-rl: columns overflow vertically (inline direction = top-to-bottom)
      // pagePitch = column inline-size + gap = (viewportHeight - 2*PM) + gap
      pagePitch = window.innerHeight - 2 * pm + gap;
      scrollSize = document.body.scrollHeight;
      clientSize = document.body.clientHeight;
    } else {
      // horizontal-tb: columns overflow horizontally (inline direction = left-to-right)
      // pagePitch = column inline-size + gap = (viewportWidth - 2*PM) + gap
      pagePitch = window.innerWidth - 2 * pm + gap;
      scrollSize = document.body.scrollWidth;
      clientSize = document.body.clientWidth;
    }

    maxScroll = scrollSize - clientSize;

    console.log('[Bridge] calculatePages: isVertical=' + isVertical +
      ', pagePitch=' + pagePitch +
      ', scrollSize=' + scrollSize +
      ', clientSize=' + clientSize +
      ', maxScroll=' + maxScroll);

    if (pagePitch <= 0) {
      totalPages = 1;
      return;
    }

    totalPages = maxScroll > 0 ? 1 + Math.round(maxScroll / pagePitch) : 1;
    console.log('[Bridge] totalPages=' + totalPages);
  }

  /**
   * Navigate to a specific page (does NOT cross chapter boundaries).
   */
  function goToPage(page, animate) {
    page = Math.max(0, Math.min(page, totalPages - 1));
    currentPage = page;

    if (isPaginated) {
      // Columns are on <body>. body.scrollTop/scrollLeft is handled by the
      // web rendering engine (not the UIScrollView), so it works even when
      // the React Native WebView has scrollEnabled={false}.
      var offset = page * pagePitch;

      if (isVertical) {
        // vertical-rl: columns stack top-to-bottom, scroll vertically
        document.body.scrollTop = offset;
      } else {
        // horizontal-tb: columns stack left-to-right, scroll horizontally
        document.body.scrollLeft = offset;
      }
    }

    sendPageInfo();
  }

  function nextPage() {
    if (currentPage >= totalPages - 1) {
      sendMessage({ type: 'chapterEnd' });
      return;
    }
    goToPage(currentPage + 1);
  }

  function prevPage() {
    if (currentPage <= 0) {
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

  // ── Dictionary: text extraction at touch point ──────────────
  /**
   * Get the text node and character offset at a screen coordinate.
   * Uses caretRangeFromPoint (WebKit/Blink) which works correctly
   * with vertical writing-mode.
   */
  function getTextAtPoint(x, y) {
    var range = null;
    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(x, y);
    }
    if (!range || !range.startContainer || range.startContainer.nodeType !== Node.TEXT_NODE) {
      return null;
    }
    // Ignore taps on furigana annotations — user must tap the base kanji
    if (isRubyAnnotation(range.startContainer)) {
      return null;
    }
    return { node: range.startContainer, offset: range.startOffset };
  }

  /**
   * Extract a window of surrounding text around a character offset in a
   * text node.  Returns the text and the offset of the pressed character
   * within that text.
   *
   * Uses a TreeWalker over the nearest block-level ancestor so we cross
   * inline element boundaries (e.g., adjacent <ruby> elements).
   * Ruby annotations (<rt>/<rp>) are excluded so dictionary lookups
   * see only base kanji (e.g. "陽炎" instead of "陽かげ炎ろう").
   */
  function extractSurroundingText(textNode, charOffset, windowSize) {
    windowSize = windowSize || 20;

    var walkRoot = findBlockParent(textNode);
    var walker = document.createTreeWalker(walkRoot, NodeFilter.SHOW_TEXT, null, false);

    var allText = '';
    var pressedPos = -1;
    var node;
    while ((node = walker.nextNode())) {
      if (isRubyAnnotation(node)) continue;
      var t = node.textContent || '';
      if (node === textNode) {
        pressedPos = allText.length + charOffset;
      }
      allText += t;
    }

    if (pressedPos < 0) {
      // Fallback if we couldn't locate the node
      return { text: textNode.textContent || '', offset: charOffset };
    }

    // Extract a window around the pressed character
    var start = Math.max(0, pressedPos - windowSize);
    var end = Math.min(allText.length, pressedPos + windowSize);
    var windowText = allText.slice(start, end);
    var offsetInWindow = pressedPos - start;

    return { text: windowText, offset: offsetInWindow };
  }

  // ── Dictionary: highlight / clear ──────────────────────────────
  /**
   * Highlight matched text using native browser Selection.
   *
   * Uses window.getSelection() so iOS shows native selection handles,
   * allowing the user to adjust the selection after the dictionary
   * modal is dismissed.
   *
   * startOffset & length are relative to the surrounding text sent to RN.
   * We map them back to DOM text nodes via the same TreeWalker approach
   * used in extractSurroundingText (skipping ruby annotations).
   */
  function highlightDictionary(startOffset, length) {
    clearDictionaryHighlight();

    if (!dictTextNode) return;

    try {
      // Walk text nodes in the same block scope, excluding ruby annotations
      var walkRoot = findBlockParent(dictTextNode);
      var walker = document.createTreeWalker(walkRoot, NodeFilter.SHOW_TEXT, null, false);

      var textNodes = [];
      var totalLen = 0;
      var node;
      while ((node = walker.nextNode())) {
        if (isRubyAnnotation(node)) continue;
        textNodes.push({ node: node, start: totalLen, length: node.textContent.length });
        totalLen += node.textContent.length;
      }

      // Find where dictTextNode sits in the concatenated text
      var dictNodeEntry = null;
      for (var i = 0; i < textNodes.length; i++) {
        if (textNodes[i].node === dictTextNode) {
          dictNodeEntry = textNodes[i];
          break;
        }
      }
      if (!dictNodeEntry) return;

      var pressedInConcat = dictNodeEntry.start + dictTextOffset;
      var pressedInSurrounding = dictSurroundingOffset;

      // Map highlight offsets from surrounding-text coords to concat coords
      var hlStart = pressedInConcat + (startOffset - pressedInSurrounding);
      var hlEnd = hlStart + length;
      hlStart = Math.max(0, hlStart);
      hlEnd = Math.min(totalLen, hlEnd);

      if (hlStart >= hlEnd) return;

      // Build a DOM Range spanning the matched text
      var range = document.createRange();
      var rangeStartSet = false;

      for (var j = 0; j < textNodes.length; j++) {
        var tn = textNodes[j];
        var tnEnd = tn.start + tn.length;

        if (!rangeStartSet && hlStart >= tn.start && hlStart < tnEnd) {
          range.setStart(tn.node, hlStart - tn.start);
          rangeStartSet = true;
        }

        if (rangeStartSet && hlEnd > tn.start && hlEnd <= tnEnd) {
          range.setEnd(tn.node, hlEnd - tn.start);
          break;
        } else if (rangeStartSet && hlEnd > tnEnd) {
          range.setEnd(tn.node, tn.length);
        }
      }

      // Apply as native text selection (iOS shows selection handles)
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (err) {
      console.log('[Bridge] highlightDictionary error: ' + err.message);
    }
  }

  /**
   * Clear dictionary text selection.
   */
  function clearDictionaryHighlight() {
    var sel = window.getSelection();
    if (sel) sel.removeAllRanges();
  }

  /**
   * Enable or disable dictionary long-press detection.
   */
  function setDictionaryEnabled(enabled) {
    dictEnabled = !!enabled;
    if (!dictEnabled) {
      clearDictionaryHighlight();
    }
    console.log('[Bridge] dictionary enabled:', dictEnabled);
  }

  // Store the surrounding-text offset for mapping highlights back
  var dictSurroundingOffset = 0;

  // ── Touch handling ─────────────────────────────────────────────

  // Swipe detection state (no live drag — avoids WebKit column glitches)
  var swipeHandled = false;
  var SWIPE_THRESHOLD = 30; // px horizontal to commit a page turn

  // Prevent native scrolling in paginated mode; cancel long-press on movement
  document.addEventListener('touchmove', function(e) {
    if (isPaginated) e.preventDefault();

    if (longPressTimer !== null) {
      var touch = e.touches[0];
      if (touch) {
        var dx = touch.clientX - touchStartX;
        var dy = touch.clientY - touchStartY;
        if (dx * dx + dy * dy > 100) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      }
    }
  }, { passive: false });

  // Touch start: record position, start long-press timer
  document.addEventListener('touchstart', function(e) {
    longPressTriggered = false;

    var touch = e.touches[0];
    if (!touch) return;

    touchStartX = touch.clientX;
    touchStartY = touch.clientY;

    if (!dictEnabled || e.touches.length !== 1) return;

    longPressTimer = setTimeout(function() {
      longPressTimer = null;
      longPressTriggered = true;

      var result = getTextAtPoint(touchStartX, touchStartY);
      if (!result) return;

      dictTextNode = result.node;
      dictTextOffset = result.offset;

      var extracted = extractSurroundingText(result.node, result.offset, 20);
      dictSurroundingOffset = extracted.offset;

      console.log('[Bridge] Long press: text="' + extracted.text + '", offset=' + extracted.offset);

      sendMessage({
        type: 'dictionaryLookup',
        text: extracted.text,
        offset: extracted.offset,
      });
    }, 500);
  }, { passive: true });

  // Touch end: detect swipe for paginated navigation
  document.addEventListener('touchend', function(e) {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }

    if (longPressTriggered) return;

    if (isPaginated && e.changedTouches.length > 0) {
      var touch = e.changedTouches[0];
      var dx = touch.clientX - touchStartX;
      var dy = touch.clientY - touchStartY;

      // Only count as swipe if horizontal movement dominates and exceeds threshold
      if (Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
        swipeHandled = true;

        // For Japanese RTL reading (and matching the user's expectation):
        //   swipe right (dx > 0) → next page (reading forward)
        //   swipe left  (dx < 0) → previous page (reading backward)
        if (dx > 0) {
          nextPage();
        } else {
          prevPage();
        }
      }
    }
  }, { passive: true });

  // Prevent double-tap zoom / scroll-to-top
  var lastTapTime = 0;
  document.addEventListener('touchend', function(e) {
    var now = Date.now();
    if (now - lastTapTime < 300) {
      e.preventDefault();
    }
    lastTapTime = now;
  }, { passive: false });

  /**
   * Handle taps: center tap = toggle reader controls.
   */
  document.addEventListener('click', function(e) {
    // Suppress click after long-press or swipe
    if (longPressTriggered || swipeHandled) {
      longPressTriggered = false;
      swipeHandled = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    var x = e.clientX;
    var width = window.innerWidth;
    var third = width / 3;
    var isCenterTap = (x >= third && x <= width - third);

    if (isCenterTap) {
      sendMessage({ type: 'centerTap' });
    }
  });

  // ── Continuous scroll: chapter detection ─────────────────────
  // All chapters are loaded at once in continuous mode.
  // Detect which chapter is currently visible and report to RN.

  var lastReportedChapter = -1;

  /**
   * Detect which .chapter-section is most visible and report to RN.
   */
  function detectCurrentChapter() {
    if (isPaginated) return;

    var sections = document.querySelectorAll('.chapter-section[data-chapter]');
    if (sections.length === 0) return;

    var bestIdx = 0;
    var bestVisibility = -1;
    var vpH = window.innerHeight;
    var vpW = window.innerWidth;

    for (var i = 0; i < sections.length; i++) {
      var rect = sections[i].getBoundingClientRect();
      var visible;

      if (isVertical) {
        // Vertical-rl: visibility is overlap in the X axis
        var left = Math.max(rect.left, 0);
        var right = Math.min(rect.right, vpW);
        visible = Math.max(0, right - left);
      } else {
        // Horizontal: visibility is overlap in the Y axis
        var top = Math.max(rect.top, 0);
        var bottom = Math.min(rect.bottom, vpH);
        visible = Math.max(0, bottom - top);
      }

      if (visible > bestVisibility) {
        bestVisibility = visible;
        bestIdx = parseInt(sections[i].getAttribute('data-chapter')) || 0;
      }
    }

    if (bestIdx !== lastReportedChapter) {
      lastReportedChapter = bestIdx;
      sendMessage({ type: 'chapterIndexUpdate', chapterIndex: bestIdx });
    }
  }

  /**
   * Scroll to a specific chapter section in continuous mode.
   */
  function scrollToChapter(chapterIndex, smooth) {
    var section = document.querySelector('.chapter-section[data-chapter="' + chapterIndex + '"]');
    if (!section) {
      console.log('[Bridge] scrollToChapter: section ' + chapterIndex + ' not found');
      return;
    }

    // Update reported chapter immediately to avoid bouncing
    lastReportedChapter = chapterIndex;

    section.scrollIntoView({
      behavior: smooth !== false ? 'smooth' : 'instant',
      block: isVertical ? 'nearest' : 'start',
      inline: isVertical ? 'start' : 'nearest'
    });
  }

  // Throttled scroll listener for chapter detection
  var scrollTimer = null;
  window.addEventListener('scroll', function() {
    if (isPaginated) return;
    if (scrollTimer) return;
    scrollTimer = setTimeout(function() {
      scrollTimer = null;
      detectCurrentChapter();
    }, 200);
  }, { passive: true });

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
        case 'highlightDictionary':
          highlightDictionary(cmd.startOffset, cmd.length);
          break;
        case 'clearDictionaryHighlight':
          clearDictionaryHighlight();
          break;
        case 'setDictionaryEnabled':
          setDictionaryEnabled(cmd.enabled);
          break;
        case 'scrollToChapter':
          scrollToChapter(cmd.chapterIndex, cmd.smooth);
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

        if (isFullPage && isPaginated) {
          // Full-page SVG (e.g. cover) in PAGINATED mode only:
          // disable column layout on body and center the SVG.
          // In continuous mode we never override styles because
          // all chapters share the same document.
          console.log('[Bridge] Full-page SVG detected, disabling columns');
          document.body.style.columnWidth = 'auto';
          document.body.style.columns = 'auto';
          document.body.style.overflow = 'hidden';
          document.body.style.display = 'flex';
          document.body.style.alignItems = 'center';
          document.body.style.justifyContent = 'center';
          document.body.style.width = '100vw';
          document.body.style.height = '100vh';
          document.body.style.margin = '0';
          document.body.style.padding = '0';
          if (isVertical) {
            document.body.style.writingMode = 'horizontal-tb';
          }
          // Size SVG to fit viewport
          svg.setAttribute('width', '100%');
          svg.setAttribute('height', '100%');
          svg.style.display = 'block';
          svg.style.maxWidth = '100vw';
          svg.style.maxHeight = '100vh';
        } else if (isFullPage) {
          // Continuous mode: constrain the full-page SVG within its section
          svg.setAttribute('width', '100%');
          svg.setAttribute('height', 'auto');
          svg.style.maxWidth = '100%';
          svg.style.maxHeight = '100vh';
          svg.style.display = 'block';
          svg.style.margin = '0 auto';
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
    // Dictionary lookup
    setDictionaryEnabled: setDictionaryEnabled,
    highlightDictionary: highlightDictionary,
    clearDictionaryHighlight: clearDictionaryHighlight,
    // Continuous mode: scroll to a chapter section
    scrollToChapter: scrollToChapter,
  };
})();
true; // Required for injectJavaScript
`;
