import type { Expansion } from './query-expansion.rules.js';
import { EXPANSION_WEIGHT } from './query-expansion.rules.js';
import { tokenize } from './text-normalize.js';

/** Adjacent pairs weigh less than single words (tuned on the Q&A eval). */
const BIGRAM_WEIGHT = 0.25;

const pairsOf = (words: string[]): string[] =>
  words.slice(1).map((w, i) => `${words[i]}_${w}`);

/** Unigrams plus adjacent pairs, so phrases like "rozmowa oceniająca" count. */
export function terms(text: string): string[] {
  const words = tokenize(text);
  return [...words, ...pairsOf(words)];
}

export interface Bm25Hit {
  index: number;
  score: number;
  /** Share of distinct query terms present in the document (0..1). */
  coverage: number;
}

/** Okapi BM25 over pre-tokenized documents, all in memory. */
export class Bm25Index {
  private readonly tf: Map<string, number>[];
  private readonly lengths: number[];
  private readonly df = new Map<string, number>();
  private readonly avgLength: number;

  constructor(
    docs: string[],
    private readonly k1 = 1.2,
    private readonly b = 0.6,
  ) {
    this.tf = docs.map((doc) => {
      const counts = new Map<string, number>();
      for (const term of terms(doc)) {
        counts.set(term, (counts.get(term) ?? 0) + 1);
      }
      for (const term of counts.keys()) {
        this.df.set(term, (this.df.get(term) ?? 0) + 1);
      }
      return counts;
    });
    this.lengths = this.tf.map((counts) =>
      [...counts.values()].reduce((a, c) => a + c, 0),
    );
    this.avgLength =
      this.lengths.reduce((a, l) => a + l, 0) / Math.max(1, docs.length);
  }

  idf(term: string): number {
    const n = this.tf.length;
    const df = this.df.get(term) ?? 0;
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  }

  /**
   * Documents ranked by BM25 over the query's terms. `expansions` (synonyms of
   * query words) add terms with a lower weight; a document with every word of
   * an expansion counts as covering the query words it stands for.
   */
  search(
    query: string,
    k: number,
    filter: (index: number) => boolean = () => true,
    expansions: Expansion[] = [],
  ): Bm25Hit[] {
    const unigrams = new Set(tokenize(query));
    const weights = new Map<string, number>();
    for (const t of terms(query)) {
      weights.set(t, unigrams.has(t) ? 1 : BIGRAM_WEIGHT);
    }
    for (const e of expansions) {
      // A word the documents never use (an abbreviation like "OSP") is
      // replaced by its expansion at full weight. Otherwise the expansion
      // weighs less than the words typed, spread over its length, so that an
      // exact match still wins.
      const unknown = e.covers.every((t) => !this.df.has(t));
      const share = Math.min(1, e.covers.length / e.terms.length);
      const w = unknown ? 1 : EXPANSION_WEIGHT * share;
      for (const t of e.terms) {
        if (!weights.has(t)) weights.set(t, w);
      }
      const pairWeight = (unknown ? 1 : EXPANSION_WEIGHT) * BIGRAM_WEIGHT;
      for (const t of pairsOf(e.phrase)) {
        if (!weights.has(t)) weights.set(t, pairWeight);
      }
    }
    const queryTerms = [...weights.keys()].filter((t) => this.df.has(t));
    if (queryTerms.length === 0) return [];
    const idf = new Map(queryTerms.map((t) => [t, this.idf(t)]));
    const hits: Bm25Hit[] = [];
    this.tf.forEach((counts, index) => {
      if (!filter(index)) return;
      let score = 0;
      const norm =
        this.k1 *
        (1 - this.b + (this.b * this.lengths[index]) / this.avgLength);
      for (const term of queryTerms) {
        const f = counts.get(term);
        if (!f) continue;
        score +=
          weights.get(term)! *
          (idf.get(term) ?? 0) *
          ((f * (this.k1 + 1)) / (f + norm));
      }
      if (score > 0) {
        const covered = new Set([...unigrams].filter((t) => counts.has(t)));
        for (const e of expansions) {
          if (e.phrase.every((t) => counts.has(t))) {
            for (const t of e.covers) covered.add(t);
          }
        }
        hits.push({ index, score, coverage: covered.size / unigrams.size });
      }
    });
    return hits.sort((a, b) => b.score - a.score).slice(0, k);
  }
}
