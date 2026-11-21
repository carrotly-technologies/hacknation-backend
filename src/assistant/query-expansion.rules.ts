import { SYNONYMS, type SynonymEntry } from './data/synonyms.data.js';
import { tokenize } from './text-normalize.js';

/**
 * Weight of a term added by expansion, relative to a term the user typed
 * (tuned on `npm run eval:assistant`): low enough that exact wording still
 * wins, high enough to reach a source that only uses the full name.
 */
export const EXPANSION_WEIGHT = 0.5;

/** One wording added to a query, in place of the query words it stands for. */
export interface Expansion {
  /** Stems of the added wording that the query does not contain yet. */
  terms: string[];
  /** All stems of the added wording, in order (for phrase matching). */
  phrase: string[];
  /** Query stems this wording stands for, e.g. ["iprz"]. */
  covers: string[];
}

interface CompiledEntry {
  phrases: string[][];
  triggers: string[][];
}

const compile = (entry: SynonymEntry): CompiledEntry => {
  const phrases = entry.phrases.map(tokenize).filter((p) => p.length > 0);
  const aliases = (entry.aliases ?? [])
    .map(tokenize)
    .filter((p) => p.length > 0);
  return { phrases, triggers: [...phrases, ...aliases] };
};

const COMPILED = SYNONYMS.map(compile);

/** Whether `needle` occurs in `haystack` as a contiguous run. */
const containsRun = (haystack: string[], needle: string[]): boolean =>
  haystack.some((_, i) => needle.every((w, j) => haystack[i + j] === w));

/**
 * The wordings to add to a query: for every dictionary entry the query
 * mentions (by a phrase or an alias), the entry's other phrases.
 */
export function expandQuery(
  query: string,
  entries: SynonymEntry[] = SYNONYMS,
): Expansion[] {
  const words = tokenize(query);
  if (words.length === 0) return [];
  const present = new Set(words);
  const compiled = entries === SYNONYMS ? COMPILED : entries.map(compile);
  const out: Expansion[] = [];
  for (const entry of compiled) {
    const covers = new Set<string>();
    const matched: string[][] = [];
    for (const trigger of entry.triggers) {
      if (!containsRun(words, trigger)) continue;
      matched.push(trigger);
      for (const w of trigger) covers.add(w);
    }
    if (covers.size === 0) continue;
    for (const phrase of entry.phrases) {
      if (matched.includes(phrase)) continue;
      const terms = [...new Set(phrase.filter((t) => !present.has(t)))];
      if (terms.length === 0) continue;
      out.push({ terms, phrase, covers: [...covers] });
    }
  }
  return out;
}

/** Every stem a query stands for: its own plus those added by expansion. */
export function expandedTerms(query: string): string[] {
  return [
    ...new Set([
      ...tokenize(query),
      ...expandQuery(query).flatMap((e) => e.terms),
    ]),
  ];
}
