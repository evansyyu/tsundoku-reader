/**
 * Dictionary formSheet modal route.
 *
 * Displays dictionary entries with headword (ruby furigana), definitions,
 * tags, notes, cross-references, alternate forms, and pitch accent.
 * Supports multiple matches: a horizontal pager lets the user swipe
 * between entries, with page-indicator dots at the bottom.
 *
 * Route: /dictionary/:term?matches=<JSON>
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { lookupWord, lookupWordById, fetchSentences, lookupKanjiBatch } from '@/utils/dictionary';
import { notifyDictionaryDismissed } from '@/utils/dictionarySelection';
import { sensesAbbreviationMap, expandAbbreviation } from '@/constants/sense_abbreviations_map';
import { getTagStyle } from '@/constants/wordTagStyles';
import type { DictionaryEntry, DictionarySense, ExampleSentence } from '@/types/dictionary';

// ---------------------------------------------------------------------------
// Match metadata passed via route params
// ---------------------------------------------------------------------------

interface MatchInfo {
  id: number;
  term: string;
  original?: string;
  rules?: string[];
}

/** An entry loaded for display, with its deinflection metadata. */
interface LoadedEntry {
  entry: DictionaryEntry;
  originalForm?: string;
  deinflectionRules?: string[];
}

// ---------------------------------------------------------------------------
// POS / field / tags splitting & deduplication helpers
// ---------------------------------------------------------------------------

type AbbrevType = 'pos' | 'tags' | 'field';

/**
 * Split a concatenated abbreviation string into individual tokens.
 */
function splitTags(str: string, type: AbbrevType): string[] {
  if (!str) return [];
  const map = (sensesAbbreviationMap[type] ?? {}) as Record<string, string>;
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);

  const commaSep: string[] = [];
  let cur = '';
  let depth = 0;
  for (const ch of str) {
    if (ch === ',' && depth === 0) {
      commaSep.push(cur.trim());
      cur = '';
    } else {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      cur += ch;
    }
  }
  if (cur.trim()) commaSep.push(cur.trim());

  const result: string[] = [];
  for (const part of commaSep) {
    if (!part) continue;
    if (map[part]) { result.push(part); continue; }

    let rem = part;
    while (rem.length > 0) {
      let matched = false;
      for (const k of keys) {
        if (rem.startsWith(k)) {
          result.push(k);
          rem = rem.slice(k.length);
          matched = true;
          break;
        }
      }
      if (!matched) {
        const withCommas = rem.replace(/([a-z)\d])(?=[A-Z])/g, '$1,');
        result.push(...withCommas.split(',').map(s => s.trim()).filter(Boolean));
        break;
      }
    }
  }
  return result;
}

function expandTokens(tokens: string[], type: AbbrevType): string[] {
  return tokens.map(t => expandAbbreviation(t, type) || t);
}

function buildSenseHeaders(senses: DictionarySense[]) {
  const posLists = senses.map(s => splitTags(s.pos, 'pos'));
  const fieldLists = senses.map(s => splitTags(s.field, 'field'));
  const tagLists = senses.map(s => splitTags(s.tags, 'tags'));

  if (senses.length === 0) return { commonHeader: '', perSense: [] };

  const commonPOS = posLists.reduce((acc, l) => acc.filter(p => l.includes(p)), posLists[0] ?? []);
  const commonFields = fieldLists.reduce((acc, l) => acc.filter(f => l.includes(f)), fieldLists[0] ?? []);
  const commonTags = tagLists.reduce((acc, l) => acc.filter(t => l.includes(t)), tagLists[0] ?? []);

  const perSense = senses.map((_, i) => {
    const prevPOS = i > 0 ? posLists[i - 1] : [];
    const prevFields = i > 0 ? fieldLists[i - 1] : [];
    const prevTags = i > 0 ? tagLists[i - 1] : [];

    const visPOS = posLists[i].filter(p => !commonPOS.includes(p) && !prevPOS.includes(p));
    const visFields = fieldLists[i].filter(f => !commonFields.includes(f) && !prevFields.includes(f));
    const visTags = tagLists[i].filter(t => !commonTags.includes(t) && !prevTags.includes(t));

    return [
      ...expandTokens(visPOS, 'pos'),
      ...expandTokens(visFields, 'field'),
      ...expandTokens(visTags, 'tags'),
    ].join(', ');
  });

  const commonHeader = [
    ...expandTokens(commonPOS, 'pos'),
    ...expandTokens(commonFields, 'field'),
    ...expandTokens(commonTags, 'tags'),
  ].join(', ');

  return { commonHeader, perSense };
}

// ---------------------------------------------------------------------------
// Kana-headword helpers
// ---------------------------------------------------------------------------

function isUsuallyKana(entry: DictionaryEntry): boolean {
  return entry.senses.some((s) => {
    const tags = splitTags(s.tags, 'tags');
    return tags.includes('Kana');
  });
}

function computeKanaHeadword(entry: DictionaryEntry): string | null {
  if (!isUsuallyKana(entry)) return null;

  if (entry.tag?.reading) return entry.tag.reading;

  if (entry.furigana.length > 0) {
    let result = entry.term;
    const kanjiEntries = entry.furigana.filter(f => f.kanji);
    for (let i = kanjiEntries.length - 1; i >= 0; i--) {
      const f = kanjiEntries[i];
      const idx = result.lastIndexOf(f.kanji);
      if (idx >= 0) {
        result = result.slice(0, idx) + f.furigana + result.slice(idx + f.kanji.length);
      }
    }
    if (result !== entry.term) return result;
  }

  const kanaOnly = entry.alternateForms.find(
    (af) => /^[\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FFー]+$/.test(af)
  );
  return kanaOnly ?? null;
}

// ---------------------------------------------------------------------------
// Ruby-style headword
// ---------------------------------------------------------------------------

type HeadwordSegment =
  | { type: 'ruby'; kanji: string; furigana: string }
  | { type: 'kana'; text: string };

function buildHeadwordSegments(
  term: string,
  furigana: { kanji: string; furigana: string }[],
): HeadwordSegment[] {
  const segments: HeadwordSegment[] = [];
  const kanjiEntries = furigana.filter(f => f.kanji);

  if (kanjiEntries.length === 0) {
    return [{ type: 'kana', text: term }];
  }

  let remaining = term;
  for (const f of kanjiEntries) {
    const idx = remaining.indexOf(f.kanji);
    if (idx < 0) continue;
    if (idx > 0) segments.push({ type: 'kana', text: remaining.slice(0, idx) });
    segments.push({ type: 'ruby', kanji: f.kanji, furigana: f.furigana });
    remaining = remaining.slice(idx + f.kanji.length);
  }
  if (remaining.length > 0) segments.push({ type: 'kana', text: remaining });
  return segments;
}

function RubyHeadword({
  term,
  furigana,
  textColor,
  rubyColor,
}: {
  term: string;
  furigana: { kanji: string; furigana: string }[];
  textColor: string;
  rubyColor: string;
}) {
  const segments = buildHeadwordSegments(term, furigana);
  return (
    <View style={styles.rubyContainer}>
      {segments.map((seg, i) =>
        seg.type === 'ruby' ? (
          <View key={i} style={styles.rubyPair}>
            <Text style={[styles.rubyAnnotation, { color: rubyColor }]} numberOfLines={1}>
              {seg.furigana}
            </Text>
            <Text style={[styles.rubyBase, { color: textColor }]}>{seg.kanji}</Text>
          </View>
        ) : (
          <View key={i} style={styles.rubyPair}>
            <Text style={styles.rubyAnnotation} numberOfLines={1}>{' '}</Text>
            <Text style={[styles.rubyBase, { color: textColor }]}>{seg.text}</Text>
          </View>
        )
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Pitch accent visual display
// ---------------------------------------------------------------------------

/** Parse a single pitch accent string like "か↱で↴んみん" into segments. */
function parsePitchAccent(accent: string): Array<{ text: string; high: boolean }> {
  const segments: Array<{ text: string; high: boolean }> = [];

  // Find the first arrow to determine the initial pitch level
  const firstArrow = accent.match(/[↱↴]/)?.[0];
  // Before a ↱ (rising) the first mora is low; before a ↴ (falling) it is high
  let isHigh = firstArrow === '↴';

  // Split around arrows, keeping track of pitch changes
  let buffer = '';
  for (const ch of accent) {
    if (ch === '↱') {
      if (buffer) segments.push({ text: buffer, high: isHigh });
      buffer = '';
      isHigh = true;
    } else if (ch === '↴') {
      if (buffer) segments.push({ text: buffer, high: isHigh });
      buffer = '';
      isHigh = false;
    } else {
      buffer += ch;
    }
  }
  if (buffer) segments.push({ text: buffer, high: isHigh });
  return segments;
}

const PITCH_HIGH_COLOR = '#e8687b';
const PITCH_LOW_COLOR = '#4d79ff';

/** Pitch accent display with gradient transitions. */
function PitchAccentDisplay({
  pitchAccents,
  colors,
  isDark,
}: {
  pitchAccents: string[];
  colors: { text: string; textSecondary: string; background: string };
  isDark: boolean;
}) {
  if (!pitchAccents || pitchAccents.length === 0) return null;

  // Deduplicate patterns (some entries have duplicate rows)
  const uniquePatterns: string[] = [];
  const seen = new Set<string>();
  for (const line of pitchAccents) {
    for (const p of line.split(',').map(s => s.trim()).filter(Boolean)) {
      if (!seen.has(p)) {
        seen.add(p);
        uniquePatterns.push(p);
      }
    }
  }

  return (
    <View style={pitchStyles.container}>
      {uniquePatterns.map((accent, pi) => {
        const segments = parsePitchAccent(accent);
        if (segments.length === 0) return null;

        const elements: React.ReactNode[] = [];
        for (let si = 0; si < segments.length; si++) {
          const seg = segments[si];
          const isHigh = seg.high;
          const isFirst = si === 0;
          const isLast = si === segments.length - 1;
          const prevHigh = si > 0 ? segments[si - 1].high : undefined;
          const pitchChanges = prevHigh !== undefined && prevHigh !== isHigh;

          // Insert gradient connector at pitch transitions
          if (pitchChanges) {
            const goingDown = prevHigh === true && !isHigh;
            elements.push(
              <LinearGradient
                key={`grad-${si}`}
                colors={[PITCH_HIGH_COLOR, PITCH_LOW_COLOR]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={pitchStyles.gradientConnector}
              />,
            );
          }

          elements.push(
            <View
              key={`seg-${si}`}
              style={[
                pitchStyles.block,
                {
                  borderTopWidth: isHigh ? 2.5 : 0,
                  borderTopColor: isHigh ? PITCH_HIGH_COLOR : 'transparent',
                  borderBottomWidth: isHigh ? 0 : 2.5,
                  borderBottomColor: isHigh ? 'transparent' : PITCH_LOW_COLOR,
                  backgroundColor: isDark
                    ? isHigh ? 'rgba(232,104,123,0.10)' : 'rgba(77,121,255,0.10)'
                    : isHigh ? 'rgba(232,104,123,0.06)' : 'rgba(77,121,255,0.06)',
                },
                isFirst ? { borderTopLeftRadius: 5, borderBottomLeftRadius: 5 } : null,
                isLast ? { borderTopRightRadius: 5, borderBottomRightRadius: 5 } : null,
              ]}
            >
              <Text style={[pitchStyles.blockText, { color: colors.text }]}>
                {seg.text}
              </Text>
            </View>,
          );
        }

        return (
          <View key={pi} style={pitchStyles.patternRow}>
            {elements}
          </View>
        );
      })}
    </View>
  );
}

const pitchStyles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 4,
  },
  patternRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  block: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 0,
    borderColor: 'transparent',
  },
  gradientConnector: {
    width: 2.5,
  },
  blockText: {
    fontSize: 18,
    fontWeight: '500',
  },
});

// ---------------------------------------------------------------------------
// Kanji extraction helper
// ---------------------------------------------------------------------------

/**
 * Extract unique kanji characters from a string, preserving order.
 * Covers CJK Unified Ideographs (U+4E00–U+9FFF) and Extension A (U+3400–U+4DBF).
 */
function extractKanji(text: string): string[] {
  const kanji: string[] = [];
  const seen = new Set<string>();
  for (const char of text) {
    const cp = char.codePointAt(0) ?? 0;
    if ((cp >= 0x4E00 && cp <= 0x9FFF) || (cp >= 0x3400 && cp <= 0x4DBF)) {
      if (!seen.has(char)) {
        seen.add(char);
        kanji.push(char);
      }
    }
  }
  return kanji;
}

// ---------------------------------------------------------------------------
// Single entry page (rendered inside the pager)
// ---------------------------------------------------------------------------

function EntryPage({
  loaded,
  pageWidth,
  colors,
  isDark,
}: {
  loaded: LoadedEntry;
  pageWidth: number;
  colors: { text: string; textSecondary: string; tint: string; background: string };
  isDark: boolean;
}) {
  const { entry, originalForm, deinflectionRules } = loaded;
  const senseHeaders = useMemo(() => buildSenseHeaders(entry.senses), [entry]);
  const kanaHW = useMemo(() => computeKanaHeadword(entry), [entry]);

  // Alternate forms: if kana headword, prepend kanji term and remove kana
  const altForms = useMemo(() => {
    if (kanaHW) {
      return [entry.term, ...entry.alternateForms.filter(af => af !== kanaHW)];
    }
    return entry.alternateForms;
  }, [entry, kanaHW]);

  // Example sentences
  const [sentences, setSentences] = useState<ExampleSentence[]>([]);
  useEffect(() => {
    fetchSentences(entry.id, 5).then(setSentences).catch(() => {});
  }, [entry.id]);

  // Kanji used in headword
  const headwordKanji = useMemo(() => extractKanji(entry.term), [entry.term]);
  const [kanjiMeanings, setKanjiMeanings] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    console.log(`[Kanji] term="${entry.term}" extracted=[${headwordKanji.join(',')}] count=${headwordKanji.length}`);
    if (headwordKanji.length > 0) {
      lookupKanjiBatch(headwordKanji)
        .then((m) => {
          console.log(`[Kanji] batch resolved, size=${m.size}`);
          setKanjiMeanings(m);
        })
        .catch((err) => {
          console.log(`[Kanji] batch ERROR: ${err}`);
        });
    }
  }, [headwordKanji]);

  return (
    <ScrollView
      style={{ width: pageWidth }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      {/* ── Headword ────────────────────────────── */}
      <View style={styles.headwordSection}>
        {kanaHW ? (
          <Text style={[styles.headword, { color: colors.text }]}>{kanaHW}</Text>
        ) : entry.furigana.length > 0 && entry.furigana.some(f => f.kanji) ? (
          <RubyHeadword
            term={entry.term}
            furigana={entry.furigana}
            textColor={colors.text}
            rubyColor={colors.textSecondary}
          />
        ) : (
          <Text style={[styles.headword, { color: colors.text }]}>{entry.term}</Text>
        )}
      </View>

      {/* ── Deinflection annotation ─────────────── */}
      {originalForm && deinflectionRules && deinflectionRules.length > 0 && (
        <View style={styles.deinflectionSection}>
          <Text style={[styles.deinflectionText, { color: colors.textSecondary }]}>
            {originalForm}
            {'  '}
            <Text style={styles.deinflectionRule}>
              {deinflectionRules.join(' + ')}
            </Text>
          </Text>
        </View>
      )}

      {/* ── Tags / Frequency ────────────────────── */}
      {entry.tag && entry.tag.tags ? (
        <View style={styles.tagsSection}>
          <View style={styles.tagChips}>
            {entry.tag.tags.split(',').map((t, j) => {
              const tagStyle = getTagStyle(t);
              return (
                <View
                  key={j}
                  style={[
                    styles.tagChip,
                    tagStyle
                      ? { backgroundColor: tagStyle.backgroundColor }
                      : {
                          backgroundColor: isDark
                            ? 'rgba(255,255,255,0.1)'
                            : 'rgba(0,0,0,0.06)',
                        },
                  ]}
                >
                  <Text
                    style={[
                      styles.tagChipText,
                      { color: tagStyle ? tagStyle.color : colors.textSecondary },
                    ]}
                  >
                    {t.trim()}
                  </Text>
                </View>
              );
            })}
          </View>
          {entry.tag.originLanguage ? (
            <Text style={[styles.originLang, { color: colors.textSecondary }]}>
              Origin: {entry.tag.originLanguage}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* ── Definitions ─────────────────────────── */}
      {entry.senses.length > 0 && senseHeaders && (
        <View style={styles.sensesSection}>
          {senseHeaders.commonHeader ? (
            <Text style={[styles.commonPosHeader, { color: colors.tint }]}>
              {senseHeaders.commonHeader}
            </Text>
          ) : null}

          {entry.senses.map((sense, i) => {
            const header = senseHeaders.perSense[i];
            return (
              <View key={sense.senseNumber} style={styles.senseRow}>
                <Text style={[styles.senseNumber, { color: colors.textSecondary }]}>
                  {sense.senseNumber}.
                </Text>
                <View style={styles.senseContent}>
                  {header ? (
                    <Text style={[styles.pos, { color: colors.tint }]}>{header}</Text>
                  ) : null}
                  <Text style={[styles.gloss, { color: colors.text }]}>
                    {sense.glosses.join('; ')}
                  </Text>
                  {sense.notes.length > 0 &&
                    sense.notes.map((n, ni) => (
                      <Text
                        key={ni}
                        style={[styles.noteText, { color: colors.textSecondary }]}
                      >
                        {n.type === 'note' ? '※ ' : ''}{n.note}
                      </Text>
                    ))}
                  {sense.links.length > 0 &&
                    sense.links.map((l, li) => (
                      <Text
                        key={li}
                        style={[styles.linkText, { color: colors.textSecondary }]}
                      >
                        → {l.type}: {l.link}
                      </Text>
                    ))}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Alternate Forms ─────────────────────── */}
      {altForms.length > 0 && (
        <View style={styles.altSection}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            Alternate Forms
          </Text>
          <Text style={[styles.altForms, { color: colors.text }]}>
            {altForms.join('、')}
          </Text>
        </View>
      )}

      {/* ── Kanji Used ──────────────────────────── */}
      {headwordKanji.length > 0 && kanjiMeanings.size > 0 && (
        <View style={styles.kanjiSection}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            Kanji Used
          </Text>
          {headwordKanji.map((k) => {
            const meaning = kanjiMeanings.get(k);
            if (!meaning) return null;
            return (
              <View key={k} style={styles.kanjiRow}>
                <Text style={[styles.kanjiChar, { color: colors.text }]}>{k}</Text>
                <Text style={[styles.kanjiMeaning, { color: colors.textSecondary }]}>
                  {meaning}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Pitch Accent ────────────────────────── */}
      {entry.pitchAccent.length > 0 && (
        <View style={styles.pitchSection}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            Pitch Accent
          </Text>
          <PitchAccentDisplay
            pitchAccents={entry.pitchAccent}
            colors={colors}
            isDark={isDark}
          />
        </View>
      )}

      {/* ── Example Sentences ──────────────────────── */}
      {sentences.length > 0 && (
        <View style={styles.sentencesSection}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            Sentences
          </Text>
          {sentences.map((s, i) => (
            <View key={i} style={styles.sentenceItem}>
              <Text style={[styles.sentenceJa, { color: colors.text }]}>
                {s.sentence}
              </Text>
              {s.english ? (
                <Text style={[styles.sentenceEn, { color: colors.textSecondary }]}>
                  {s.english}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function DictionaryScreen() {
  const { term, matches: matchesParam } = useLocalSearchParams<{
    term: string;
    matches?: string;
  }>();
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const glassAvailable = isLiquidGlassAvailable();

  // Parse match metadata from route params
  const matchInfoList: MatchInfo[] = useMemo(() => {
    if (matchesParam) {
      try {
        return JSON.parse(decodeURIComponent(matchesParam));
      } catch { /* fall through */ }
    }
    return [];
  }, [matchesParam]);

  const [loadedEntries, setLoadedEntries] = useState<LoadedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageWidth, setPageWidth] = useState(0);
  const flatListRef = useRef<FlatList<LoadedEntry>>(null);

  // Load all entries on mount
  useEffect(() => {
    async function load() {
      try {
        if (matchInfoList.length > 0) {
          // New multi-match flow: load each entry by ID
          const loaded: LoadedEntry[] = [];
          for (const info of matchInfoList) {
            const entry = await lookupWordById(info.id);
            if (entry) {
              loaded.push({
                entry,
                originalForm: info.original,
                deinflectionRules: info.rules,
              });
            }
          }
          setLoadedEntries(loaded);
        } else if (term) {
          // Legacy single-entry flow (backward compat)
          const decodedTerm = decodeURIComponent(term);
          const entry = await lookupWord(decodedTerm);
          if (entry) {
            setLoadedEntries([{ entry }]);
          }
        }
      } catch {
        // lookup failed silently
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [matchInfoList, term]);

  const handleDismiss = useCallback(() => {
    notifyDictionaryDismissed();
    router.back();
  }, [router]);

  useEffect(() => {
    return () => { notifyDictionaryDismissed(); };
  }, []);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pageWidth <= 0) return;
      const page = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
      setCurrentPage(page);
    },
    [pageWidth]
  );

  const renderPage = useCallback(
    ({ item }: ListRenderItemInfo<LoadedEntry>) => (
      <EntryPage
        loaded={item}
        pageWidth={pageWidth}
        colors={colors}
        isDark={isDark}
      />
    ),
    [pageWidth, colors, isDark]
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: pageWidth,
      offset: pageWidth * index,
      index,
    }),
    [pageWidth]
  );

  const keyExtractor = useCallback(
    (item: LoadedEntry) => String(item.entry.id),
    []
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerLeft: () =>
            Platform.OS === 'ios' ? (
              <Pressable onPress={handleDismiss} hitSlop={12}>
                <Ionicons
                  name="close-outline"
                  size={36}
                  color={isDark ? '#FFFFFF' : '#8E8E93'}
                />
              </Pressable>
            ) : undefined,
        }}
      />
      <View
        style={{
          flex: 1,
          backgroundColor: glassAvailable ? 'transparent' : colors.background,
        }}
        onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}
      >
        {loading ? (
          <View style={styles.centered}>
            <Text style={{ color: colors.textSecondary }}>Loading...</Text>
          </View>
        ) : loadedEntries.length === 0 ? (
          <View style={styles.centered}>
            <Text style={[styles.noResult, { color: colors.textSecondary }]}>
              No entry found for &ldquo;{term ? decodeURIComponent(term) : ''}&rdquo;
            </Text>
          </View>
        ) : pageWidth > 0 ? (
          <>
            <FlatList
              ref={flatListRef}
              data={loadedEntries}
              renderItem={renderPage}
              keyExtractor={keyExtractor}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              getItemLayout={getItemLayout}
              bounces={false}
              overScrollMode="never"
            />

            {/* ── Page indicator dots ────────────────────── */}
            {loadedEntries.length > 1 && (
              <View style={styles.pageDotsContainer} pointerEvents="none">
                {loadedEntries.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.pageDot,
                      {
                        backgroundColor:
                          i === currentPage
                            ? isDark ? '#FFFFFF' : '#000000'
                            : isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)',
                      },
                    ]}
                  />
                ))}
              </View>
            )}
          </>
        ) : null}
      </View>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  noResult: {
    fontSize: 16,
  },
  // ── Headword ──
  headwordSection: {
    marginBottom: 16,
  },
  headword: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: 1,
  },
  // Ruby furigana layout
  rubyContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  rubyPair: {
    alignItems: 'center',
  },
  rubyAnnotation: {
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
  },
  rubyBase: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: 1,
    lineHeight: 42,
  },
  readingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  readingText: {
    fontSize: 16,
  },
  // ── Deinflection ──
  deinflectionSection: {
    marginBottom: 12,
    marginTop: -8,
  },
  deinflectionText: {
    fontSize: 15,
  },
  deinflectionRule: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  // ── Tags ──
  tagsSection: {
    marginBottom: 16,
  },
  tagChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  originLang: {
    fontSize: 13,
    marginTop: 6,
  },
  // ── Senses ──
  sensesSection: {
    marginBottom: 16,
  },
  commonPosHeader: {
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  senseRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  senseNumber: {
    fontSize: 15,
    fontWeight: '600',
    width: 24,
    fontVariant: ['tabular-nums'],
  },
  senseContent: {
    flex: 1,
  },
  pos: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  gloss: {
    fontSize: 16,
    lineHeight: 22,
  },
  noteText: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  linkText: {
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18,
  },
  // ── Alternate Forms ──
  altSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  altForms: {
    fontSize: 16,
  },
  // ── Pitch Accent ──
  pitchSection: {
    marginBottom: 16,
  },
  // ── Example Sentences ──
  sentencesSection: {
    marginBottom: 16,
  },
  sentenceItem: {
    marginBottom: 20,
  },
  sentenceJa: {
    fontSize: 20,
    lineHeight: 30,
  },
  sentenceEn: {
    fontSize: 16,
    lineHeight: 23,
    marginTop: 3,
  },
  // ── Kanji Used ──
  kanjiSection: {
    marginBottom: 16,
  },
  kanjiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  kanjiChar: {
    fontSize: 32,
    fontWeight: '700',
    width: 36,
    textAlign: 'center',
  },
  kanjiMeaning: {
    fontSize: 16,
    lineHeight: 20,
    flex: 1,
  },
  // ── Page indicator dots ──
  pageDotsContainer: {
    position: 'absolute',
    bottom: -28,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  pageDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});
