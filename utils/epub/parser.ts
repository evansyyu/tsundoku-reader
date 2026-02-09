/**
 * EPUB Parser Engine
 *
 * Extracts and parses EPUB files using pure JavaScript (JSZip + fast-xml-parser).
 * No native modules required -- fully New Architecture compatible.
 *
 * EPUB structure:
 *   mimetype
 *   META-INF/
 *     container.xml        <- points to the OPF file
 *   OEBPS/ (or similar)
 *     content.opf          <- metadata, manifest, spine
 *     toc.ncx              <- table of contents (EPUB2)
 *     nav.xhtml            <- navigation (EPUB3)
 *     chapter1.xhtml
 *     chapter2.xhtml
 *     images/
 *     styles/
 */

import JSZip from 'jszip';
import * as FileSystem from 'expo-file-system/legacy';
import { XMLParser } from 'fast-xml-parser';
import type { BookMetadata, SpineItem } from '@/types/book';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: (name) => {
    // These elements can appear multiple times
    return ['item', 'itemref', 'dc:creator', 'dc:language', 'navPoint', 'li'].includes(name);
  },
});

export interface ParsedEpub {
  metadata: BookMetadata;
  spine: SpineItem[];
  /** Path prefix within the ZIP (e.g., 'OEBPS/') */
  basePath: string;
  /** The JSZip instance for further file extraction */
  zip: JSZip;
}

/**
 * Parse an EPUB file and extract metadata + spine.
 *
 * @param epubPath - Absolute path to the .epub file on disk
 * @returns Parsed EPUB data
 */
export async function parseEpub(epubPath: string): Promise<ParsedEpub> {
  // Read the EPUB as base64 (EPUBs are ZIP archives)
  const base64 = await FileSystem.readAsStringAsync(epubPath, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Load with JSZip
  const zip = await JSZip.loadAsync(base64, { base64: true });

  // 1. Parse container.xml to find the OPF file path
  const containerXml = await readZipFile(zip, 'META-INF/container.xml');
  if (!containerXml) {
    throw new Error('Invalid EPUB: missing META-INF/container.xml');
  }

  const container = xmlParser.parse(containerXml);
  const rootfile =
    container?.container?.rootfiles?.rootfile;

  let opfPath: string;
  if (Array.isArray(rootfile)) {
    opfPath = rootfile[0]?.['@_full-path'];
  } else {
    opfPath = rootfile?.['@_full-path'];
  }

  if (!opfPath) {
    throw new Error('Invalid EPUB: cannot find rootfile in container.xml');
  }

  // Determine the base path (directory containing the OPF)
  const lastSlash = opfPath.lastIndexOf('/');
  const basePath = lastSlash >= 0 ? opfPath.substring(0, lastSlash + 1) : '';

  // 2. Parse the OPF file
  const opfXml = await readZipFile(zip, opfPath);
  if (!opfXml) {
    throw new Error(`Invalid EPUB: missing OPF file at ${opfPath}`);
  }

  const opf = xmlParser.parse(opfXml);
  const pkg = opf?.['package'] ?? opf?.['opf:package'];
  if (!pkg) {
    throw new Error('Invalid EPUB: cannot parse OPF package element');
  }

  // 3. Extract metadata
  const metadata = extractMetadata(pkg, basePath);

  // 4. Build spine from manifest + spine elements
  const spine = buildSpine(pkg, basePath);

  return { metadata, spine, basePath, zip };
}

/**
 * Extract metadata from the OPF package element.
 */
function extractMetadata(pkg: any, basePath: string): BookMetadata {
  const md = pkg?.metadata ?? pkg?.['opf:metadata'] ?? {};

  // Title
  const titleRaw = md?.['dc:title'];
  const title = typeof titleRaw === 'string'
    ? titleRaw
    : titleRaw?.['#text'] ?? 'Untitled';

  // Author
  const creatorRaw = md?.['dc:creator'];
  let author = 'Unknown Author';
  if (Array.isArray(creatorRaw)) {
    author = creatorRaw.map((c: any) => (typeof c === 'string' ? c : c?.['#text'] ?? '')).join(', ');
  } else if (typeof creatorRaw === 'string') {
    author = creatorRaw;
  } else if (creatorRaw?.['#text']) {
    author = creatorRaw['#text'];
  }

  // Language
  const langRaw = md?.['dc:language'];
  let language = 'en';
  if (Array.isArray(langRaw)) {
    language = (typeof langRaw[0] === 'string' ? langRaw[0] : langRaw[0]?.['#text']) ?? 'en';
  } else if (typeof langRaw === 'string') {
    language = langRaw;
  } else if (langRaw?.['#text']) {
    language = langRaw['#text'];
  }

  // Publisher
  const publisherRaw = md?.['dc:publisher'];
  const publisher = typeof publisherRaw === 'string'
    ? publisherRaw
    : publisherRaw?.['#text'] ?? undefined;

  // Description
  const descRaw = md?.['dc:description'];
  const description = typeof descRaw === 'string'
    ? descRaw
    : descRaw?.['#text'] ?? undefined;

  // Cover image: look in manifest for cover-image property or meta cover
  const coverHref = findCoverHref(pkg, basePath);

  // Page progression direction from spine
  const spineEl = pkg?.spine ?? {};
  const ppd = spineEl?.['@_page-progression-direction'] ?? 'default';

  return {
    title,
    author,
    language,
    publisher,
    description,
    coverHref,
    pageProgressionDirection: ppd as 'ltr' | 'rtl' | 'default',
  };
}

/**
 * Find the cover image href from the OPF manifest.
 */
function findCoverHref(pkg: any, basePath: string): string | undefined {
  const manifest = pkg?.manifest;
  const items: any[] = manifest?.item ?? [];

  // Method 1: Look for item with properties="cover-image" (EPUB3)
  for (const item of items) {
    if (item?.['@_properties']?.includes('cover-image')) {
      return item?.['@_href'];
    }
  }

  // Method 2: Look for meta name="cover" (EPUB2) and find manifest item by ID
  const md = pkg?.metadata ?? {};
  const metaItems = md?.meta;
  const metas = Array.isArray(metaItems) ? metaItems : metaItems ? [metaItems] : [];

  for (const meta of metas) {
    if (meta?.['@_name'] === 'cover') {
      const coverId = meta?.['@_content'];
      if (coverId) {
        const coverItem = items.find((i: any) => i?.['@_id'] === coverId);
        if (coverItem) {
          return coverItem?.['@_href'];
        }
      }
    }
  }

  // Method 3: Look for common cover image filenames
  for (const item of items) {
    const href = item?.['@_href'] ?? '';
    const mediaType = item?.['@_media-type'] ?? '';
    if (
      mediaType.startsWith('image/') &&
      (href.toLowerCase().includes('cover') || item?.['@_id']?.toLowerCase().includes('cover'))
    ) {
      return href;
    }
  }

  return undefined;
}

/**
 * Build the reading spine (ordered list of content documents).
 */
function buildSpine(pkg: any, basePath: string): SpineItem[] {
  const manifest = pkg?.manifest;
  const items: any[] = manifest?.item ?? [];
  const spineEl = pkg?.spine ?? {};
  const itemrefs: any[] = spineEl?.itemref ?? [];

  // Build a lookup from manifest ID -> item
  const manifestMap = new Map<string, any>();
  for (const item of items) {
    const id = item?.['@_id'];
    if (id) {
      manifestMap.set(id, item);
    }
  }

  const spine: SpineItem[] = [];

  for (const ref of itemrefs) {
    const idref = ref?.['@_idref'];
    const linear = ref?.['@_linear'] !== 'no';

    if (idref && manifestMap.has(idref)) {
      const item = manifestMap.get(idref)!;
      spine.push({
        id: idref,
        href: item['@_href'],
        mediaType: item['@_media-type'] ?? 'application/xhtml+xml',
        linear,
      });
    }
  }

  return spine;
}

/**
 * Read a file from the ZIP archive as a UTF-8 string.
 */
async function readZipFile(zip: JSZip, path: string): Promise<string | null> {
  const file = zip.file(path);
  if (!file) return null;
  return file.async('string');
}

/**
 * Extract all files from the EPUB ZIP to a target directory.
 *
 * @param zip - The JSZip instance
 * @param targetDir - Absolute path to the target directory
 */
export async function extractEpubFiles(
  zip: JSZip,
  targetDir: string
): Promise<void> {
  const entries = Object.entries(zip.files);

  for (const [path, zipEntry] of entries) {
    if (zipEntry.dir) {
      // Create directory
      await FileSystem.makeDirectoryAsync(`${targetDir}/${path}`, {
        intermediates: true,
      });
    } else {
      // Determine encoding based on file type
      const isText =
        path.endsWith('.xhtml') ||
        path.endsWith('.html') ||
        path.endsWith('.htm') ||
        path.endsWith('.xml') ||
        path.endsWith('.css') ||
        path.endsWith('.ncx') ||
        path.endsWith('.opf') ||
        path.endsWith('.svg') ||
        path.endsWith('.js');

      // Ensure parent directory exists
      const lastSlash = path.lastIndexOf('/');
      if (lastSlash > 0) {
        const parentDir = path.substring(0, lastSlash);
        await FileSystem.makeDirectoryAsync(`${targetDir}/${parentDir}`, {
          intermediates: true,
        });
      }

      if (isText) {
        const content = await zipEntry.async('string');
        await FileSystem.writeAsStringAsync(`${targetDir}/${path}`, content, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      } else {
        // Binary files (images, fonts) -- write as base64
        const base64Content = await zipEntry.async('base64');
        await FileSystem.writeAsStringAsync(`${targetDir}/${path}`, base64Content, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }
    }
  }
}
