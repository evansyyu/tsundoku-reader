/**
 * Dictionary database layer and lookup service.
 *
 * Opens the bundled dictionary_tsundoku.db (read-only) alongside the
 * existing user-data database.  Uses expo-sqlite's async API.
 */

import * as SQLite from 'expo-sqlite';
// TODO: migrate to expo-file-system (non-legacy) when upgrading to SDK 55+
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import type {
  DictionaryEntry,
  DictionarySense,
  DictionaryNote,
  DictionaryLink,
  FuriganaReading,
  DictionaryTag,
  DictionaryLookupResult,
  ExampleSentence,
} from '@/types/dictionary';
import { deinflect, CONDITION_TO_POS } from '@/utils/deinflection';

// ---------------------------------------------------------------------------
// Database singleton
// ---------------------------------------------------------------------------

let dictDb: SQLite.SQLiteDatabase | null = null;

/**
 * Initialize the dictionary database.
 *
 * Copies the bundled .db asset to the document directory on first launch,
 * then opens it with expo-sqlite.
 */
export async function initDictionaryDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dictDb) return dictDb;

  const dbName = 'dictionary_tsundoku.db';
  const dbDir = `${FileSystem.documentDirectory}SQLite`;
  const dbPath = `${dbDir}/${dbName}`;

  // Ensure the SQLite directory exists
  const dirInfo = await FileSystem.getInfoAsync(dbDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dbDir, { intermediates: true });
  }

  // Bump this version whenever the bundled dictionary_tsundoku.db changes.
  // When the local copy is older, it gets replaced with the new bundle.
  const DB_VERSION = 2; // v2: added kanji_core table
  const versionFile = `${dbDir}/${dbName}.version`;

  let needsCopy = false;
  const fileInfo = await FileSystem.getInfoAsync(dbPath);
  if (!fileInfo.exists) {
    needsCopy = true;
  } else {
    // Check stored version
    const vInfo = await FileSystem.getInfoAsync(versionFile);
    if (!vInfo.exists) {
      needsCopy = true; // no version file → legacy copy
    } else {
      const stored = await FileSystem.readAsStringAsync(versionFile);
      if (parseInt(stored, 10) < DB_VERSION) needsCopy = true;
    }
  }

  if (needsCopy) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const asset = Asset.fromModule(require('../assets/dictionary_tsundoku.db'));
    await asset.downloadAsync();

    if (!asset.localUri) {
      throw new Error('Failed to download dictionary database asset');
    }

    // Remove old copy (and WAL/SHM) so expo-sqlite doesn't see stale data
    await FileSystem.deleteAsync(dbPath, { idempotent: true });
    await FileSystem.deleteAsync(`${dbPath}-wal`, { idempotent: true });
    await FileSystem.deleteAsync(`${dbPath}-shm`, { idempotent: true });

    await FileSystem.copyAsync({
      from: asset.localUri,
      to: dbPath,
    });

    await FileSystem.writeAsStringAsync(versionFile, String(DB_VERSION));
  }

  dictDb = await SQLite.openDatabaseAsync(dbName);

  // Enable WAL mode for better read performance
  await dictDb.execAsync('PRAGMA journal_mode = WAL;');

  return dictDb;
}

/**
 * Get the dictionary database instance (must be initialized first).
 */
export function getDictionaryDatabase(): SQLite.SQLiteDatabase {
  if (!dictDb) {
    throw new Error('Dictionary database not initialized. Call initDictionaryDatabase() first.');
  }
  return dictDb;
}

// ---------------------------------------------------------------------------
// LRU Cache
// ---------------------------------------------------------------------------

const CACHE_MAX_SIZE = 50;
const entryCache = new Map<string, DictionaryEntry | null>();
const entryCacheById = new Map<number, DictionaryEntry>();

function getCached(term: string): DictionaryEntry | null | undefined {
  if (!entryCache.has(term)) return undefined;
  // Move to end (most recently used)
  const value = entryCache.get(term)!;
  entryCache.delete(term);
  entryCache.set(term, value);
  return value;
}

function setCache(term: string, entry: DictionaryEntry | null): void {
  if (entryCache.size >= CACHE_MAX_SIZE) {
    // Delete the oldest entry (first key)
    const firstKey = entryCache.keys().next().value;
    if (firstKey !== undefined) {
      entryCache.delete(firstKey);
    }
  }
  entryCache.set(term, entry);
}

// ---------------------------------------------------------------------------
// DictionaryService
// ---------------------------------------------------------------------------

/**
 * Check if a term exists in the dictionary (by entries.term or
 * alternate_forms.alt_form).
 * Fast existence check without fetching full entry data.
 */
export async function termExists(term: string): Promise<boolean> {
  // Check cache first
  const cached = getCached(term);
  if (cached !== undefined) return cached !== null;

  const db = getDictionaryDatabase();
  const row = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM entries WHERE term = ?
     UNION
     SELECT id FROM alternate_forms WHERE alt_form = ?
     LIMIT 1`,
    [term, term]
  );
  return row !== null;
}

/**
 * Validate that a dictionary entry's POS matches deinflection conditions.
 *
 * Checks the entry's senses in memory (no extra DB query).
 * Returns true if at least one sense has a POS that matches any of the
 * expected conditions, or if conditions is empty (accept any POS).
 */
function validatePOS(entry: DictionaryEntry, conditions: string[]): boolean {
  if (conditions.length === 0) return true;

  // Build the set of DB POS abbreviations that satisfy the conditions
  const acceptedPOS: string[] = [];
  for (const cond of conditions) {
    const posValues = CONDITION_TO_POS[cond];
    if (posValues) {
      acceptedPOS.push(...posValues);
    }
  }

  if (acceptedPOS.length === 0) return true; // Unknown condition — accept

  // Check if any sense contains a matching POS abbreviation.
  // The pos field may be concatenated like "V5Vt" or comma-separated "V5, Vt".
  return entry.senses.some((sense) =>
    acceptedPOS.some((pos) => sense.pos.includes(pos))
  );
}

/**
 * Build a full DictionaryEntry from its row-level data.
 * Shared by lookupWord (direct match) and alt-form fallback.
 */
async function buildEntryById(
  db: SQLite.SQLiteDatabase,
  entryId: number,
  entryTerm: string,
  entryPriority: number,
): Promise<DictionaryEntry> {
  const [furiganaRows, senseRows, tagRow, noteRows, linkRows, altFormRows, pitchRows] =
    await Promise.all([
      db.getAllAsync<{ kanji: string; furigana: string }>(
        'SELECT kanji, furigana FROM furigana WHERE id = ?',
        [entryId]
      ),
      db.getAllAsync<{
        sense_number: number;
        pos: string;
        gloss: string;
        tags: string;
        field: string;
      }>(
        'SELECT sense_number, pos, gloss, tags, field FROM senses WHERE id = ? ORDER BY sense_number',
        [entryId]
      ),
      db.getFirstAsync<{ reading: string; tags: string; origin_language: string }>(
        'SELECT reading, tags, origin_language FROM tags WHERE id = ?',
        [entryId]
      ),
      db.getAllAsync<{ note: string; type: string; sense_number: number }>(
        'SELECT note, type, sense_number FROM notes WHERE id = ?',
        [entryId]
      ),
      db.getAllAsync<{ type: string; link: string; sense_number: number }>(
        'SELECT type, link, sense_number FROM link WHERE id = ?',
        [entryId]
      ),
      db.getAllAsync<{ alt_form: string }>(
        'SELECT alt_form FROM alternate_forms WHERE id = ?',
        [entryId]
      ),
      db.getAllAsync<{ accent: string }>(
        'SELECT accent FROM pitch_accent WHERE id = ?',
        [entryId]
      ),
    ]);

  const furigana: FuriganaReading[] = furiganaRows.map((r) => ({
    kanji: r.kanji,
    furigana: r.furigana,
  }));

  const sensesMap = new Map<
    number,
    { pos: string; glosses: string[]; tags: string; field: string }
  >();
  for (const row of senseRows) {
    const existing = sensesMap.get(row.sense_number);
    if (existing) {
      existing.glosses.push(row.gloss);
    } else {
      sensesMap.set(row.sense_number, {
        pos: row.pos ?? '',
        glosses: [row.gloss],
        tags: row.tags ?? '',
        field: row.field ?? '',
      });
    }
  }

  const notesMap = new Map<number, DictionaryNote[]>();
  for (const row of noteRows) {
    const existing = notesMap.get(row.sense_number) ?? [];
    existing.push({ note: row.note, type: row.type });
    notesMap.set(row.sense_number, existing);
  }

  const linksMap = new Map<number, DictionaryLink[]>();
  for (const row of linkRows) {
    const existing = linksMap.get(row.sense_number) ?? [];
    existing.push({ type: row.type, link: row.link });
    linksMap.set(row.sense_number, existing);
  }

  const senses: DictionarySense[] = [];
  for (const [senseNumber, data] of sensesMap) {
    senses.push({
      senseNumber,
      pos: data.pos,
      glosses: data.glosses,
      tags: data.tags,
      field: data.field,
      notes: notesMap.get(senseNumber) ?? [],
      links: linksMap.get(senseNumber) ?? [],
    });
  }

  const tag: DictionaryTag | null = tagRow
    ? {
        reading: tagRow.reading ?? '',
        tags: tagRow.tags ?? '',
        originLanguage: tagRow.origin_language ?? '',
      }
    : null;

  return {
    id: entryId,
    term: entryTerm,
    priority: entryPriority,
    furigana,
    senses,
    tag,
    alternateForms: altFormRows.map((r) => r.alt_form),
    pitchAccent: pitchRows.map((r) => r.accent),
  };
}

/**
 * Look up a complete dictionary entry by term.
 *
 * Search order:
 * 1. Direct match in `entries.term` (highest priority first).
 * 2. If no direct match, search `alternate_forms.alt_form` and return the
 *    parent entry.  This covers kana-only spellings (e.g. まもる → 守る),
 *    rare kanji variants (護る → 守る), and other alternate writings.
 *
 * Senses are grouped by sense_number since the DB stores one row per
 * gloss (multiple glosses per sense_number).
 */
export async function lookupWord(term: string): Promise<DictionaryEntry | null> {
  // Check cache first
  const cached = getCached(term);
  if (cached !== undefined) return cached;

  const db = getDictionaryDatabase();

  // 1. Direct match in entries table
  const entryRow = await db.getFirstAsync<{
    id: number;
    term: string;
    priority: number;
  }>('SELECT id, term, priority FROM entries WHERE term = ? ORDER BY priority DESC LIMIT 1', [
    term,
  ]);

  if (entryRow) {
    const entry = await buildEntryById(db, entryRow.id, entryRow.term, entryRow.priority);
    setCache(term, entry);
    entryCacheById.set(entry.id, entry);
    return entry;
  }

  // 2. Fallback: search alternate_forms table
  //    Join to entries so we get the parent entry's term & priority.
  const altRow = await db.getFirstAsync<{
    id: number;
    term: string;
    priority: number;
  }>(
    `SELECT e.id, e.term, e.priority
     FROM alternate_forms af
     JOIN entries e ON e.id = af.id
     WHERE af.alt_form = ?
     ORDER BY e.priority DESC
     LIMIT 1`,
    [term]
  );

  if (altRow) {
    const entry = await buildEntryById(db, altRow.id, altRow.term, altRow.priority);
    setCache(term, entry);
    entryCacheById.set(entry.id, entry);
    return entry;
  }

  setCache(term, null);
  return null;
}

/**
 * Look up a dictionary entry by its numeric ID.
 * Used by the dictionary modal to reload entries that were found
 * during findAllMatches (typically served from cache).
 */
export async function lookupWordById(id: number): Promise<DictionaryEntry | null> {
  const cached = entryCacheById.get(id);
  if (cached) return cached;

  const db = getDictionaryDatabase();
  const row = await db.getFirstAsync<{
    id: number;
    term: string;
    priority: number;
  }>('SELECT id, term, priority FROM entries WHERE id = ?', [id]);

  if (!row) return null;

  const entry = await buildEntryById(db, row.id, row.term, row.priority);
  entryCacheById.set(entry.id, entry);
  return entry;
}

// ---------------------------------------------------------------------------
// Kanji lookup
// ---------------------------------------------------------------------------

/**
 * Look up meanings for a batch of individual kanji characters.
 * Returns a Map from kanji character to its primary English meaning.
 */
export async function lookupKanjiBatch(kanjiChars: string[]): Promise<Map<string, string>> {
  if (kanjiChars.length === 0) return new Map();
  const db = getDictionaryDatabase();
  const placeholders = kanjiChars.map(() => '?').join(',');
  const rows = await db.getAllAsync<{ character: string; meaning: string }>(
    `SELECT character, meaning FROM kanji_core WHERE character IN (${placeholders})`,
    kanjiChars
  );
  const result = new Map<string, string>();
  for (const row of rows) {
    result.set(row.character, row.meaning);
  }
  return result;
}

/**
 * Parse a frequency rank from an entry's tags (e.g. "Top 100" → 100).
 * Returns Infinity if no frequency tag is found.
 */
function parseFrequencyRank(entry: DictionaryEntry): number {
  if (!entry.tag?.tags) return Infinity;
  const m = entry.tag.tags.match(/Top\s*(\d+)/);
  return m ? parseInt(m[1], 10) : Infinity;
}

/**
 * Characters that should stop word expansion (punctuation, whitespace, etc.)
 */
const BOUNDARY_CHARS = new Set([
  ' ',
  '\t',
  '\n',
  '\r',
  '。',
  '、',
  '！',
  '？',
  '「',
  '」',
  '『',
  '』',
  '（',
  '）',
  '【',
  '】',
  '〈',
  '〉',
  '《',
  '》',
  '・',
  '…',
  '―',
  '──',
  '〜',
  '.',
  ',',
  '!',
  '?',
  '(',
  ')',
  '[',
  ']',
  '{',
  '}',
  '"',
  "'",
  ':',
  ';',
  '\u3000', // ideographic space
]);

/** Max number of unique entries to return from findAllMatches. */
const MAX_MATCH_RESULTS = 20;

/**
 * Try to match `candidate` against the dictionary (with deinflection).
 * Returns the first valid (entry, form) pair, or null.
 */
async function tryMatch(
  candidate: string,
): Promise<{ entry: DictionaryEntry; form: import('@/utils/deinflection').DeinflectionResult } | null> {
  const forms = deinflect(candidate);
  for (const form of forms) {
    const entry = await lookupWord(form.term);
    if (!entry) continue;
    if (form.conditions.length > 0 && !validatePOS(entry, form.conditions)) continue;
    return { entry, form };
  }
  return null;
}

/**
 * Find all dictionary matches within the text around the pressed offset.
 *
 * 1. Finds the primary (longest) match — this determines the highlight span.
 * 2. Searches every substring of the highlighted span for additional matches.
 * 3. Deduplicates by entry ID (keeps the version with the longest match).
 * 4. Sorts: primary match first, then by match length desc, then by
 *    frequency rank (Top 100 > Top 200 > ... > no tag).
 *
 * @returns Sorted array of results. First element is the primary (longest)
 *          match whose span should be used for highlighting.
 */
export async function findAllMatches(
  text: string,
  offset: number,
): Promise<DictionaryLookupResult[]> {
  if (offset < 0 || offset >= text.length) return [];
  if (BOUNDARY_CHARS.has(text[offset])) return [];

  const maxForward = 15;
  const maxBackward = 10;

  // ── Determine the non-boundary span around the pressed character ──
  let leftBound = offset;
  const leftLimit = Math.max(0, offset - maxBackward);
  while (leftBound > leftLimit && !BOUNDARY_CHARS.has(text[leftBound - 1])) leftBound--;

  let rightBound = offset + 1;
  const rightLimit = Math.min(text.length, offset + maxForward);
  while (rightBound < rightLimit && !BOUNDARY_CHARS.has(text[rightBound])) rightBound++;

  // ── Phase 1: Find the primary (longest) match ────────────────────────
  let primaryResult: DictionaryLookupResult | null = null;

  for (let start = leftBound; start <= offset; start++) {
    for (let end = rightBound; end > offset; end--) {
      const candidateLen = end - start;
      if (primaryResult && candidateLen <= primaryResult.matchLength) break;

      const candidate = text.slice(start, end);
      const match = await tryMatch(candidate);
      if (!match) continue;

      const { entry, form } = match;
      const result: DictionaryLookupResult = {
        matchedTerm: entry.term,
        entry,
        matchStartOffset: start,
        matchLength: candidateLen,
      };
      if (form.ruleName !== 'original') {
        result.originalForm = candidate;
        result.deinflectionRules = form.rules;
      }
      primaryResult = result;
      break; // Longest match for this start found
    }
  }

  if (!primaryResult) return [];

  // ── Phase 2: Find all matches within the primary match's span ────────
  const matchStart = primaryResult.matchStartOffset;
  const matchEnd = matchStart + primaryResult.matchLength;
  const matchText = text.slice(matchStart, matchEnd);

  // Keyed by entry ID → keeps the longest match per entry
  const allResults = new Map<number, DictionaryLookupResult>();
  allResults.set(primaryResult.entry.id, primaryResult);

  // Iterate substrings from longest to shortest so longer matches win dedup
  for (let len = matchText.length; len >= 1 && allResults.size < MAX_MATCH_RESULTS; len--) {
    for (let s = 0; s + len <= matchText.length && allResults.size < MAX_MATCH_RESULTS; s++) {
      const sub = matchText.slice(s, s + len);
      const match = await tryMatch(sub);
      if (!match) continue;

      const { entry, form } = match;
      if (allResults.has(entry.id)) continue; // Already have a (longer) match

      const result: DictionaryLookupResult = {
        matchedTerm: entry.term,
        entry,
        matchStartOffset: matchStart + s,
        matchLength: len,
      };
      if (form.ruleName !== 'original') {
        result.originalForm = sub;
        result.deinflectionRules = form.rules;
      }
      allResults.set(entry.id, result);
    }
  }

  // ── Phase 3: Sort results ────────────────────────────────────────────
  const primaryId = primaryResult.entry.id;
  const sorted = [...allResults.values()].sort((a, b) => {
    // Primary match always first
    if (a.entry.id === primaryId) return -1;
    if (b.entry.id === primaryId) return 1;
    // Then by match length descending
    if (a.matchLength !== b.matchLength) return b.matchLength - a.matchLength;
    // Then by frequency rank (lower = more common = better)
    return parseFrequencyRank(a.entry) - parseFrequencyRank(b.entry);
  });

  return sorted;
}

/**
 * Convenience wrapper: returns only the primary (longest) match.
 */
export async function findLongestMatch(
  text: string,
  offset: number,
): Promise<DictionaryLookupResult | null> {
  const results = await findAllMatches(text, offset);
  return results[0] ?? null;
}

// ---------------------------------------------------------------------------
// Example sentences
// ---------------------------------------------------------------------------

const sentenceCache = new Map<number, ExampleSentence[]>();

/**
 * Fetch up to `limit` example sentences that contain the given entry ID.
 *
 * Searches the `duplicates` (exact word matches) and `verbs` (conjugated
 * forms) JSON columns of the sentences table.
 */
export async function fetchSentences(
  entryId: number,
  limit = 5,
): Promise<ExampleSentence[]> {
  const cached = sentenceCache.get(entryId);
  if (cached) return cached;

  const db = getDictionaryDatabase();
  const idPattern = `%, ${entryId},%`;
  const idPatternEnd = `%, ${entryId}]%`;
  const idPatternStart = `[${entryId},%`;
  const idPatternSolo = `[${entryId}]%`;

  const rows = await db.getAllAsync<{ sentence: string; english: string | null }>(
    `SELECT sentence, english FROM sentences
     WHERE duplicates LIKE ? OR duplicates LIKE ? OR duplicates LIKE ? OR duplicates LIKE ?
        OR verbs LIKE ? OR verbs LIKE ? OR verbs LIKE ? OR verbs LIKE ?
     LIMIT ?`,
    [
      idPattern, idPatternEnd, idPatternStart, idPatternSolo,
      idPattern, idPatternEnd, idPatternStart, idPatternSolo,
      limit,
    ]
  );

  const results: ExampleSentence[] = rows.map((r) => ({
    sentence: r.sentence,
    english: r.english ?? '',
  }));

  sentenceCache.set(entryId, results);
  return results;
}
