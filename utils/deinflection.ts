/**
 * Japanese deinflection engine.
 *
 * Reverses verb and adjective conjugations to recover dictionary forms.
 * Closely follows Yomitan's suffix-based transformation system:
 *
 * 1. Rules are stored in a Map keyed by inflected suffix for O(1) lookup.
 * 2. `deinflect(word)` always returns the ORIGINAL word first (with no
 *    POS conditions) followed by all deinflected candidates.
 * 3. Each candidate carries POS conditions that the caller validates
 *    against the dictionary entry's part-of-speech.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single suffix transformation rule. */
interface DeinflectionRule {
  /** The conjugated ending (e.g., "って") */
  inflectedSuffix: string;
  /** The dictionary form ending (e.g., "う") */
  dictionarySuffix: string;
  /**
   * POS conditions the dictionary entry must satisfy.
   * Empty array means the rule applies to any POS.
   * Values: v1, v5, vs, vk, adj-i
   */
  conditionsOut: string[];
  /** Human-readable name of the conjugation (e.g., "te-form") */
  name: string;
}

/** Result of deinflecting a single word. */
export interface DeinflectionResult {
  /** The candidate dictionary form */
  term: string;
  /** Human-readable rule name, e.g. "te-form".  "original" for the unchanged word. */
  ruleName: string;
  /** Human-readable rule names as array (for display) */
  rules: string[];
  /** POS conditions the dictionary entry should satisfy (empty = any) */
  conditions: string[];
}

// ---------------------------------------------------------------------------
// Mapping from internal condition tags to DB POS abbreviations
// ---------------------------------------------------------------------------

/**
 * Maps deinflection condition tags to the POS abbreviations used in
 * the dictionary's `senses.pos` column.
 */
export const CONDITION_TO_POS: Record<string, string[]> = {
  v1: ['V1', 'V1Kre'],
  v5: ['V5', 'V5Irr', 'V5Sp'],
  vs: ['Vsur'],
  vk: ['VIrr'],
  'adj-i': ['AdjI', 'AdjI2'],
};

/** Max number of consecutive suffix transformations when chaining. */
const MAX_CHAIN_DEPTH = 6;

// ---------------------------------------------------------------------------
// Deinflector (Map-based, matches Yomitan's SimpleDeinflector pattern)
// ---------------------------------------------------------------------------

/**
 * Stores rules in a Map<suffix, Rule[]> for efficient suffix lookup.
 * Matches the architecture of Yomitan's SimpleDeinflector class.
 */
class Deinflector {
  private rules: Map<string, DeinflectionRule[]>;

  constructor() {
    this.rules = new Map();
    this.initializeRules();
  }

  /** Register a deinflection rule. */
  private addRule(rule: DeinflectionRule): void {
    const suffix = rule.inflectedSuffix;
    if (!this.rules.has(suffix)) {
      this.rules.set(suffix, []);
    }
    this.rules.get(suffix)!.push(rule);
  }

  /** Shorthand for adding a rule. */
  private add(
    inflected: string,
    dictionary: string,
    conditionsOut: string[],
    name: string,
  ): void {
    this.addRule({
      inflectedSuffix: inflected,
      dictionarySuffix: dictionary,
      conditionsOut,
      name,
    });
  }

  /**
   * Single-step deinflection: apply every matching suffix rule once.
   * Returns an array of (resulting term, applied rule) pairs.
   */
  private deinflectOneStep(
    word: string,
  ): Array<{ term: string; rule: DeinflectionRule }> {
    const out: Array<{ term: string; rule: DeinflectionRule }> = [];
    for (const [suffix, rules] of this.rules.entries()) {
      if (!word.endsWith(suffix)) continue;
      const stem = word.slice(0, -suffix.length);
      if (stem.length === 0) continue;
      for (const rule of rules) {
        out.push({ term: stem + rule.dictionarySuffix, rule });
      }
    }
    return out;
  }

  /**
   * Deinflect a word by iteratively chaining suffix rules (BFS up to
   * MAX_CHAIN_DEPTH steps).  This allows multi-layer conjugated forms
   * like できなくて (negative te-form of できる) or 思わせられている
   * (causative + passive + progressive of 思う) to reach their
   * dictionary form.
   *
   * Always returns the original word first (conditions=[]), followed by
   * all reachable deinflected candidates ordered breadth-first (shallowest
   * first).  Each candidate's `conditions` are those of the LAST rule in
   * its chain — the caller uses these for POS validation.
   */
  public deinflect(word: string): DeinflectionResult[] {
    const results: DeinflectionResult[] = [];
    const seenTerms = new Set<string>([word]);

    // Original word is always the first candidate
    results.push({
      term: word,
      ruleName: 'original',
      rules: [],
      conditions: [],
    });

    // BFS queue items: (current term, accumulated rule names, last-step conditions)
    type QItem = { term: string; rules: string[]; conditions: string[] };
    let queue: QItem[] = [{ term: word, rules: [], conditions: [] }];

    for (let depth = 0; depth < MAX_CHAIN_DEPTH && queue.length > 0; depth++) {
      const nextQueue: QItem[] = [];
      for (const item of queue) {
        const oneStep = this.deinflectOneStep(item.term);
        for (const { term: nextTerm, rule } of oneStep) {
          if (seenTerms.has(nextTerm)) continue;
          seenTerms.add(nextTerm);
          const rules = [...item.rules, rule.name];
          const result: DeinflectionResult = {
            term: nextTerm,
            ruleName: rules.join(' + '),
            rules,
            conditions: rule.conditionsOut,
          };
          results.push(result);
          nextQueue.push({ term: nextTerm, rules, conditions: rule.conditionsOut });
        }
      }
      queue = nextQueue;
    }

    return results;
  }

  /**
   * Initialize all conjugation rules.
   *
   * Comprehensive coverage matching Yomitan's deinflection system:
   *
   * BASIC: te, ta, tari, masu, negative, negative past
   * POLITE: masu past, polite negative, polite past negative, polite volitional
   * CONDITIONAL: ba, tara, ba-contraction (ゃ)
   * VOICE: passive, causative, short causative, potential, causative-passive
   * VOLITIONAL: standard, polite (ましょう), adjective (かろう), negative (まい), slang (よっか)
   * IMPERATIVE: godan (え-row), ichidan (ろ/よ), irregular, polite (なさい), negative slang (んな)
   * TAI: desire form (たい)
   * ADJECTIVE: past, negative, te, conditional, adverbial (く), nominalization (さ),
   *            がる, げ, archaic き, volitional かろう, slang vowel changes
   * PROGRESSIVE: ている/てる, ていた, ておる/とる
   * AUXILIARY: そう, すぎる, ておく/とく
   * CONTRACTIONS: てしまう/てしまった, ちゃう/ちゃった, ちまう/ちまった, ちゃ (ては)
   * COMPOUND: passive+te, passive+progressive, passive+past, causative+te, causative+past
   * CLASSICAL: ず, ぬ, ん, ざる, ねば, む, んばかり, んとする
   * SLANG: ねえ negative, n-slang (んない), vowel changes (ai→ee, oi→ee, ui→ii)
   * KANSAI: へん, ひん, うて, うた, うたら, うたり
   */
  private initializeRules(): void {
    // ── Compound: ~ている progressive ────────────────────────────
    this.add('っている', 'う', ['v5'], 'progressive');
    this.add('っている', 'つ', ['v5'], 'progressive');
    this.add('っている', 'る', ['v5'], 'progressive');
    this.add('いている', 'く', ['v5'], 'progressive');
    this.add('いでいる', 'ぐ', ['v5'], 'progressive');
    this.add('している', 'す', ['v5'], 'progressive');
    this.add('している', 'する', ['vs'], 'progressive');
    this.add('んでいる', 'ぬ', ['v5'], 'progressive');
    this.add('んでいる', 'ぶ', ['v5'], 'progressive');
    this.add('んでいる', 'む', ['v5'], 'progressive');
    this.add('ている', 'る', ['v1'], 'progressive');
    this.add('きている', 'くる', ['vk'], 'progressive');

    // ── Compound: ~てる contracted progressive ───────────────────
    this.add('ってる', 'う', ['v5'], 'progressive');
    this.add('ってる', 'つ', ['v5'], 'progressive');
    this.add('ってる', 'る', ['v5'], 'progressive');
    this.add('いてる', 'く', ['v5'], 'progressive');
    this.add('いでる', 'ぐ', ['v5'], 'progressive');
    this.add('してる', 'す', ['v5'], 'progressive');
    this.add('してる', 'する', ['vs'], 'progressive');
    this.add('んでる', 'ぬ', ['v5'], 'progressive');
    this.add('んでる', 'ぶ', ['v5'], 'progressive');
    this.add('んでる', 'む', ['v5'], 'progressive');
    this.add('てる', 'る', ['v1'], 'progressive');
    this.add('きてる', 'くる', ['vk'], 'progressive');

    // ── Compound: ~ていた past progressive ───────────────────────
    this.add('っていた', 'う', ['v5'], 'past progressive');
    this.add('っていた', 'つ', ['v5'], 'past progressive');
    this.add('っていた', 'る', ['v5'], 'past progressive');
    this.add('いていた', 'く', ['v5'], 'past progressive');
    this.add('いでいた', 'ぐ', ['v5'], 'past progressive');
    this.add('していた', 'す', ['v5'], 'past progressive');
    this.add('していた', 'する', ['vs'], 'past progressive');
    this.add('んでいた', 'ぬ', ['v5'], 'past progressive');
    this.add('んでいた', 'ぶ', ['v5'], 'past progressive');
    this.add('んでいた', 'む', ['v5'], 'past progressive');
    this.add('ていた', 'る', ['v1'], 'past progressive');
    this.add('きていた', 'くる', ['vk'], 'past progressive');

    // ── Compound: ~なかった negative past ────────────────────────
    this.add('わなかった', 'う', ['v5'], 'negative past');
    this.add('かなかった', 'く', ['v5'], 'negative past');
    this.add('がなかった', 'ぐ', ['v5'], 'negative past');
    this.add('さなかった', 'す', ['v5'], 'negative past');
    this.add('たなかった', 'つ', ['v5'], 'negative past');
    this.add('ななかった', 'ぬ', ['v5'], 'negative past');
    this.add('ばなかった', 'ぶ', ['v5'], 'negative past');
    this.add('まなかった', 'む', ['v5'], 'negative past');
    this.add('らなかった', 'る', ['v5'], 'negative past');
    this.add('なかった', 'る', ['v1'], 'negative past');
    this.add('しなかった', 'する', ['vs'], 'negative past');
    this.add('こなかった', 'くる', ['vk'], 'negative past');
    this.add('くなかった', 'い', ['adj-i'], 'negative past');

    // ── Te-form (～て / ～で) ────────────────────────────────────
    this.add('って', 'う', ['v5'], 'te-form');
    this.add('って', 'つ', ['v5'], 'te-form');
    this.add('って', 'る', ['v5'], 'te-form');
    this.add('いて', 'く', ['v5'], 'te-form');
    this.add('いで', 'ぐ', ['v5'], 'te-form');
    this.add('して', 'す', ['v5'], 'te-form');
    this.add('して', 'する', ['vs'], 'te-form');
    this.add('んで', 'ぬ', ['v5'], 'te-form');
    this.add('んで', 'ぶ', ['v5'], 'te-form');
    this.add('んで', 'む', ['v5'], 'te-form');
    this.add('て', 'る', ['v1'], 'te-form');
    this.add('きて', 'くる', ['vk'], 'te-form');
    // Special: 行って -> 行く
    this.add('って', 'く', ['v5'], 'te-form');

    // ── Ta-form / past (～た / ～だ) ─────────────────────────────
    this.add('った', 'う', ['v5'], 'past');
    this.add('った', 'つ', ['v5'], 'past');
    this.add('った', 'る', ['v5'], 'past');
    this.add('いた', 'く', ['v5'], 'past');
    this.add('いだ', 'ぐ', ['v5'], 'past');
    this.add('した', 'す', ['v5'], 'past');
    this.add('した', 'する', ['vs'], 'past');
    this.add('んだ', 'ぬ', ['v5'], 'past');
    this.add('んだ', 'ぶ', ['v5'], 'past');
    this.add('んだ', 'む', ['v5'], 'past');
    this.add('た', 'る', ['v1'], 'past');
    this.add('きた', 'くる', ['vk'], 'past');
    // Special: 行った -> 行く
    this.add('った', 'く', ['v5'], 'past');

    // ── Masu-form (～ます) ───────────────────────────────────────
    this.add('います', 'う', ['v5'], 'masu-form');
    this.add('きます', 'く', ['v5'], 'masu-form');
    this.add('ぎます', 'ぐ', ['v5'], 'masu-form');
    this.add('します', 'す', ['v5'], 'masu-form');
    this.add('します', 'する', ['vs'], 'masu-form');
    this.add('ちます', 'つ', ['v5'], 'masu-form');
    this.add('にます', 'ぬ', ['v5'], 'masu-form');
    this.add('びます', 'ぶ', ['v5'], 'masu-form');
    this.add('みます', 'む', ['v5'], 'masu-form');
    this.add('ります', 'る', ['v5'], 'masu-form');
    this.add('ます', 'る', ['v1'], 'masu-form');
    this.add('きます', 'くる', ['vk'], 'masu-form');

    // ── Negative (～ない) ────────────────────────────────────────
    this.add('わない', 'う', ['v5'], 'negative');
    this.add('かない', 'く', ['v5'], 'negative');
    this.add('がない', 'ぐ', ['v5'], 'negative');
    this.add('さない', 'す', ['v5'], 'negative');
    this.add('たない', 'つ', ['v5'], 'negative');
    this.add('なない', 'ぬ', ['v5'], 'negative');
    this.add('ばない', 'ぶ', ['v5'], 'negative');
    this.add('まない', 'む', ['v5'], 'negative');
    this.add('らない', 'る', ['v5'], 'negative');
    this.add('ない', 'る', ['v1'], 'negative');
    this.add('しない', 'する', ['vs'], 'negative');
    this.add('こない', 'くる', ['vk'], 'negative');

    // ── Passive (～れる / ～られる) ───────────────────────────────
    this.add('われる', 'う', ['v5'], 'passive');
    this.add('かれる', 'く', ['v5'], 'passive');
    this.add('がれる', 'ぐ', ['v5'], 'passive');
    this.add('される', 'す', ['v5'], 'passive');
    this.add('される', 'する', ['vs'], 'passive');
    this.add('たれる', 'つ', ['v5'], 'passive');
    this.add('なれる', 'ぬ', ['v5'], 'passive');
    this.add('ばれる', 'ぶ', ['v5'], 'passive');
    this.add('まれる', 'む', ['v5'], 'passive');
    this.add('られる', 'る', ['v5'], 'passive');
    this.add('られる', 'る', ['v1'], 'passive');
    this.add('こられる', 'くる', ['vk'], 'passive');

    // ── Causative (～せる / ～させる) ─────────────────────────────
    this.add('わせる', 'う', ['v5'], 'causative');
    this.add('かせる', 'く', ['v5'], 'causative');
    this.add('がせる', 'ぐ', ['v5'], 'causative');
    this.add('させる', 'す', ['v5'], 'causative');
    this.add('させる', 'する', ['vs'], 'causative');
    this.add('たせる', 'つ', ['v5'], 'causative');
    this.add('なせる', 'ぬ', ['v5'], 'causative');
    this.add('ばせる', 'ぶ', ['v5'], 'causative');
    this.add('ませる', 'む', ['v5'], 'causative');
    this.add('らせる', 'る', ['v5'], 'causative');
    this.add('させる', 'る', ['v1'], 'causative');
    this.add('こさせる', 'くる', ['vk'], 'causative');

    // ── Potential (～える / ～られる) ─────────────────────────────
    this.add('える', 'う', ['v5'], 'potential');
    this.add('ける', 'く', ['v5'], 'potential');
    this.add('げる', 'ぐ', ['v5'], 'potential');
    this.add('せる', 'す', ['v5'], 'potential');
    this.add('てる', 'つ', ['v5'], 'potential');
    this.add('ねる', 'ぬ', ['v5'], 'potential');
    this.add('べる', 'ぶ', ['v5'], 'potential');
    this.add('める', 'む', ['v5'], 'potential');
    this.add('れる', 'る', ['v5'], 'potential');
    this.add('できる', 'する', ['vs'], 'potential');
    this.add('こられる', 'くる', ['vk'], 'potential');
    // Colloquial ichidan potential: ~れる
    this.add('れる', 'る', ['v1'], 'potential');

    // ── Conditional (～ば) ───────────────────────────────────────
    this.add('えば', 'う', ['v5'], 'conditional');
    this.add('けば', 'く', ['v5'], 'conditional');
    this.add('げば', 'ぐ', ['v5'], 'conditional');
    this.add('せば', 'す', ['v5'], 'conditional');
    this.add('てば', 'つ', ['v5'], 'conditional');
    this.add('ねば', 'ぬ', ['v5'], 'conditional');
    this.add('べば', 'ぶ', ['v5'], 'conditional');
    this.add('めば', 'む', ['v5'], 'conditional');
    this.add('れば', 'る', ['v5'], 'conditional');
    this.add('れば', 'る', ['v1'], 'conditional');
    this.add('すれば', 'する', ['vs'], 'conditional');
    this.add('くれば', 'くる', ['vk'], 'conditional');
    this.add('ければ', 'い', ['adj-i'], 'conditional');

    // ── Conditional ~たら ────────────────────────────────────────
    this.add('ったら', 'う', ['v5'], 'tara-conditional');
    this.add('ったら', 'つ', ['v5'], 'tara-conditional');
    this.add('ったら', 'る', ['v5'], 'tara-conditional');
    this.add('いたら', 'く', ['v5'], 'tara-conditional');
    this.add('いだら', 'ぐ', ['v5'], 'tara-conditional');
    this.add('したら', 'す', ['v5'], 'tara-conditional');
    this.add('したら', 'する', ['vs'], 'tara-conditional');
    this.add('んだら', 'ぬ', ['v5'], 'tara-conditional');
    this.add('んだら', 'ぶ', ['v5'], 'tara-conditional');
    this.add('んだら', 'む', ['v5'], 'tara-conditional');
    this.add('たら', 'る', ['v1'], 'tara-conditional');
    this.add('きたら', 'くる', ['vk'], 'tara-conditional');
    this.add('かったら', 'い', ['adj-i'], 'tara-conditional');
    // Special: 行ったら -> 行く
    this.add('ったら', 'く', ['v5'], 'tara-conditional');

    // ── Volitional (～おう / ～よう) ─────────────────────────────
    this.add('おう', 'う', ['v5'], 'volitional');
    this.add('こう', 'く', ['v5'], 'volitional');
    this.add('ごう', 'ぐ', ['v5'], 'volitional');
    this.add('そう', 'す', ['v5'], 'volitional');
    this.add('とう', 'つ', ['v5'], 'volitional');
    this.add('のう', 'ぬ', ['v5'], 'volitional');
    this.add('ぼう', 'ぶ', ['v5'], 'volitional');
    this.add('もう', 'む', ['v5'], 'volitional');
    this.add('ろう', 'る', ['v5'], 'volitional');
    this.add('よう', 'る', ['v1'], 'volitional');
    this.add('しよう', 'する', ['vs'], 'volitional');
    this.add('こよう', 'くる', ['vk'], 'volitional');

    // ── Tai-form (～たい) ────────────────────────────────────────
    this.add('いたい', 'う', ['v5'], 'tai-form');
    this.add('きたい', 'く', ['v5'], 'tai-form');
    this.add('ぎたい', 'ぐ', ['v5'], 'tai-form');
    this.add('したい', 'す', ['v5'], 'tai-form');
    this.add('したい', 'する', ['vs'], 'tai-form');
    this.add('ちたい', 'つ', ['v5'], 'tai-form');
    this.add('にたい', 'ぬ', ['v5'], 'tai-form');
    this.add('びたい', 'ぶ', ['v5'], 'tai-form');
    this.add('みたい', 'む', ['v5'], 'tai-form');
    this.add('りたい', 'る', ['v5'], 'tai-form');
    this.add('たい', 'る', ['v1'], 'tai-form');
    this.add('きたい', 'くる', ['vk'], 'tai-form');

    // ── Imperative (～え / ～ろ / ～よ) ──────────────────────────
    // Godan: e-row imperative
    this.add('え', 'う', ['v5'], 'imperative');
    this.add('け', 'く', ['v5'], 'imperative');
    this.add('げ', 'ぐ', ['v5'], 'imperative');
    this.add('せ', 'す', ['v5'], 'imperative');
    this.add('て', 'つ', ['v5'], 'imperative');
    this.add('ね', 'ぬ', ['v5'], 'imperative');
    this.add('べ', 'ぶ', ['v5'], 'imperative');
    this.add('め', 'む', ['v5'], 'imperative');
    this.add('れ', 'る', ['v5'], 'imperative');
    // Ichidan: ろ/よ imperative
    this.add('ろ', 'る', ['v1'], 'imperative');
    this.add('よ', 'る', ['v1'], 'imperative');
    // Irregular
    this.add('しろ', 'する', ['vs'], 'imperative');
    this.add('せよ', 'する', ['vs'], 'imperative');
    this.add('こい', 'くる', ['vk'], 'imperative');

    // ── i-adjective conjugations ─────────────────────────────────
    this.add('かった', 'い', ['adj-i'], 'past');
    this.add('くない', 'い', ['adj-i'], 'negative');
    this.add('くて', 'い', ['adj-i'], 'te-form');
    this.add('ければ', 'い', ['adj-i'], 'conditional');

    // ── Polite negative (～ません) ───────────────────────────────
    this.add('いません', 'う', ['v5'], 'polite negative');
    this.add('きません', 'く', ['v5'], 'polite negative');
    this.add('ぎません', 'ぐ', ['v5'], 'polite negative');
    this.add('しません', 'す', ['v5'], 'polite negative');
    this.add('ちません', 'つ', ['v5'], 'polite negative');
    this.add('にません', 'ぬ', ['v5'], 'polite negative');
    this.add('びません', 'ぶ', ['v5'], 'polite negative');
    this.add('みません', 'む', ['v5'], 'polite negative');
    this.add('りません', 'る', ['v5'], 'polite negative');
    this.add('ません', 'る', ['v1'], 'polite negative');
    this.add('しません', 'する', ['vs'], 'polite negative');
    this.add('きません', 'くる', ['vk'], 'polite negative');

    // ── Compound: passive + progressive (~かれている etc.) ────────
    this.add('われている', 'う', ['v5'], 'passive progressive');
    this.add('かれている', 'く', ['v5'], 'passive progressive');
    this.add('がれている', 'ぐ', ['v5'], 'passive progressive');
    this.add('されている', 'す', ['v5'], 'passive progressive');
    this.add('されている', 'する', ['vs'], 'passive progressive');
    this.add('たれている', 'つ', ['v5'], 'passive progressive');
    this.add('なれている', 'ぬ', ['v5'], 'passive progressive');
    this.add('ばれている', 'ぶ', ['v5'], 'passive progressive');
    this.add('まれている', 'む', ['v5'], 'passive progressive');
    this.add('られている', 'る', ['v5'], 'passive progressive');
    this.add('られている', 'る', ['v1'], 'passive progressive');

    // ── Compound: passive + past progressive (~かれていた etc.) ───
    this.add('われていた', 'う', ['v5'], 'passive past progressive');
    this.add('かれていた', 'く', ['v5'], 'passive past progressive');
    this.add('がれていた', 'ぐ', ['v5'], 'passive past progressive');
    this.add('されていた', 'す', ['v5'], 'passive past progressive');
    this.add('されていた', 'する', ['vs'], 'passive past progressive');
    this.add('たれていた', 'つ', ['v5'], 'passive past progressive');
    this.add('なれていた', 'ぬ', ['v5'], 'passive past progressive');
    this.add('ばれていた', 'ぶ', ['v5'], 'passive past progressive');
    this.add('まれていた', 'む', ['v5'], 'passive past progressive');
    this.add('られていた', 'る', ['v5'], 'passive past progressive');
    this.add('られていた', 'る', ['v1'], 'passive past progressive');

    // ── Compound: passive + contracted progressive (~かれてる) ────
    this.add('われてる', 'う', ['v5'], 'passive progressive');
    this.add('かれてる', 'く', ['v5'], 'passive progressive');
    this.add('がれてる', 'ぐ', ['v5'], 'passive progressive');
    this.add('されてる', 'す', ['v5'], 'passive progressive');
    this.add('されてる', 'する', ['vs'], 'passive progressive');
    this.add('たれてる', 'つ', ['v5'], 'passive progressive');
    this.add('なれてる', 'ぬ', ['v5'], 'passive progressive');
    this.add('ばれてる', 'ぶ', ['v5'], 'passive progressive');
    this.add('まれてる', 'む', ['v5'], 'passive progressive');
    this.add('られてる', 'る', ['v5'], 'passive progressive');
    this.add('られてる', 'る', ['v1'], 'passive progressive');

    // ── Compound: passive + past (~かれた etc.) ──────────────────
    this.add('われた', 'う', ['v5'], 'passive past');
    this.add('かれた', 'く', ['v5'], 'passive past');
    this.add('がれた', 'ぐ', ['v5'], 'passive past');
    this.add('された', 'す', ['v5'], 'passive past');
    this.add('された', 'する', ['vs'], 'passive past');
    this.add('たれた', 'つ', ['v5'], 'passive past');
    this.add('なれた', 'ぬ', ['v5'], 'passive past');
    this.add('ばれた', 'ぶ', ['v5'], 'passive past');
    this.add('まれた', 'む', ['v5'], 'passive past');
    this.add('られた', 'る', ['v5'], 'passive past');
    this.add('られた', 'る', ['v1'], 'passive past');

    // ── Compound: causative + passive (~させられる etc.) ──────────
    this.add('わせられる', 'う', ['v5'], 'causative passive');
    this.add('かせられる', 'く', ['v5'], 'causative passive');
    this.add('がせられる', 'ぐ', ['v5'], 'causative passive');
    this.add('させられる', 'す', ['v5'], 'causative passive');
    this.add('させられる', 'する', ['vs'], 'causative passive');
    this.add('たせられる', 'つ', ['v5'], 'causative passive');
    this.add('なせられる', 'ぬ', ['v5'], 'causative passive');
    this.add('ばせられる', 'ぶ', ['v5'], 'causative passive');
    this.add('ませられる', 'む', ['v5'], 'causative passive');
    this.add('らせられる', 'る', ['v5'], 'causative passive');
    this.add('させられる', 'る', ['v1'], 'causative passive');

    // ── Tari-form (～たり / ～だり) ─────────────────────────────
    this.add('ったり', 'う', ['v5'], 'tari-form');
    this.add('ったり', 'つ', ['v5'], 'tari-form');
    this.add('ったり', 'る', ['v5'], 'tari-form');
    this.add('いたり', 'く', ['v5'], 'tari-form');
    this.add('いだり', 'ぐ', ['v5'], 'tari-form');
    this.add('したり', 'す', ['v5'], 'tari-form');
    this.add('したり', 'する', ['vs'], 'tari-form');
    this.add('んだり', 'ぬ', ['v5'], 'tari-form');
    this.add('んだり', 'ぶ', ['v5'], 'tari-form');
    this.add('んだり', 'む', ['v5'], 'tari-form');
    this.add('たり', 'る', ['v1'], 'tari-form');
    this.add('きたり', 'くる', ['vk'], 'tari-form');
    this.add('ったり', 'く', ['v5'], 'tari-form'); // 行ったり -> 行く
    this.add('かったり', 'い', ['adj-i'], 'tari-form');

    // ── Polite past (～ました) ──────────────────────────────────
    this.add('いました', 'う', ['v5'], 'polite past');
    this.add('きました', 'く', ['v5'], 'polite past');
    this.add('ぎました', 'ぐ', ['v5'], 'polite past');
    this.add('しました', 'す', ['v5'], 'polite past');
    this.add('しました', 'する', ['vs'], 'polite past');
    this.add('ちました', 'つ', ['v5'], 'polite past');
    this.add('にました', 'ぬ', ['v5'], 'polite past');
    this.add('びました', 'ぶ', ['v5'], 'polite past');
    this.add('みました', 'む', ['v5'], 'polite past');
    this.add('りました', 'る', ['v5'], 'polite past');
    this.add('ました', 'る', ['v1'], 'polite past');
    this.add('きました', 'くる', ['vk'], 'polite past');

    // ── Polite past negative (～ませんでした) ────────────────────
    this.add('いませんでした', 'う', ['v5'], 'polite past negative');
    this.add('きませんでした', 'く', ['v5'], 'polite past negative');
    this.add('ぎませんでした', 'ぐ', ['v5'], 'polite past negative');
    this.add('しませんでした', 'す', ['v5'], 'polite past negative');
    this.add('しませんでした', 'する', ['vs'], 'polite past negative');
    this.add('ちませんでした', 'つ', ['v5'], 'polite past negative');
    this.add('にませんでした', 'ぬ', ['v5'], 'polite past negative');
    this.add('びませんでした', 'ぶ', ['v5'], 'polite past negative');
    this.add('みませんでした', 'む', ['v5'], 'polite past negative');
    this.add('りませんでした', 'る', ['v5'], 'polite past negative');
    this.add('ませんでした', 'る', ['v1'], 'polite past negative');
    this.add('きませんでした', 'くる', ['vk'], 'polite past negative');

    // ── Polite volitional (～ましょう) ───────────────────────────
    this.add('いましょう', 'う', ['v5'], 'polite volitional');
    this.add('きましょう', 'く', ['v5'], 'polite volitional');
    this.add('ぎましょう', 'ぐ', ['v5'], 'polite volitional');
    this.add('しましょう', 'す', ['v5'], 'polite volitional');
    this.add('しましょう', 'する', ['vs'], 'polite volitional');
    this.add('ちましょう', 'つ', ['v5'], 'polite volitional');
    this.add('にましょう', 'ぬ', ['v5'], 'polite volitional');
    this.add('びましょう', 'ぶ', ['v5'], 'polite volitional');
    this.add('みましょう', 'む', ['v5'], 'polite volitional');
    this.add('りましょう', 'る', ['v5'], 'polite volitional');
    this.add('ましょう', 'る', ['v1'], 'polite volitional');
    this.add('きましょう', 'くる', ['vk'], 'polite volitional');

    // ── Short causative (～す / ～さす) ──────────────────────────
    this.add('わす', 'う', ['v5'], 'short causative');
    this.add('かす', 'く', ['v5'], 'short causative');
    this.add('がす', 'ぐ', ['v5'], 'short causative');
    this.add('さす', 'す', ['v5'], 'short causative');
    this.add('たす', 'つ', ['v5'], 'short causative');
    this.add('なす', 'ぬ', ['v5'], 'short causative');
    this.add('ばす', 'ぶ', ['v5'], 'short causative');
    this.add('ます', 'む', ['v5'], 'short causative');
    this.add('らす', 'る', ['v5'], 'short causative');
    this.add('さす', 'る', ['v1'], 'short causative');
    this.add('さす', 'する', ['vs'], 'short causative');
    this.add('こさす', 'くる', ['vk'], 'short causative');

    // ── Polite imperative (～なさい) ─────────────────────────────
    this.add('いなさい', 'う', ['v5'], 'polite imperative');
    this.add('きなさい', 'く', ['v5'], 'polite imperative');
    this.add('ぎなさい', 'ぐ', ['v5'], 'polite imperative');
    this.add('しなさい', 'す', ['v5'], 'polite imperative');
    this.add('しなさい', 'する', ['vs'], 'polite imperative');
    this.add('ちなさい', 'つ', ['v5'], 'polite imperative');
    this.add('になさい', 'ぬ', ['v5'], 'polite imperative');
    this.add('びなさい', 'ぶ', ['v5'], 'polite imperative');
    this.add('みなさい', 'む', ['v5'], 'polite imperative');
    this.add('りなさい', 'る', ['v5'], 'polite imperative');
    this.add('なさい', 'る', ['v1'], 'polite imperative');
    this.add('きなさい', 'くる', ['vk'], 'polite imperative');

    // ── Adjective volitional (～かろう) ──────────────────────────
    this.add('かろう', 'い', ['adj-i'], 'volitional');

    // ── Negative volitional (～まい) ─────────────────────────────
    // Godan: attaches to dictionary form
    this.add('うまい', 'う', ['v5'], 'negative volitional');
    this.add('くまい', 'く', ['v5'], 'negative volitional');
    this.add('ぐまい', 'ぐ', ['v5'], 'negative volitional');
    this.add('すまい', 'す', ['v5'], 'negative volitional');
    this.add('つまい', 'つ', ['v5'], 'negative volitional');
    this.add('ぬまい', 'ぬ', ['v5'], 'negative volitional');
    this.add('ぶまい', 'ぶ', ['v5'], 'negative volitional');
    this.add('むまい', 'む', ['v5'], 'negative volitional');
    this.add('るまい', 'る', ['v5'], 'negative volitional');
    // Ichidan: attaches to stem
    this.add('まい', 'る', ['v1'], 'negative volitional');
    // Irregular
    this.add('しまい', 'する', ['vs'], 'negative volitional');
    this.add('こまい', 'くる', ['vk'], 'negative volitional');

    // ── i-adjective: adverbial (～く) ────────────────────────────
    this.add('く', 'い', ['adj-i'], 'adverbial');

    // ── i-adjective: nominalization (～さ) ───────────────────────
    this.add('さ', 'い', ['adj-i'], 'nominalization');

    // ── i-adjective: ～がる ("show signs of") ────────────────────
    this.add('がる', 'い', ['adj-i'], '-garu');

    // ── i-adjective: ～げ (appearance) ───────────────────────────
    this.add('げ', 'い', ['adj-i'], '-ge');

    // ── i-adjective: ～き (archaic attributive) ──────────────────
    this.add('き', 'い', ['adj-i'], 'archaic attributive');

    // ── ～そう (appearance/conjecture) ───────────────────────────
    // Masu-stem + そう → dictionary form
    this.add('いそう', 'う', ['v5'], '-sou');
    this.add('きそう', 'く', ['v5'], '-sou');
    this.add('ぎそう', 'ぐ', ['v5'], '-sou');
    this.add('しそう', 'す', ['v5'], '-sou');
    this.add('しそう', 'する', ['vs'], '-sou');
    this.add('ちそう', 'つ', ['v5'], '-sou');
    this.add('にそう', 'ぬ', ['v5'], '-sou');
    this.add('びそう', 'ぶ', ['v5'], '-sou');
    this.add('みそう', 'む', ['v5'], '-sou');
    this.add('りそう', 'る', ['v5'], '-sou');
    this.add('そう', 'る', ['v1'], '-sou');
    this.add('きそう', 'くる', ['vk'], '-sou');
    // Adjective: drop い add そう
    this.add('そう', 'い', ['adj-i'], '-sou');

    // ── ～すぎる / ～過ぎる (excess) ─────────────────────────────
    this.add('いすぎる', 'う', ['v5'], '-sugiru');
    this.add('きすぎる', 'く', ['v5'], '-sugiru');
    this.add('ぎすぎる', 'ぐ', ['v5'], '-sugiru');
    this.add('しすぎる', 'す', ['v5'], '-sugiru');
    this.add('しすぎる', 'する', ['vs'], '-sugiru');
    this.add('ちすぎる', 'つ', ['v5'], '-sugiru');
    this.add('にすぎる', 'ぬ', ['v5'], '-sugiru');
    this.add('びすぎる', 'ぶ', ['v5'], '-sugiru');
    this.add('みすぎる', 'む', ['v5'], '-sugiru');
    this.add('りすぎる', 'る', ['v5'], '-sugiru');
    this.add('すぎる', 'る', ['v1'], '-sugiru');
    this.add('きすぎる', 'くる', ['vk'], '-sugiru');
    this.add('すぎる', 'い', ['adj-i'], '-sugiru');

    // ── ～ておく / ～でおく (preparation / leaving as-is) ────────
    this.add('っておく', 'う', ['v5'], '-te oku');
    this.add('っておく', 'つ', ['v5'], '-te oku');
    this.add('っておく', 'る', ['v5'], '-te oku');
    this.add('いておく', 'く', ['v5'], '-te oku');
    this.add('いでおく', 'ぐ', ['v5'], '-te oku');
    this.add('しておく', 'す', ['v5'], '-te oku');
    this.add('しておく', 'する', ['vs'], '-te oku');
    this.add('んでおく', 'ぬ', ['v5'], '-te oku');
    this.add('んでおく', 'ぶ', ['v5'], '-te oku');
    this.add('んでおく', 'む', ['v5'], '-te oku');
    this.add('ておく', 'る', ['v1'], '-te oku');
    this.add('きておく', 'くる', ['vk'], '-te oku');

    // ── ～とく / ～どく (contraction of ておく/でおく) ────────────
    this.add('っとく', 'う', ['v5'], '-toku');
    this.add('っとく', 'つ', ['v5'], '-toku');
    this.add('っとく', 'る', ['v5'], '-toku');
    this.add('いとく', 'く', ['v5'], '-toku');
    this.add('いどく', 'ぐ', ['v5'], '-toku');
    this.add('しとく', 'す', ['v5'], '-toku');
    this.add('しとく', 'する', ['vs'], '-toku');
    this.add('んどく', 'ぬ', ['v5'], '-toku');
    this.add('んどく', 'ぶ', ['v5'], '-toku');
    this.add('んどく', 'む', ['v5'], '-toku');
    this.add('とく', 'る', ['v1'], '-toku');
    this.add('きとく', 'くる', ['vk'], '-toku');

    // ── ～ておる / ～でおる (formal/dialectal progressive) ───────
    this.add('っておる', 'う', ['v5'], '-te oru');
    this.add('っておる', 'つ', ['v5'], '-te oru');
    this.add('っておる', 'る', ['v5'], '-te oru');
    this.add('いておる', 'く', ['v5'], '-te oru');
    this.add('いでおる', 'ぐ', ['v5'], '-te oru');
    this.add('しておる', 'す', ['v5'], '-te oru');
    this.add('しておる', 'する', ['vs'], '-te oru');
    this.add('んでおる', 'ぬ', ['v5'], '-te oru');
    this.add('んでおる', 'ぶ', ['v5'], '-te oru');
    this.add('んでおる', 'む', ['v5'], '-te oru');
    this.add('ておる', 'る', ['v1'], '-te oru');
    this.add('きておる', 'くる', ['vk'], '-te oru');

    // ── ～とる / ～どる (contraction of ておる/でおる) ────────────
    this.add('っとる', 'う', ['v5'], '-toru');
    this.add('っとる', 'つ', ['v5'], '-toru');
    this.add('っとる', 'る', ['v5'], '-toru');
    this.add('いとる', 'く', ['v5'], '-toru');
    this.add('いどる', 'ぐ', ['v5'], '-toru');
    this.add('しとる', 'す', ['v5'], '-toru');
    this.add('しとる', 'する', ['vs'], '-toru');
    this.add('んどる', 'ぬ', ['v5'], '-toru');
    this.add('んどる', 'ぶ', ['v5'], '-toru');
    this.add('んどる', 'む', ['v5'], '-toru');
    this.add('とる', 'る', ['v1'], '-toru');
    this.add('きとる', 'くる', ['vk'], '-toru');

    // ── ～てしまう / ～でしまう (completion / regret) ─────────────
    this.add('ってしまう', 'う', ['v5'], '-te shimau');
    this.add('ってしまう', 'つ', ['v5'], '-te shimau');
    this.add('ってしまう', 'る', ['v5'], '-te shimau');
    this.add('いてしまう', 'く', ['v5'], '-te shimau');
    this.add('いでしまう', 'ぐ', ['v5'], '-te shimau');
    this.add('してしまう', 'す', ['v5'], '-te shimau');
    this.add('してしまう', 'する', ['vs'], '-te shimau');
    this.add('んでしまう', 'ぬ', ['v5'], '-te shimau');
    this.add('んでしまう', 'ぶ', ['v5'], '-te shimau');
    this.add('んでしまう', 'む', ['v5'], '-te shimau');
    this.add('てしまう', 'る', ['v1'], '-te shimau');
    this.add('きてしまう', 'くる', ['vk'], '-te shimau');

    // ── ～てしまった (past of てしまう) ──────────────────────────
    this.add('ってしまった', 'う', ['v5'], '-te shimatta');
    this.add('ってしまった', 'つ', ['v5'], '-te shimatta');
    this.add('ってしまった', 'る', ['v5'], '-te shimatta');
    this.add('いてしまった', 'く', ['v5'], '-te shimatta');
    this.add('いでしまった', 'ぐ', ['v5'], '-te shimatta');
    this.add('してしまった', 'す', ['v5'], '-te shimatta');
    this.add('してしまった', 'する', ['vs'], '-te shimatta');
    this.add('んでしまった', 'ぬ', ['v5'], '-te shimatta');
    this.add('んでしまった', 'ぶ', ['v5'], '-te shimatta');
    this.add('んでしまった', 'む', ['v5'], '-te shimatta');
    this.add('てしまった', 'る', ['v1'], '-te shimatta');
    this.add('きてしまった', 'くる', ['vk'], '-te shimatta');

    // ── ～ちゃう (contraction of ～てしまう) ──────────────────────
    this.add('っちゃう', 'う', ['v5'], '-chau');
    this.add('っちゃう', 'つ', ['v5'], '-chau');
    this.add('っちゃう', 'る', ['v5'], '-chau');
    this.add('いちゃう', 'く', ['v5'], '-chau');
    this.add('いじゃう', 'ぐ', ['v5'], '-chau');
    this.add('しちゃう', 'す', ['v5'], '-chau');
    this.add('しちゃう', 'する', ['vs'], '-chau');
    this.add('んじゃう', 'ぬ', ['v5'], '-chau');
    this.add('んじゃう', 'ぶ', ['v5'], '-chau');
    this.add('んじゃう', 'む', ['v5'], '-chau');
    this.add('ちゃう', 'る', ['v1'], '-chau');
    this.add('きちゃう', 'くる', ['vk'], '-chau');

    // ── ～ちゃった (past of ～ちゃう) ────────────────────────────
    this.add('っちゃった', 'う', ['v5'], '-chatta');
    this.add('っちゃった', 'つ', ['v5'], '-chatta');
    this.add('っちゃった', 'る', ['v5'], '-chatta');
    this.add('いちゃった', 'く', ['v5'], '-chatta');
    this.add('いじゃった', 'ぐ', ['v5'], '-chatta');
    this.add('しちゃった', 'す', ['v5'], '-chatta');
    this.add('しちゃった', 'する', ['vs'], '-chatta');
    this.add('んじゃった', 'ぬ', ['v5'], '-chatta');
    this.add('んじゃった', 'ぶ', ['v5'], '-chatta');
    this.add('んじゃった', 'む', ['v5'], '-chatta');
    this.add('ちゃった', 'る', ['v1'], '-chatta');
    this.add('きちゃった', 'くる', ['vk'], '-chatta');

    // ── ～ちまう (variant of ～てしまう) ──────────────────────────
    this.add('っちまう', 'う', ['v5'], '-chimau');
    this.add('っちまう', 'つ', ['v5'], '-chimau');
    this.add('っちまう', 'る', ['v5'], '-chimau');
    this.add('いちまう', 'く', ['v5'], '-chimau');
    this.add('いじまう', 'ぐ', ['v5'], '-chimau');
    this.add('しちまう', 'す', ['v5'], '-chimau');
    this.add('しちまう', 'する', ['vs'], '-chimau');
    this.add('んじまう', 'ぬ', ['v5'], '-chimau');
    this.add('んじまう', 'ぶ', ['v5'], '-chimau');
    this.add('んじまう', 'む', ['v5'], '-chimau');
    this.add('ちまう', 'る', ['v1'], '-chimau');
    this.add('きちまう', 'くる', ['vk'], '-chimau');

    // ── ～ちまった (past of ～ちまう) ────────────────────────────
    this.add('っちまった', 'う', ['v5'], '-chimatta');
    this.add('っちまった', 'つ', ['v5'], '-chimatta');
    this.add('っちまった', 'る', ['v5'], '-chimatta');
    this.add('いちまった', 'く', ['v5'], '-chimatta');
    this.add('いじまった', 'ぐ', ['v5'], '-chimatta');
    this.add('しちまった', 'す', ['v5'], '-chimatta');
    this.add('しちまった', 'する', ['vs'], '-chimatta');
    this.add('んじまった', 'ぬ', ['v5'], '-chimatta');
    this.add('んじまった', 'ぶ', ['v5'], '-chimatta');
    this.add('んじまった', 'む', ['v5'], '-chimatta');
    this.add('ちまった', 'る', ['v1'], '-chimatta');
    this.add('きちまった', 'くる', ['vk'], '-chimatta');

    // ── ～ちゃ (contraction of ～ては) ───────────────────────────
    this.add('っちゃ', 'う', ['v5'], '-cha');
    this.add('っちゃ', 'つ', ['v5'], '-cha');
    this.add('っちゃ', 'る', ['v5'], '-cha');
    this.add('いちゃ', 'く', ['v5'], '-cha');
    this.add('いじゃ', 'ぐ', ['v5'], '-cha');
    this.add('しちゃ', 'す', ['v5'], '-cha');
    this.add('しちゃ', 'する', ['vs'], '-cha');
    this.add('んじゃ', 'ぬ', ['v5'], '-cha');
    this.add('んじゃ', 'ぶ', ['v5'], '-cha');
    this.add('んじゃ', 'む', ['v5'], '-cha');
    this.add('ちゃ', 'る', ['v1'], '-cha');
    this.add('きちゃ', 'くる', ['vk'], '-cha');

    // ── Compound: passive + te-form (~かれて etc.) ───────────────
    this.add('われて', 'う', ['v5'], 'passive te-form');
    this.add('かれて', 'く', ['v5'], 'passive te-form');
    this.add('がれて', 'ぐ', ['v5'], 'passive te-form');
    this.add('されて', 'す', ['v5'], 'passive te-form');
    this.add('されて', 'する', ['vs'], 'passive te-form');
    this.add('たれて', 'つ', ['v5'], 'passive te-form');
    this.add('なれて', 'ぬ', ['v5'], 'passive te-form');
    this.add('ばれて', 'ぶ', ['v5'], 'passive te-form');
    this.add('まれて', 'む', ['v5'], 'passive te-form');
    this.add('られて', 'る', ['v5'], 'passive te-form');
    this.add('られて', 'る', ['v1'], 'passive te-form');

    // ── Compound: causative + te-form (~させて etc.) ─────────────
    this.add('わせて', 'う', ['v5'], 'causative te-form');
    this.add('かせて', 'く', ['v5'], 'causative te-form');
    this.add('がせて', 'ぐ', ['v5'], 'causative te-form');
    this.add('させて', 'す', ['v5'], 'causative te-form');
    this.add('させて', 'する', ['vs'], 'causative te-form');
    this.add('たせて', 'つ', ['v5'], 'causative te-form');
    this.add('なせて', 'ぬ', ['v5'], 'causative te-form');
    this.add('ばせて', 'ぶ', ['v5'], 'causative te-form');
    this.add('ませて', 'む', ['v5'], 'causative te-form');
    this.add('らせて', 'る', ['v5'], 'causative te-form');
    this.add('させて', 'る', ['v1'], 'causative te-form');
    this.add('こさせて', 'くる', ['vk'], 'causative te-form');

    // ── Compound: causative + past (~させた etc.) ────────────────
    this.add('わせた', 'う', ['v5'], 'causative past');
    this.add('かせた', 'く', ['v5'], 'causative past');
    this.add('がせた', 'ぐ', ['v5'], 'causative past');
    this.add('させた', 'す', ['v5'], 'causative past');
    this.add('させた', 'する', ['vs'], 'causative past');
    this.add('たせた', 'つ', ['v5'], 'causative past');
    this.add('なせた', 'ぬ', ['v5'], 'causative past');
    this.add('ばせた', 'ぶ', ['v5'], 'causative past');
    this.add('ませた', 'む', ['v5'], 'causative past');
    this.add('らせた', 'る', ['v5'], 'causative past');
    this.add('させた', 'る', ['v1'], 'causative past');
    this.add('こさせた', 'くる', ['vk'], 'causative past');

    // ── Classical negative (～ず) ────────────────────────────────
    this.add('わず', 'う', ['v5'], '-zu');
    this.add('かず', 'く', ['v5'], '-zu');
    this.add('がず', 'ぐ', ['v5'], '-zu');
    this.add('さず', 'す', ['v5'], '-zu');
    this.add('たず', 'つ', ['v5'], '-zu');
    this.add('なず', 'ぬ', ['v5'], '-zu');
    this.add('ばず', 'ぶ', ['v5'], '-zu');
    this.add('まず', 'む', ['v5'], '-zu');
    this.add('らず', 'る', ['v5'], '-zu');
    this.add('ず', 'る', ['v1'], '-zu');
    this.add('せず', 'する', ['vs'], '-zu');
    this.add('こず', 'くる', ['vk'], '-zu');

    // ── Classical negative (～ぬ) ────────────────────────────────
    this.add('わぬ', 'う', ['v5'], '-nu');
    this.add('かぬ', 'く', ['v5'], '-nu');
    this.add('がぬ', 'ぐ', ['v5'], '-nu');
    this.add('さぬ', 'す', ['v5'], '-nu');
    this.add('たぬ', 'つ', ['v5'], '-nu');
    this.add('なぬ', 'ぬ', ['v5'], '-nu');
    this.add('ばぬ', 'ぶ', ['v5'], '-nu');
    this.add('まぬ', 'む', ['v5'], '-nu');
    this.add('らぬ', 'る', ['v5'], '-nu');
    this.add('ぬ', 'る', ['v1'], '-nu');
    this.add('せぬ', 'する', ['vs'], '-nu');
    this.add('こぬ', 'くる', ['vk'], '-nu');

    // ── Classical negative (～ん, contraction of ～ぬ) ────────────
    this.add('わん', 'う', ['v5'], '-n');
    this.add('かん', 'く', ['v5'], '-n');
    this.add('がん', 'ぐ', ['v5'], '-n');
    this.add('さん', 'す', ['v5'], '-n');
    this.add('たん', 'つ', ['v5'], '-n');
    this.add('なん', 'ぬ', ['v5'], '-n');
    this.add('ばん', 'ぶ', ['v5'], '-n');
    this.add('まん', 'む', ['v5'], '-n');
    this.add('らん', 'る', ['v5'], '-n');
    this.add('ん', 'る', ['v1'], '-n');
    this.add('せん', 'する', ['vs'], '-n');
    this.add('こん', 'くる', ['vk'], '-n');

    // ── Classical negative attributive (～ざる) ──────────────────
    this.add('わざる', 'う', ['v5'], '-zaru');
    this.add('かざる', 'く', ['v5'], '-zaru');
    this.add('がざる', 'ぐ', ['v5'], '-zaru');
    this.add('さざる', 'す', ['v5'], '-zaru');
    this.add('たざる', 'つ', ['v5'], '-zaru');
    this.add('なざる', 'ぬ', ['v5'], '-zaru');
    this.add('ばざる', 'ぶ', ['v5'], '-zaru');
    this.add('まざる', 'む', ['v5'], '-zaru');
    this.add('らざる', 'る', ['v5'], '-zaru');
    this.add('ざる', 'る', ['v1'], '-zaru');
    this.add('せざる', 'する', ['vs'], '-zaru');
    this.add('こざる', 'くる', ['vk'], '-zaru');

    // ── Classical conditional negative (～ねば) ──────────────────
    this.add('わねば', 'う', ['v5'], '-neba');
    this.add('かねば', 'く', ['v5'], '-neba');
    this.add('がねば', 'ぐ', ['v5'], '-neba');
    this.add('さねば', 'す', ['v5'], '-neba');
    this.add('たねば', 'つ', ['v5'], '-neba');
    this.add('なねば', 'ぬ', ['v5'], '-neba');
    this.add('ばねば', 'ぶ', ['v5'], '-neba');
    this.add('まねば', 'む', ['v5'], '-neba');
    this.add('らねば', 'る', ['v5'], '-neba');
    this.add('ねば', 'る', ['v1'], '-neba');
    this.add('せねば', 'する', ['vs'], '-neba');
    this.add('こねば', 'くる', ['vk'], '-neba');

    // ── Archaic inference/intention (～む) ────────────────────────
    this.add('わむ', 'う', ['v5'], 'archaic -mu');
    this.add('かむ', 'く', ['v5'], 'archaic -mu');
    this.add('がむ', 'ぐ', ['v5'], 'archaic -mu');
    this.add('さむ', 'す', ['v5'], 'archaic -mu');
    this.add('たむ', 'つ', ['v5'], 'archaic -mu');
    this.add('なむ', 'ぬ', ['v5'], 'archaic -mu');
    this.add('ばむ', 'ぶ', ['v5'], 'archaic -mu');
    this.add('まむ', 'む', ['v5'], 'archaic -mu');
    this.add('らむ', 'る', ['v5'], 'archaic -mu');
    this.add('む', 'る', ['v1'], 'archaic -mu');
    this.add('せむ', 'する', ['vs'], 'archaic -mu');
    this.add('こむ', 'くる', ['vk'], 'archaic -mu');

    // ── ～んばかり ("on the verge of") ──────────────────────────
    this.add('わんばかり', 'う', ['v5'], '-nbakari');
    this.add('かんばかり', 'く', ['v5'], '-nbakari');
    this.add('がんばかり', 'ぐ', ['v5'], '-nbakari');
    this.add('さんばかり', 'す', ['v5'], '-nbakari');
    this.add('たんばかり', 'つ', ['v5'], '-nbakari');
    this.add('なんばかり', 'ぬ', ['v5'], '-nbakari');
    this.add('ばんばかり', 'ぶ', ['v5'], '-nbakari');
    this.add('まんばかり', 'む', ['v5'], '-nbakari');
    this.add('らんばかり', 'る', ['v5'], '-nbakari');
    this.add('んばかり', 'る', ['v1'], '-nbakari');
    this.add('せんばかり', 'する', ['vs'], '-nbakari');
    this.add('こんばかり', 'くる', ['vk'], '-nbakari');

    // ── ～んとする ("about to / trying to") ─────────────────────
    this.add('わんとする', 'う', ['v5'], '-ntosuru');
    this.add('かんとする', 'く', ['v5'], '-ntosuru');
    this.add('がんとする', 'ぐ', ['v5'], '-ntosuru');
    this.add('さんとする', 'す', ['v5'], '-ntosuru');
    this.add('たんとする', 'つ', ['v5'], '-ntosuru');
    this.add('なんとする', 'ぬ', ['v5'], '-ntosuru');
    this.add('ばんとする', 'ぶ', ['v5'], '-ntosuru');
    this.add('まんとする', 'む', ['v5'], '-ntosuru');
    this.add('らんとする', 'る', ['v5'], '-ntosuru');
    this.add('んとする', 'る', ['v1'], '-ntosuru');
    this.add('せんとする', 'する', ['vs'], '-ntosuru');
    this.add('こんとする', 'くる', ['vk'], '-ntosuru');

    // ── Slang: verb negative with ～ねえ (casual ～ない) ─────────
    this.add('わねえ', 'う', ['v5'], 'slang negative');
    this.add('かねえ', 'く', ['v5'], 'slang negative');
    this.add('がねえ', 'ぐ', ['v5'], 'slang negative');
    this.add('さねえ', 'す', ['v5'], 'slang negative');
    this.add('たねえ', 'つ', ['v5'], 'slang negative');
    this.add('なねえ', 'ぬ', ['v5'], 'slang negative');
    this.add('ばねえ', 'ぶ', ['v5'], 'slang negative');
    this.add('まねえ', 'む', ['v5'], 'slang negative');
    this.add('らねえ', 'る', ['v5'], 'slang negative');
    this.add('ねえ', 'る', ['v1'], 'slang negative');
    this.add('しねえ', 'する', ['vs'], 'slang negative');
    this.add('こねえ', 'くる', ['vk'], 'slang negative');

    // ── Slang: i-adjective vowel changes (ai→ee, oi→ee, ui→ii) ──
    // ai → ee
    this.add('けえ', 'かい', ['adj-i'], 'slang');
    this.add('げえ', 'がい', ['adj-i'], 'slang');
    this.add('せえ', 'さい', ['adj-i'], 'slang');
    this.add('ぜえ', 'ざい', ['adj-i'], 'slang');
    this.add('てえ', 'たい', ['adj-i'], 'slang');
    this.add('でえ', 'だい', ['adj-i'], 'slang');
    this.add('ねえ', 'ない', ['adj-i'], 'slang');
    this.add('べえ', 'ばい', ['adj-i'], 'slang');
    this.add('めえ', 'まい', ['adj-i'], 'slang');
    this.add('れえ', 'らい', ['adj-i'], 'slang');
    // oi → ee
    this.add('けえ', 'こい', ['adj-i'], 'slang');
    this.add('げえ', 'ごい', ['adj-i'], 'slang');
    this.add('せえ', 'そい', ['adj-i'], 'slang');
    this.add('てえ', 'とい', ['adj-i'], 'slang');
    this.add('でえ', 'どい', ['adj-i'], 'slang');
    this.add('ねえ', 'のい', ['adj-i'], 'slang');
    this.add('べえ', 'ぼい', ['adj-i'], 'slang');
    this.add('めえ', 'もい', ['adj-i'], 'slang');
    this.add('れえ', 'ろい', ['adj-i'], 'slang');
    // ui → ii
    this.add('きい', 'くい', ['adj-i'], 'slang');
    this.add('ぎい', 'ぐい', ['adj-i'], 'slang');
    this.add('しい', 'すい', ['adj-i'], 'slang');
    this.add('ちい', 'つい', ['adj-i'], 'slang');
    this.add('にい', 'ぬい', ['adj-i'], 'slang');
    this.add('びい', 'ぶい', ['adj-i'], 'slang');
    this.add('みい', 'むい', ['adj-i'], 'slang');
    this.add('りい', 'るい', ['adj-i'], 'slang');
    // ui → ee (variant)
    this.add('けえ', 'くい', ['adj-i'], 'slang');
    this.add('めえ', 'むい', ['adj-i'], 'slang');

    // ── n-slang negative (～んない, contraction of ～らない etc.) ─
    this.add('わんない', 'う', ['v5'], 'n-slang negative');
    this.add('かんない', 'く', ['v5'], 'n-slang negative');
    this.add('がんない', 'ぐ', ['v5'], 'n-slang negative');
    this.add('さんない', 'す', ['v5'], 'n-slang negative');
    this.add('たんない', 'つ', ['v5'], 'n-slang negative');
    this.add('なんない', 'ぬ', ['v5'], 'n-slang negative');
    this.add('ばんない', 'ぶ', ['v5'], 'n-slang negative');
    this.add('まんない', 'む', ['v5'], 'n-slang negative');
    this.add('らんない', 'る', ['v5'], 'n-slang negative');

    // ── Kansai-ben: negative (～へん) ────────────────────────────
    this.add('わへん', 'う', ['v5'], 'Kansai negative');
    this.add('かへん', 'く', ['v5'], 'Kansai negative');
    this.add('がへん', 'ぐ', ['v5'], 'Kansai negative');
    this.add('さへん', 'す', ['v5'], 'Kansai negative');
    this.add('たへん', 'つ', ['v5'], 'Kansai negative');
    this.add('なへん', 'ぬ', ['v5'], 'Kansai negative');
    this.add('ばへん', 'ぶ', ['v5'], 'Kansai negative');
    this.add('まへん', 'む', ['v5'], 'Kansai negative');
    this.add('らへん', 'る', ['v5'], 'Kansai negative');
    this.add('へん', 'る', ['v1'], 'Kansai negative');
    this.add('せえへん', 'する', ['vs'], 'Kansai negative');
    this.add('こうへん', 'くる', ['vk'], 'Kansai negative');

    // ── Kansai-ben: negative (～ひん, Kyoto variant) ─────────────
    this.add('わひん', 'う', ['v5'], 'Kansai negative');
    this.add('かひん', 'く', ['v5'], 'Kansai negative');
    this.add('がひん', 'ぐ', ['v5'], 'Kansai negative');
    this.add('さひん', 'す', ['v5'], 'Kansai negative');
    this.add('たひん', 'つ', ['v5'], 'Kansai negative');
    this.add('なひん', 'ぬ', ['v5'], 'Kansai negative');
    this.add('ばひん', 'ぶ', ['v5'], 'Kansai negative');
    this.add('まひん', 'む', ['v5'], 'Kansai negative');
    this.add('らひん', 'る', ['v5'], 'Kansai negative');
    this.add('ひん', 'る', ['v1'], 'Kansai negative');

    // ── Kansai-ben: te-form (～うて for う-verbs) ────────────────
    this.add('うて', 'う', ['v5'], 'Kansai te-form');

    // ── Kansai-ben: ta-form (～うた for う-verbs) ────────────────
    this.add('うた', 'う', ['v5'], 'Kansai past');

    // ── Kansai-ben: tara-form (～うたら for う-verbs) ────────────
    this.add('うたら', 'う', ['v5'], 'Kansai tara-conditional');

    // ── Kansai-ben: tari-form (～うたり for う-verbs) ────────────
    this.add('うたり', 'う', ['v5'], 'Kansai tari-form');

    // ── ～ば contraction (～ゃ) ──────────────────────────────────
    // Godan conditional contraction: [i-row]ゃ → [verb]
    this.add('いゃ', 'う', ['v5'], 'conditional contraction');
    this.add('きゃ', 'く', ['v5'], 'conditional contraction');
    this.add('ぎゃ', 'ぐ', ['v5'], 'conditional contraction');
    this.add('しゃ', 'す', ['v5'], 'conditional contraction');
    this.add('ちゃ', 'つ', ['v5'], 'conditional contraction');
    this.add('にゃ', 'ぬ', ['v5'], 'conditional contraction');
    this.add('びゃ', 'ぶ', ['v5'], 'conditional contraction');
    this.add('みゃ', 'む', ['v5'], 'conditional contraction');
    this.add('りゃ', 'る', ['v5'], 'conditional contraction');
    // Ichidan
    this.add('りゃ', 'る', ['v1'], 'conditional contraction');
    // Adjective: ～きゃ for ～ければ
    this.add('きゃ', 'い', ['adj-i'], 'conditional contraction');

    // ── Volitional slang (contraction of ～ようか / ～おうか) ────
    this.add('よっか', 'る', ['v1'], 'volitional slang');
    this.add('こっか', 'く', ['v5'], 'volitional slang');
    this.add('ごっか', 'ぐ', ['v5'], 'volitional slang');
    this.add('そっか', 'す', ['v5'], 'volitional slang');
    this.add('とっか', 'つ', ['v5'], 'volitional slang');
    this.add('のっか', 'ぬ', ['v5'], 'volitional slang');
    this.add('ぼっか', 'ぶ', ['v5'], 'volitional slang');
    this.add('もっか', 'む', ['v5'], 'volitional slang');
    this.add('ろっか', 'る', ['v5'], 'volitional slang');

    // ── Imperative negative slang (～んな) ───────────────────────
    this.add('いんな', 'う', ['v5'], 'imperative negative slang');
    this.add('きんな', 'く', ['v5'], 'imperative negative slang');
    this.add('ぎんな', 'ぐ', ['v5'], 'imperative negative slang');
    this.add('しんな', 'す', ['v5'], 'imperative negative slang');
    this.add('ちんな', 'つ', ['v5'], 'imperative negative slang');
    this.add('にんな', 'ぬ', ['v5'], 'imperative negative slang');
    this.add('びんな', 'ぶ', ['v5'], 'imperative negative slang');
    this.add('みんな', 'む', ['v5'], 'imperative negative slang');
    this.add('りんな', 'る', ['v5'], 'imperative negative slang');
    this.add('んな', 'る', ['v1'], 'imperative negative slang');
    this.add('すんな', 'する', ['vs'], 'imperative negative slang');
    this.add('くんな', 'くる', ['vk'], 'imperative negative slang');
  }
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

const deinflector = new Deinflector();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Deinflect a word by trying all applicable suffix transformation rules.
 *
 * Always returns the original word first (conditions=[], ruleName='original'),
 * followed by all deinflected candidates with their POS conditions.
 * This matches Yomitan's behavior where the original form is always
 * checked alongside deinflected forms.
 *
 * @param word - A potentially conjugated Japanese word
 * @returns Array of candidates: original word first, then deinflections
 */
export function deinflect(word: string): DeinflectionResult[] {
  return deinflector.deinflect(word);
}
