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

  p, li, dd, dt, td, th, figcaption, blockquote {
    text-align: left !important;
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
    text-orientation: mixed;
    -webkit-text-orientation: mixed;
    overflow: hidden;
    margin: 0;
    padding: 0;
  }

  body {
    margin: 0;
    padding: var(--page-margin) var(--page-margin) var(--page-margin) 0;
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
    text-align: left !important;
  }

  p, li, dd, dt, td, th, figcaption, blockquote {
    text-align: left !important;
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
 * CSS for blurred images (spoiler prevention).
 * Images are wrapped in a `.blur-wrapper` by the bridge JS.
 */
export const BLUR_IMAGES_CSS = `
  .blur-wrapper {
    position: relative;
    display: block;
    max-width: 100%;
    overflow: hidden;
  }
  .blur-wrapper img {
    display: block !important;
    transition: filter 0.3s ease;
  }
  .blur-wrapper.blurred img {
    filter: blur(20px);
    -webkit-filter: blur(20px);
  }
  .blur-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #FFFFFF;
    background: rgba(0, 0, 0, 0.4);
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 28px;
    font-weight: 600;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.3s ease;
    z-index: 1;
    white-space: nowrap;
  }
  .blur-wrapper.blurred .blur-overlay {
    opacity: 1;
  }
`;

/**
 * JavaScript bridge injected into the WebView to handle
 * pagination, navigation, and communication with React Native.
 */
export const READER_BRIDGE_JS = `
(function() {
  'use strict';

  let isVertical = false;
  // Replaced at runtime via String.replace() in EpubReader
  let isPaginated = __PAGINATED__;
  let blurImages = __BLUR_IMAGES__;
  let initDictEnabled = __DICT_ENABLED__;
  let currentPage = 0;
  let totalPages = 1;
  let pagePitch = 0; // horizontal distance between consecutive pages
  let imagesLoaded = false;

  // ── Dictionary lookup state ────────────────────────────────────
  let dictEnabled = false;
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
   * ANDROID_VERIFIED: CSS multi-column (column-width, column-gap, column-fill)
   * and body.scrollLeft/scrollTop manipulation work in Android WebView (Chromium).
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

    if (pagePitch <= 0) {
      totalPages = 1;
      return;
    }

    totalPages = maxScroll > 0 ? 1 + Math.round(maxScroll / pagePitch) : 1;
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
      releaseTurnLock();
      sendMessage({ type: 'chapterEnd' });
      return;
    }
    goToPage(currentPage + 1);
  }

  function prevPage() {
    if (currentPage <= 0) {
      releaseTurnLock();
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
   * In continuous mode, captures and restores scroll position around the
   * re-layout so the user doesn't lose their place.
   */
  function setTypography(fontSize, lineHeight, fontFamily) {
    // ROOT CAUSE: CSS variable changes trigger full re-layout in the WebView
    // engine. In continuous mode this resets scrollTop/scrollLeft to 0.
    // We capture the position of the element at viewport center before the
    // change and restore it after the layout settles.
    var restoreInfo = null;
    if (!isPaginated) {
      restoreInfo = captureScrollPosition();
    }

    document.documentElement.style.setProperty('--font-size', fontSize + 'px');
    document.documentElement.style.setProperty('--line-height', String(lineHeight));
    document.documentElement.style.setProperty('--font-family', fontFamily);

    requestAnimationFrame(function() {
      if (isPaginated) {
        calculatePages();
        goToPage(currentPage);
      } else if (restoreInfo) {
        restoreScrollPosition(restoreInfo);
      }
    });
  }

  /**
   * Apply page margin dynamically.
   */
  function setPageMargin(margin) {
    var restoreInfo = null;
    if (!isPaginated) {
      restoreInfo = captureScrollPosition();
    }

    document.documentElement.style.setProperty('--page-margin', margin + 'px');

    requestAnimationFrame(function() {
      if (isPaginated) {
        calculatePages();
        goToPage(currentPage);
      } else if (restoreInfo) {
        restoreScrollPosition(restoreInfo);
      }
    });
  }

  /**
   * Toggle furigana visibility via CSS without full HTML rebuild.
   */
  function setFurigana(show) {
    var restoreInfo = null;
    if (!isPaginated) {
      restoreInfo = captureScrollPosition();
    }

    var rts = document.querySelectorAll('rt');
    var rps = document.querySelectorAll('rp');
    var display = show ? '' : 'none';
    for (var i = 0; i < rts.length; i++) rts[i].style.display = display;
    for (var j = 0; j < rps.length; j++) rps[j].style.display = display;

    requestAnimationFrame(function() {
      if (isPaginated) {
        calculatePages();
        goToPage(currentPage);
      } else if (restoreInfo) {
        restoreScrollPosition(restoreInfo);
      }
    });
  }

  // ── Position capture/restore for settings changes (continuous mode) ──
  /**
   * Capture the element at the center of the viewport and its fractional
   * offset, so we can restore the scroll position after a re-layout.
   */
  function captureScrollPosition() {
    var scrollEl = document.scrollingElement || document.documentElement;
    var vpCenterX = window.innerWidth / 2;
    var vpCenterY = window.innerHeight / 2;

    // Find the chapter section at center
    var sections = document.querySelectorAll('.chapter-section[data-chapter]');
    var bestIdx = 0;
    var bestSection = sections.length > 0 ? sections[0] : null;
    var bestDist = Infinity;

    for (var i = 0; i < sections.length; i++) {
      var rect = sections[i].getBoundingClientRect();
      var cX = (rect.left + rect.right) / 2;
      var cY = (rect.top + rect.bottom) / 2;
      var d = Math.abs(cX - vpCenterX) + Math.abs(cY - vpCenterY);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = parseInt(sections[i].getAttribute('data-chapter')) || 0;
        bestSection = sections[i];
      }
    }

    if (!bestSection) {
      return { scrollTop: scrollEl.scrollTop, scrollLeft: scrollEl.scrollLeft, mode: 'raw' };
    }

    // Fractional position within this chapter section
    var r = bestSection.getBoundingClientRect();
    var progress;
    if (isVertical) {
      progress = r.width > 0 ? Math.max(0, Math.min(1, (r.right - window.innerWidth) / r.width)) : 0;
    } else {
      progress = r.height > 0 ? Math.max(0, Math.min(1, -r.top / r.height)) : 0;
    }

    return { chapterIndex: bestIdx, progress: progress, mode: 'chapter' };
  }

  /**
   * Restore scroll position from a previously captured snapshot.
   */
  function restoreScrollPosition(info) {
    if (info.mode === 'chapter') {
      scrollToChapterWithProgress(info.chapterIndex, info.progress);
    } else {
      var scrollEl = document.scrollingElement || document.documentElement;
      scrollEl.scrollTop = info.scrollTop;
      scrollEl.scrollLeft = info.scrollLeft;
    }
  }

  // ── Dictionary: text extraction at touch point ──────────────
  /**
   * Get the text node and character offset at a screen coordinate.
   * Uses caretRangeFromPoint (WebKit/Blink) which works correctly
   * with vertical writing-mode.
   * ANDROID_VERIFIED: caretRangeFromPoint is available in Android WebView (Chromium).
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

    // Verify the touch actually hit text, not empty space.
    // caretRangeFromPoint snaps to the nearest caret even from margins/gaps,
    // so we check the character bounding rect against the touch point.
    try {
      var textLen = (range.startContainer.textContent || '').length;
      if (textLen === 0) return null;
      var off = range.startOffset;
      var charRange = document.createRange();
      if (off < textLen) {
        charRange.setStart(range.startContainer, off);
        charRange.setEnd(range.startContainer, off + 1);
      } else if (off > 0) {
        charRange.setStart(range.startContainer, off - 1);
        charRange.setEnd(range.startContainer, off);
      } else {
        return null;
      }
      var rects = charRange.getClientRects();
      if (rects.length > 0) {
        var cr = rects[0];
        var tol = 10;
        if (x < cr.left - tol || x > cr.right + tol ||
            y < cr.top - tol || y > cr.bottom + tol) {
          return null;
        }
      }
    } catch(e) {
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
   * ANDROID_VERIFIED: window.getSelection().addRange() works in Chromium WebView.
   * Android shows its own selection handles (visually different from iOS, functionally equivalent).
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
      // highlight failed silently
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
  }

  // Store the surrounding-text offset for mapping highlights back
  var dictSurroundingOffset = 0;

  // ── Touch handling ─────────────────────────────────────────────
  // ANDROID_VERIFIED: touchstart/touchmove/touchend/click events are standard DOM.
  // { passive: false } + preventDefault() patterns work in Android WebView.

  // Swipe detection state (no live drag — avoids WebKit column glitches)
  var swipeHandled = false;
  var SWIPE_THRESHOLD = 30; // px horizontal to commit a page turn
  var SWIPE_MAX_DURATION_MS = 600; // reject gestures longer than this (holds, not swipes)

  // Page-turn lock: prevents a single gesture from dispatching multiple turns,
  // and prevents rapid successive swipes from causing oscillation.
  var isTurning = false;
  var isTurningTimer = null;
  var turnLockSafetyTimer = null;
  var TURN_LOCK_MS = 400; // settle time after a page turn
  var TURN_LOCK_SAFETY_MS = 1500; // hard ceiling so lock never gets permanently stuck

  // Track the primary touch to prevent multi-touch confusion
  var activeTouchId = null;
  var swipeStartTime = 0;

  function acquireTurnLock() {
    isTurning = true;
    if (isTurningTimer) clearTimeout(isTurningTimer);
    if (turnLockSafetyTimer) clearTimeout(turnLockSafetyTimer);
    isTurningTimer = setTimeout(releaseTurnLock, TURN_LOCK_MS);
    turnLockSafetyTimer = setTimeout(releaseTurnLock, TURN_LOCK_SAFETY_MS);
  }

  function releaseTurnLock() {
    isTurning = false;
    if (isTurningTimer) { clearTimeout(isTurningTimer); isTurningTimer = null; }
    if (turnLockSafetyTimer) { clearTimeout(turnLockSafetyTimer); turnLockSafetyTimer = null; }
  }

  // Prevent native scrolling in paginated mode
  document.addEventListener('touchmove', function(e) {
    if (isPaginated) e.preventDefault();
  }, { passive: false });

  // Touch start: record the primary finger for swipe detection
  document.addEventListener('touchstart', function(e) {
    // Ignore multi-touch — only the first finger drives the swipe
    if (e.touches.length > 1) { activeTouchId = null; return; }

    var touch = e.touches[0];
    if (!touch) return;

    activeTouchId = touch.identifier;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    swipeStartTime = Date.now();
  }, { passive: true });

  // Touch end: detect swipe for paginated navigation.
  // Only processes the same finger that started the gesture.
  // Rejects multi-touch and long-press gestures.
  document.addEventListener('touchend', function(e) {
    if (!isPaginated || isTurning || activeTouchId === null) {
      activeTouchId = null;
      return;
    }

    // Find the touch matching the tracked finger
    var touch = null;
    for (var i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId) {
        touch = e.changedTouches[i];
        break;
      }
    }
    activeTouchId = null;
    if (!touch) return;

    // Reject long gestures (likely a hold/drag, not a swipe)
    if (Date.now() - swipeStartTime > SWIPE_MAX_DURATION_MS) return;

    var dx = touch.clientX - touchStartX;
    var dy = touch.clientY - touchStartY;

    if (Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      swipeHandled = true;
      acquireTurnLock();

      if (isVertical) {
        if (dx > 0) { nextPage(); } else { prevPage(); }
      } else {
        if (dx < 0) { nextPage(); } else { prevPage(); }
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

  // Cooldown to prevent rapid-fire dictionary lookups / multiple modals
  var lastDictLookupTime = 0;
  var DICT_COOLDOWN_MS = 800;

  /**
   * Handle taps: tap on text = dictionary lookup (takes priority);
   * tap on non-text in center = toggle reader controls
   */
  document.addEventListener('click', function(e) {
    // Suppress click after swipe
    if (swipeHandled) {
      swipeHandled = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Dictionary lookup on text takes priority over center-tap
    if (dictEnabled) {
      // Suppress if finger moved significantly (scroll/swipe gesture)
      var dx = e.clientX - touchStartX;
      var dy = e.clientY - touchStartY;
      if (dx * dx + dy * dy > 100) {
        // Finger moved — treat as scroll/swipe, fall through to center-tap
      } else {
        // Enforce cooldown to prevent multiple modals
        var now = Date.now();
        if (now - lastDictLookupTime < DICT_COOLDOWN_MS) return;

        var result = getTextAtPoint(e.clientX, e.clientY);
        if (result) {
          lastDictLookupTime = now;
          dictTextNode = result.node;
          dictTextOffset = result.offset;

          var extracted = extractSurroundingText(result.node, result.offset, 20);
          dictSurroundingOffset = extracted.offset;

          sendMessage({
            type: 'dictionaryLookup',
            text: extracted.text,
            offset: extracted.offset,
          });
          return;
        }
      }
    }

    // Center-tap: toggle reader controls
    var x = e.clientX;
    var width = window.innerWidth;
    var third = width / 3;
    var isCenterTap = (x >= third && x <= width - third);

    if (isCenterTap) {
      sendMessage({ type: 'centerTap' });
    }
  });

  // ── LINK NAV: Intercept internal book links ──────────────────
  // Prevent native WebView navigation for in-book links. Instead, extract the
  // resolved href and send it to React Native so the chapter can be loaded with
  // proper CSS/JS injection. Fragment-only links (#id) are left as default
  // browser behavior (scroll within the same page).
  document.addEventListener('click', function(e) {
    var target = e.target;
    // Walk up to find the nearest <a> ancestor
    while (target && target !== document.body) {
      if (target.nodeName === 'A') break;
      target = target.parentNode;
    }
    if (!target || target.nodeName !== 'A') return;

    var href = target.getAttribute('href');
    if (!href) return;

    // Skip fragment-only links (same-page anchors)
    if (href.charAt(0) === '#') return;

    // Skip external URLs
    if (/^(?:https?:|mailto:|tel:)/i.test(href)) {
      e.preventDefault();
      return;
    }

    // LINK NAV: Internal book link — prevent native navigation and route through RN
    e.preventDefault();
    e.stopPropagation();

    // Strip any fragment part and resolve the path
    var hashIdx = href.indexOf('#');
    var pathPart = hashIdx >= 0 ? href.substring(0, hashIdx) : href;

    sendMessage({
      type: 'linkTap',
      href: pathPart,
    });
  }, true); // useCapture=true to intercept before other click handlers

  // ── Continuous scroll: progress & chapter detection ──────────
  // All chapters are loaded at once in continuous mode.
  // Detect which chapter is currently visible and report scroll progress to RN.

  var lastReportedChapter = -1;
  var lastReportedScrollPage = -1;
  var lastReportedChapterProgress = -1;

  /**
   * Detect which .chapter-section is most visible and report to RN,
   * including intra-chapter progress (0.0-1.0).
   */
  function detectCurrentChapter() {
    if (isPaginated) return;

    var sections = document.querySelectorAll('.chapter-section[data-chapter]');
    if (sections.length === 0) return;

    var bestIdx = 0;
    var bestVisibility = -1;
    var bestSection = sections[0];
    var vpH = window.innerHeight;
    var vpW = window.innerWidth;

    for (var i = 0; i < sections.length; i++) {
      var rect = sections[i].getBoundingClientRect();
      var visible;

      if (isVertical) {
        var left = Math.max(rect.left, 0);
        var right = Math.min(rect.right, vpW);
        visible = Math.max(0, right - left);
      } else {
        var top = Math.max(rect.top, 0);
        var bottom = Math.min(rect.bottom, vpH);
        visible = Math.max(0, bottom - top);
      }

      if (visible > bestVisibility) {
        bestVisibility = visible;
        bestIdx = parseInt(sections[i].getAttribute('data-chapter')) || 0;
        bestSection = sections[i];
      }
    }

    // Compute progress within the visible chapter (0.0-1.0)
    var chapterProgress = 0;
    if (bestSection) {
      var r = bestSection.getBoundingClientRect();
      if (isVertical) {
        // vertical-rl: reading progresses right-to-left.
        // As the user scrolls left, the section moves right relative to the
        // viewport, so rect.right exceeds vpW by the amount already read.
        var sectionW = r.width;
        if (sectionW > 0) {
          chapterProgress = Math.max(0, Math.min(1, (r.right - vpW) / sectionW));
        }
      } else {
        // horizontal-tb: reading progresses top-to-bottom.
        // As the section scrolls above the viewport, rect.top becomes negative.
        var sectionH = r.height;
        if (sectionH > 0) {
          chapterProgress = Math.max(0, Math.min(1, -r.top / sectionH));
        }
      }
    }

    // Round to 4 decimal places to reduce noise
    var roundedProgress = Math.round(chapterProgress * 10000) / 10000;

    if (bestIdx !== lastReportedChapter || roundedProgress !== lastReportedChapterProgress) {
      lastReportedChapter = bestIdx;
      lastReportedChapterProgress = roundedProgress;
      sendMessage({ type: 'chapterIndexUpdate', chapterIndex: bestIdx, chapterProgress: roundedProgress });
    }
  }

  /**
   * Report virtual page progress for continuous mode based on scroll position.
   */
  function reportScrollProgress() {
    if (isPaginated) return;

    var scrollEl = document.scrollingElement || document.documentElement;
    var scrollPos, scrollTotal, viewportSize;

    if (isVertical) {
      // vertical-rl: content scrolls horizontally (right-to-left)
      // scrollLeft is 0 at the start (rightmost) and negative as you scroll left
      scrollPos = Math.abs(scrollEl.scrollLeft);
      scrollTotal = scrollEl.scrollWidth;
      viewportSize = window.innerWidth;
    } else {
      // horizontal-tb: content scrolls vertically
      scrollPos = scrollEl.scrollTop;
      scrollTotal = scrollEl.scrollHeight;
      viewportSize = window.innerHeight;
    }

    var maxScroll = scrollTotal - viewportSize;
    if (maxScroll <= 0 || viewportSize <= 0) {
      if (lastReportedScrollPage !== 0) {
        lastReportedScrollPage = 0;
        sendMessage({ type: 'scrollProgress', currentPage: 0, totalPages: 1 });
      }
      return;
    }

    var vTotalPages = Math.max(1, Math.round(maxScroll / viewportSize) + 1);
    var vCurrentPage = Math.min(Math.round(scrollPos / viewportSize), vTotalPages - 1);

    if (vCurrentPage !== lastReportedScrollPage) {
      lastReportedScrollPage = vCurrentPage;
      sendMessage({ type: 'scrollProgress', currentPage: vCurrentPage, totalPages: vTotalPages });
    }
  }

  /**
   * Scroll to a specific chapter section in continuous mode.
   * In vertical-rl, block='start' aligns the section's right edge (reading start)
   * with the viewport's right edge.
   */
  function scrollToChapter(chapterIndex, smooth) {
    var section = document.querySelector('.chapter-section[data-chapter="' + chapterIndex + '"]');
    if (!section) return;

    // Update reported chapter immediately to avoid bouncing
    lastReportedChapter = chapterIndex;

    section.scrollIntoView({
      behavior: smooth !== false ? 'smooth' : 'instant',
      block: 'start',
      inline: 'start'
    });
  }

  /**
   * Scroll to a specific position within a chapter section.
   * progress is 0.0 (chapter start) to 1.0 (chapter end).
   */
  function scrollToChapterWithProgress(chapterIndex, progress) {
    var section = document.querySelector('.chapter-section[data-chapter="' + chapterIndex + '"]');
    if (!section) return;

    lastReportedChapter = chapterIndex;

    if (!progress || progress <= 0) {
      section.scrollIntoView({ behavior: 'instant', block: 'start', inline: 'start' });
      return;
    }

    var scrollEl = document.scrollingElement || document.documentElement;

    if (isVertical) {
      // vertical-rl: scroll to the section's reading-start (right edge),
      // then offset leftward by progress * sectionWidth.
      section.scrollIntoView({ behavior: 'instant', block: 'start', inline: 'start' });
      var offset = progress * section.offsetWidth;
      scrollEl.scrollLeft -= offset;
    } else {
      // horizontal-tb: scroll to section top, then offset downward.
      var targetScroll = section.offsetTop + progress * section.offsetHeight;
      scrollEl.scrollTo({ top: targetScroll, behavior: 'instant' });
    }
  }

  // Throttled scroll listener for chapter detection + progress
  var scrollTimer = null;
  window.addEventListener('scroll', function() {
    if (isPaginated) return;
    if (scrollTimer) return;
    scrollTimer = setTimeout(function() {
      scrollTimer = null;
      detectCurrentChapter();
      reportScrollProgress();
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
        case 'setPageMargin':
          setPageMargin(cmd.margin);
          break;
        case 'setFurigana':
          setFurigana(cmd.show);
          break;
        case 'scrollToChapter':
          scrollToChapter(cmd.chapterIndex, cmd.smooth);
          break;
        case 'scrollToChapterWithProgress':
          scrollToChapterWithProgress(cmd.chapterIndex, cmd.progress);
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
   * Sample an image's average brightness (0-255) via an offscreen canvas.
   * Calls back with the perceived luminance value.
   */
  function getImageBrightness(img, callback) {
    try {
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      var w = Math.min(img.naturalWidth || 50, 50);
      var h = Math.min(img.naturalHeight || 50, 50);
      if (w <= 0 || h <= 0) { callback(128); return; }
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      var data = ctx.getImageData(0, 0, w, h).data;
      var sum = 0;
      var count = 0;
      for (var p = 0; p < data.length; p += 16) {
        sum += 0.299 * data[p] + 0.587 * data[p+1] + 0.114 * data[p+2];
        count++;
      }
      callback(count > 0 ? sum / count : 128);
    } catch(e) {
      callback(128);
    }
  }

  /**
   * Set overlay text/background color based on image brightness
   * so the label is always readable against the blurred image.
   */
  function applyOverlayColor(img, overlay) {
    getImageBrightness(img, function(brightness) {
      if (brightness > 128) {
        overlay.style.color = '#000000';
        overlay.style.background = 'rgba(255, 255, 255, 0.45)';
      } else {
        overlay.style.color = '#FFFFFF';
        overlay.style.background = 'rgba(0, 0, 0, 0.4)';
      }
    });
  }

  /**
   * Wrap each <img> in a blur container with a spoiler overlay.
   * Overlay text color adapts to image brightness for readability.
   * Tapping toggles the blur on/off.
   */
  function setupImageBlur() {
    var imgs = document.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      if (img.closest && img.closest('.blur-wrapper')) continue;

      var wrapper = document.createElement('div');
      wrapper.className = 'blur-wrapper blurred';

      var overlay = document.createElement('div');
      overlay.className = 'blur-overlay';
      overlay.textContent = '\u30CD\u30BF\u30D0\u30EC';

      img.parentNode.insertBefore(wrapper, img);
      wrapper.appendChild(img);
      wrapper.appendChild(overlay);

      // Adapt overlay color to image brightness
      (function(imgEl, overlayEl) {
        if (imgEl.complete && imgEl.naturalWidth > 0) {
          applyOverlayColor(imgEl, overlayEl);
        } else {
          imgEl.addEventListener('load', function() {
            applyOverlayColor(imgEl, overlayEl);
          });
        }
      })(img, overlay);

      (function(w) {
        w.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          if (w.classList.contains('blurred')) {
            w.classList.remove('blurred');
          } else {
            w.classList.add('blurred');
          }
        });
      })(wrapper);
    }
  }

  /**
   * Wait for all images to load, then recalculate pages.
   * This is critical because images change content dimensions.
   */
  var IMAGE_LOAD_TIMEOUT_MS = 5000;

  function watchImages() {
    var imgs = document.querySelectorAll('img');
    var svgImages = document.querySelectorAll('svg image');

    var totalToWatch = imgs.length + svgImages.length;
    if (totalToWatch === 0) {
      imagesLoaded = true;
      return;
    }

    var remaining = totalToWatch;
    var settled = false;
    var fallbackTimer = null;

    function settle() {
      if (settled) return;
      settled = true;
      imagesLoaded = true;
      if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
      requestAnimationFrame(function() {
        calculatePages();
        sendPageInfo();
      });
    }

    function onImgReady() {
      remaining--;
      if (remaining <= 0) settle();
    }

    for (var i = 0; i < imgs.length; i++) {
      if (imgs[i].complete) {
        onImgReady();
      } else {
        (function(img) {
          img.addEventListener('load', function() { onImgReady(); });
          img.addEventListener('error', function() { onImgReady(); });
        })(imgs[i]);
      }
    }

    // Track <svg><image> elements via Image() decode probe
    for (var j = 0; j < svgImages.length; j++) {
      (function(svgImg) {
        var href = svgImg.getAttribute('xlink:href') || svgImg.getAttribute('href') || '';
        if (!href) { onImgReady(); return; }
        var probe = new Image();
        probe.onload = function() { onImgReady(); };
        probe.onerror = function() { onImgReady(); };
        probe.src = href;
      })(svgImages[j]);
    }

    // Safety fallback: if images take too long, settle anyway so pagination works
    fallbackTimer = setTimeout(function() {
      if (!settled) settle();
    }, IMAGE_LOAD_TIMEOUT_MS);
  }

  /**
   * Initialize on load.
   */
  function init() {
    try {
      detectWritingMode();
      normalizeImages();
      if (blurImages) setupImageBlur();
      calculatePages();
      currentPage = 0;

      // In continuous mode, ensure the scroll starts at the reading origin.
      // For vertical-rl the browser may initialise scrollLeft at the wrong end.
      if (!isPaginated) {
        var scrollEl = document.scrollingElement || document.documentElement;
        if (isVertical) {
          scrollEl.scrollLeft = 0;
        } else {
          scrollEl.scrollTop = 0;
        }
      }

      if (initDictEnabled) {
        dictEnabled = true;
      }

      sendMessage({ type: 'ready' });
      sendPageInfo();
      watchImages();
    } catch (err) {
      // Guarantee the ready signal even if init partially fails
      sendMessage({ type: 'ready' });
      sendPageInfo();
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
    setPageMargin: setPageMargin,
    setFurigana: setFurigana,
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
    scrollToChapterWithProgress: scrollToChapterWithProgress,
  };
})();
true; // Required for injectJavaScript
`;
