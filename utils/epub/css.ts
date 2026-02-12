/**
 * CSS injection engine for the EPUB WebView reader.
 *
 * Generates the full HTML document by wrapping chapter XHTML content
 * with injected CSS for pagination, theming, and vertical text,
 * plus the JavaScript bridge for communication with React Native.
 */

import {
  BASE_READER_CSS,
  BLUR_IMAGES_CSS,
  HORIZONTAL_PAGINATED_CSS,
  HORIZONTAL_SCROLL_CSS,
  VERTICAL_PAGINATED_CSS,
  VERTICAL_SCROLL_CSS,
} from '@/constants/reader';
import { DEFAULT_COLUMN_GAP, DEFAULT_PAGE_MARGIN } from '@/constants/layout';

export interface ChapterHtmlOptions {
  isVertical: boolean;
  isPaginated: boolean;
  textColor: string;
  backgroundColor: string;
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  pageMargin?: number;
  columnGap?: number;
  showFurigana?: boolean;
  blurImages?: boolean;
}

/**
 * Build the full HTML to inject into the WebView for a chapter.
 *
 * Takes the raw XHTML content from the EPUB and wraps it with:
 * 1. Base CSS (theme, typography)
 * 2. Layout CSS (pagination or scroll, horizontal or vertical)
 * 3. JS bridge for communication
 *
 * @param chapterContent - Raw XHTML string from the EPUB
 * @param options - Rendering options
 * @returns Complete HTML string ready for WebView
 */
export function buildChapterHtml(
  chapterContent: string,
  options: ChapterHtmlOptions
): string {
  const {
    isVertical,
    isPaginated,
    textColor,
    backgroundColor,
    fontSize,
    lineHeight,
    fontFamily,
    pageMargin = DEFAULT_PAGE_MARGIN,
    columnGap = DEFAULT_COLUMN_GAP,
    showFurigana = true,
    blurImages = false,
  } = options;

  // Build the CSS by replacing template variables
  let css = BASE_READER_CSS
    .replace('{{TEXT_COLOR}}', textColor)
    .replace('{{BG_COLOR}}', backgroundColor)
    .replace('{{FONT_SIZE}}', String(fontSize))
    .replace('{{LINE_HEIGHT}}', String(lineHeight))
    .replace('{{FONT_FAMILY}}', fontFamily)
    .replace('{{PAGE_MARGIN}}', String(pageMargin))
    .replace('{{COLUMN_GAP}}', String(columnGap));

  // Add layout-specific CSS
  if (isVertical) {
    css += isPaginated ? VERTICAL_PAGINATED_CSS : VERTICAL_SCROLL_CSS;
  } else {
    css += isPaginated ? HORIZONTAL_PAGINATED_CSS : HORIZONTAL_SCROLL_CSS;
  }

  // Hide furigana if disabled
  if (!showFurigana) {
    css += `\n  rt { display: none !important; }\n  rp { display: none !important; }\n`;
  }

  // Blur images for spoiler prevention (JS wrapper added by bridge)
  if (blurImages) {
    css += BLUR_IMAGES_CSS;
  }

  // Extract the <body> content from the XHTML if it's a full document,
  // or use the content as-is if it's a fragment.
  const bodyContent = extractBodyContent(chapterContent);
  const headContent = extractHeadStyles(chapterContent);

  return `<!DOCTYPE html>
<html lang="${isVertical ? 'ja' : 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  ${headContent}
  <style>${css}</style>
</head>
<body>
  ${bodyContent}
</body>
</html>`;
}

/**
 * Build the full HTML for continuous mode with ALL chapters loaded at once.
 *
 * Each chapter is wrapped in a `<div class="chapter-section" data-chapter="N">`
 * so the bridge JS can detect which chapter the user is currently viewing.
 *
 * @param chapterContents - Raw XHTML strings from the EPUB
 * @param chapterHrefs - Spine item hrefs (e.g. "OEBPS/Text/ch1.xhtml") for resolving relative paths
 * @param options - Rendering options
 */
export function buildContinuousHtml(
  chapterContents: string[],
  chapterHrefs: string[],
  options: Omit<ChapterHtmlOptions, 'isPaginated'>
): string {
  const {
    isVertical,
    textColor,
    backgroundColor,
    fontSize,
    lineHeight,
    fontFamily,
    pageMargin = DEFAULT_PAGE_MARGIN,
    columnGap = DEFAULT_COLUMN_GAP,
    showFurigana = true,
    blurImages = false,
  } = options;

  let css = BASE_READER_CSS
    .replace('{{TEXT_COLOR}}', textColor)
    .replace('{{BG_COLOR}}', backgroundColor)
    .replace('{{FONT_SIZE}}', String(fontSize))
    .replace('{{LINE_HEIGHT}}', String(lineHeight))
    .replace('{{FONT_FAMILY}}', fontFamily)
    .replace('{{PAGE_MARGIN}}', String(pageMargin))
    .replace('{{COLUMN_GAP}}', String(columnGap));

  css += isVertical ? VERTICAL_SCROLL_CSS : HORIZONTAL_SCROLL_CSS;

  // Hide furigana if disabled
  if (!showFurigana) {
    css += `\n  rt { display: none !important; }\n  rp { display: none !important; }\n`;
  }

  // Blur images for spoiler prevention (JS wrapper added by bridge)
  if (blurImages) {
    css += BLUR_IMAGES_CSS;
  }

  // Add spacing between chapter sections
  const spacingProp = isVertical ? 'margin-left' : 'margin-bottom';
  css += `
    .chapter-section { ${spacingProp}: 4rem; }
    .chapter-section:last-child { ${spacingProp}: 0; }
  `;

  // Collect all head styles and build body content
  const headStyles: string[] = [];
  const bodyParts: string[] = [];

  for (let i = 0; i < chapterContents.length; i++) {
    const chapterDir = getDirectoryPath(chapterHrefs[i] ?? '');
    const body = rewriteRelativePaths(extractBodyContent(chapterContents[i]), chapterDir);
    const head = rewriteRelativePaths(extractHeadStyles(chapterContents[i]), chapterDir);
    if (head) headStyles.push(head);
    bodyParts.push(`<div class="chapter-section" data-chapter="${i}">${body}</div>`);
  }

  // Deduplicate head styles (many chapters share the same stylesheets)
  const uniqueHeadStyles = [...new Set(headStyles)].join('\n');

  return `<!DOCTYPE html>
<html lang="${isVertical ? 'ja' : 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  ${uniqueHeadStyles}
  <style>${css}</style>
</head>
<body>
  ${bodyParts.join('\n')}
</body>
</html>`;
}

/**
 * Get the directory portion of a path (everything up to the last '/').
 * e.g. "OEBPS/Text/ch1.xhtml" → "OEBPS/Text/"
 */
function getDirectoryPath(filePath: string): string {
  const lastSlash = filePath.lastIndexOf('/');
  return lastSlash >= 0 ? filePath.substring(0, lastSlash + 1) : '';
}

/**
 * Resolve a relative path against a base directory.
 * Handles ".." and "." segments.
 * e.g. resolvePath("OEBPS/Text/", "../Images/cover.jpg") → "OEBPS/Images/cover.jpg"
 */
function resolvePath(baseDir: string, relativePath: string): string {
  const baseParts = baseDir.split('/').filter(Boolean);
  const relParts = relativePath.split('/');

  for (const part of relParts) {
    if (part === '..') {
      baseParts.pop();
    } else if (part !== '.' && part !== '') {
      baseParts.push(part);
    }
  }

  return baseParts.join('/');
}

/**
 * Rewrite relative paths in `src` and `href` attributes so they resolve
 * correctly when the document's base URL is the EPUB root (not the
 * chapter's directory).
 */
function rewriteRelativePaths(html: string, chapterDir: string): string {
  if (!chapterDir) return html;

  return html.replace(
    /((?:src|href|xlink:href)\s*=\s*["'])([^"'#][^"']*)(?=["'])/gi,
    (_match, prefix: string, path: string) => {
      // Skip absolute URLs, data URIs, and fragment-only refs
      if (/^(?:https?:|data:|\/\/|\/)/i.test(path)) return prefix + path;
      const resolved = resolvePath(chapterDir, path);
      return prefix + resolved;
    },
  );
}

/**
 * Extract the inner content of the <body> tag from an XHTML document.
 * If no <body> tag is found, returns the entire content.
 */
function extractBodyContent(xhtml: string): string {
  // Match <body ...>content</body>
  const bodyMatch = xhtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    return bodyMatch[1];
  }

  // If no body tag, check for <html> and extract everything inside
  const htmlMatch = xhtml.match(/<html[^>]*>([\s\S]*)<\/html>/i);
  if (htmlMatch) {
    // Remove <head> section if present
    return htmlMatch[1].replace(/<head[^>]*>[\s\S]*<\/head>/i, '');
  }

  // Return as-is (probably a fragment)
  return xhtml;
}

/**
 * Extract <style> and <link> elements from the EPUB <head> section.
 * These are the author's original styles that we want to preserve.
 */
function extractHeadStyles(xhtml: string): string {
  const headMatch = xhtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (!headMatch) return '';

  const head = headMatch[1];
  const styles: string[] = [];

  // Extract <style> blocks
  const styleMatches = head.matchAll(/<style[^>]*>[\s\S]*?<\/style>/gi);
  for (const match of styleMatches) {
    styles.push(match[0]);
  }

  // Extract <link rel="stylesheet"> elements
  const linkMatches = head.matchAll(/<link[^>]*rel=["']stylesheet["'][^>]*\/?>/gi);
  for (const match of linkMatches) {
    styles.push(match[0]);
  }

  return styles.join('\n');
}
