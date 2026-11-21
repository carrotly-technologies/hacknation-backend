import { Bm25Index } from './bm25.js';
import { KNOWLEDGE_CHUNKS } from './data/knowledge.data.js';
import type { KnowledgeChunk, KnowledgeDocId } from './knowledge.types.js';
import { expandQuery } from './query-expansion.rules.js';

const MAX_PER_UNIT = 2;

export interface SearchHit {
  chunk: KnowledgeChunk;
  score: number;
  coverage: number;
}

export interface SearchOptions {
  k?: number;
  /** Documents to leave out, e.g. ['QA'] to search only primary sources. */
  exclude?: KnowledgeDocId[];
  /** Search only these documents. */
  only?: KnowledgeDocId[];
}

const OFF_TOPIC_PRIOR = 0.75;
const INDICATOR_PRIOR = 0.5;

/**
 * Most of the civil service act is not about assessments; its articles without
 * an assessment topic label are ranked slightly lower. So are the level
 * descriptions of single indicators of the competency model, so that they do
 * not crowd out the rules (or the competency overview) for general questions.
 */
const prior = (c: KnowledgeChunk): number => {
  if (c.doc === 'U' && !c.keywords) return OFF_TOPIC_PRIOR;
  if (c.doc === 'MK' && c.section) return INDICATOR_PRIOR;
  return 1;
};

/** What gets indexed for a chunk: its text plus where it sits. */
const indexText = (c: KnowledgeChunk): string =>
  [c.ref, c.section ?? '', c.keywords ?? '', c.text].join('\n');

/** In-memory lexical index over every chunk of the knowledge base. */
export class KnowledgeBase {
  readonly chunks: KnowledgeChunk[];
  private readonly index: Bm25Index;
  private readonly qaChunks: KnowledgeChunk[];
  private readonly qaIndex: Bm25Index;

  constructor(chunks: KnowledgeChunk[] = KNOWLEDGE_CHUNKS) {
    this.chunks = chunks;
    this.index = new Bm25Index(chunks.map(indexText));
    this.qaChunks = chunks.filter((c) => c.qa);
    this.qaIndex = new Bm25Index(this.qaChunks.map((c) => c.qa!.question));
  }

  /** Q&A entries whose question (not answer) matches the query. */
  searchQaQuestions(query: string, k = 1): SearchHit[] {
    const expansions = expandQuery(query);
    return this.qaIndex.search(query, k, undefined, expansions).map((hit) => ({
      chunk: this.qaChunks[hit.index],
      score: hit.score,
      coverage: hit.coverage,
    }));
  }

  search(query: string, options: SearchOptions = {}): SearchHit[] {
    const { k = 5, exclude = [], only } = options;
    const hits = this.index.search(
      query,
      k * 6,
      (i) => {
        const doc = this.chunks[i].doc;
        return !exclude.includes(doc) && (!only || only.includes(doc));
      },
      expandQuery(query),
    );
    // Diversify: at most MAX_PER_UNIT excerpts of one article/§/page, so that
    // the ust. of one article do not crowd out every other source.
    const perUnit = new Map<string, number>();
    const out: SearchHit[] = [];
    const ranked = hits
      .map((h) => ({ ...h, score: h.score * prior(this.chunks[h.index]) }))
      .sort((a, b) => b.score - a.score);
    for (const hit of ranked) {
      const chunk = this.chunks[hit.index];
      const key = `${chunk.doc}|${chunk.unit ?? chunk.page ?? chunk.id}`;
      const seen = perUnit.get(key) ?? 0;
      if (seen >= MAX_PER_UNIT) continue;
      perUnit.set(key, seen + 1);
      out.push({ chunk, score: hit.score, coverage: hit.coverage });
      if (out.length === k) break;
    }
    return out;
  }
}
