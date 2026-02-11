/**
 * Dictionary lookup type definitions.
 *
 * Mirrors the structure of the dictionary_yomu.db SQLite database.
 */

/** A single furigana reading for an entry */
export interface FuriganaReading {
  kanji: string;
  furigana: string;
}

/**
 * A single sense/definition for an entry.
 *
 * In the database, each sense_number can have MULTIPLE gloss rows.
 * We group them into a single DictionarySense with a glosses array.
 */
export interface DictionarySense {
  senseNumber: number;
  /** Part of speech abbreviation (e.g., "N", "V", "Exp, N") */
  pos: string;
  /** All English definitions for this sense */
  glosses: string[];
  /** Additional tags */
  tags: string;
  /** Subject field (e.g., "computing", "medicine") */
  field: string;
  /** Notes specific to this sense (from the notes table) */
  notes: DictionaryNote[];
  /** Cross-references for this sense (from the link table) */
  links: DictionaryLink[];
}

/** A note attached to a sense (from the notes table) */
export interface DictionaryNote {
  note: string;
  /** e.g., "explanation", "note" */
  type: string;
}

/** A cross-reference link attached to a sense (from the link table) */
export interface DictionaryLink {
  /** e.g., "see" */
  type: string;
  /** The referenced term */
  link: string;
}

/**
 * Tag/frequency metadata for an entry.
 *
 * The tags table has a 1:1 relationship with entries (PRIMARY KEY = id).
 */
export interface DictionaryTag {
  reading: string;
  tags: string;
  originLanguage: string;
}

/** Complete dictionary entry with all related data */
export interface DictionaryEntry {
  /** Unique entry ID from the entries table */
  id: number;
  /** The Japanese term (e.g., "その他", "お祖父さん") */
  term: string;
  /** Word priority/commonality */
  priority: number;
  /** Furigana readings */
  furigana: FuriganaReading[];
  /** Word definitions grouped by sense number */
  senses: DictionarySense[];
  /** Frequency/usage tag (1:1 with entry, may be null) */
  tag: DictionaryTag | null;
  /** Alternative writings of the word */
  alternateForms: string[];
  /** Pitch accent patterns */
  pitchAccent: string[];
}

/** An example sentence for a dictionary entry */
export interface ExampleSentence {
  /** Japanese sentence */
  sentence: string;
  /** English translation */
  english: string;
}

/** Result of a dictionary lookup including the matched text range */
export interface DictionaryLookupResult {
  /** The matched term string */
  matchedTerm: string;
  /** The dictionary entry */
  entry: DictionaryEntry;
  /** Offset of the match start within the surrounding text */
  matchStartOffset: number;
  /** Length of the matched text */
  matchLength: number;
  /** If the match came from deinflection, the original conjugated form */
  originalForm?: string;
  /** Human-readable deinflection path, e.g. ["te-form"] */
  deinflectionRules?: string[];
}
