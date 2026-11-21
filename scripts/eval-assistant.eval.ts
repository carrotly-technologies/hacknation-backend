// Retrieval eval: runs every question of the Q&A set (notatki/qa-baza-wiedzy.md,
// ingested as QA chunks) through the knowledge base and checks whether a chunk
// matching the expected source ("Źródło:") is among the top 5.
// Run: npm run eval:assistant
import { KnowledgeBase } from '../src/assistant/knowledge-base.js';
import type { KnowledgeChunk } from '../src/assistant/knowledge.types.js';

interface Expected {
  doc: string;
  units: string[];
  pages: number[];
}

const range = (from: string, to?: string): number[] => {
  const a = Number(from);
  const b = to ? Number(to) : a;
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
};

/** Parses "[RO] § 7 (Dz.U. s. 2); [PO] s. 20" into expected units/pages. */
export function parseSources(line: string): Expected[] {
  return line
    .split(/(?=\[[A-Z]+\])/)
    .map((seg) => {
      const doc = /^\[([A-Z]+)\]/.exec(seg)?.[1] ?? '';
      const units: string[] = [];
      const pages: number[] = [];
      if (doc === 'U') {
        for (const m of seg.matchAll(/art\. (\d+[a-z]?)/g))
          units.push(`art. ${m[1]}`);
      } else if (doc === 'SZ') {
        // "cz. VI pkt 1–2": the points; "s. 15" is the printed page, not the
        // PDF page the chunks carry, so it is not used.
        for (const m of seg.matchAll(/cz\. ([IVX]+) pkt (\d+)(?:[–-](\d+))?/g))
          for (const n of range(m[2], m[3])) units.push(`cz. ${m[1]} pkt ${n}`);
      } else if (doc === 'RO' || doc === 'RP') {
        for (const m of seg.matchAll(/§ (\d+)/g)) units.push(`§ ${m[1]}`);
        for (const m of seg.matchAll(/zał\. (\d+)/g))
          units.push(`zał. nr ${m[1]}`);
        if (units.length === 0 || /przyp|pouczenie|zał/.test(seg)) {
          for (const m of seg.matchAll(/s\. (\d+)(?:[–-](\d+))?/g))
            pages.push(...range(m[1], m[2]));
        }
      } else {
        for (const m of seg.matchAll(/s\. (\d+)(?:[–-](\d+))?/g))
          pages.push(...range(m[1], m[2]));
      }
      return { doc, units, pages };
    })
    .filter((e) => e.doc);
}

const matches = (chunk: KnowledgeChunk, e: Expected): boolean => {
  if (chunk.doc !== e.doc) return false;
  if (e.units.length === 0 && e.pages.length === 0) return true;
  return (
    (chunk.unit !== undefined && e.units.includes(chunk.unit)) ||
    (chunk.page !== undefined && e.pages.includes(chunk.page))
  );
};

/**
 * Held-out paraphrases written after tuning (not in the Q&A set), with the
 * sources a reviewer would expect. Reported separately from the Q&A hit@5.
 */
const HELD_OUT: [string, string][] = [
  [
    'W jakim terminie przysługuje sprzeciw od oceny okresowej i kto go rozpatruje?',
    '[U] art. 83',
  ],
  [
    'Kiedy najwcześniej i najpóźniej można dokonać pierwszej oceny?',
    '[U] art. 38; [RP] § 4; [PP] s. 8',
  ],
  [
    'Ile czasu mija między kolejnymi ocenami okresowymi?',
    '[U] art. 81; [PO] s. 8',
  ],
  [
    'Po jakim czasie od negatywnej oceny okresowej sporządza się ponowną ocenę?',
    '[U] art. 81; [PO] s. 13–14',
  ],
  ['Jaka skala punktowa obowiązuje w pierwszej ocenie?', '[RP] § 9'],
  ['Co nowy pracownik opisuje w sprawozdaniu?', '[RP] § 6'],
  [
    'Czy można wybrać więcej niż trzy kryteria dodatkowe?',
    '[RO] § 5; [PO] s. 21–22',
  ],
  [
    'Jakie kryteria obowiązkowe ma arkusz B dla naczelnika wydziału?',
    '[RO] § 4, § 3; [PO] s. 19',
  ],
  [
    'Do kiedy trzeba przeprowadzić rozmowę wstępną z nowym pracownikiem?',
    '[RP] § 3; [PP] s. 6–7',
  ],
  ['Kiedy ocena okresowa jest negatywna?', '[RO] § 11; [PO] s. 26–27'],
  [
    'Czy długie zwolnienie lekarskie wydłuża termin oceny okresowej?',
    '[U] art. 81; [PO] s. 11–12; [LT]',
  ],
  [
    'Czy kierownik komórki może uczestniczyć w rozmowie oceniającej w pierwszej ocenie?',
    '[RP] § 8; [U] art. 38',
  ],
  [
    'Jak liczyć termin 30 dni od zatrudnienia na czas nieokreślony?',
    '[LT]; [PO] s. 9',
  ],
  [
    'Kiedy urzędnik może otrzymać kolejny stopień służbowy?',
    '[U] art. 89; [PO] s. 35',
  ],
];

describe('assistant retrieval eval', () => {
  it('reports hit@k over the Q&A set', () => {
    const kb = new KnowledgeBase();
    const qa = kb.chunks.filter((c) => c.qa);
    const misses: string[] = [];
    let hit1 = 0;
    let hit5 = 0;
    let hit5WithQa = 0;
    for (const c of qa) {
      const meta = c.qa!;
      const expected = parseSources(meta.source);
      const top = kb.search(meta.question, { k: 5, exclude: ['QA'] });
      const rank = top.findIndex((h) =>
        expected.some((e) => matches(h.chunk, e)),
      );
      if (rank === 0) hit1 += 1;
      if (rank >= 0) hit5 += 1;
      else
        misses.push(
          `#${meta.no} ${meta.question}\n   expected: ${meta.source}\n   got: ${top.map((h) => h.chunk.ref).join(' | ')}`,
        );
      const withQa = kb.search(meta.question, { k: 5 });
      if (
        withQa.some(
          (h) =>
            h.chunk.id === c.id || expected.some((e) => matches(h.chunk, e)),
        )
      )
        hit5WithQa += 1;
    }
    let heldOut = 0;
    const heldOutMisses: string[] = [];
    for (const [question, source] of HELD_OUT) {
      const expected = parseSources(source);
      const top = kb.search(question, { k: 5, exclude: ['QA'] });
      if (top.some((h) => expected.some((e) => matches(h.chunk, e))))
        heldOut += 1;
      else
        heldOutMisses.push(
          `${question} -> ${top.map((h) => h.chunk.ref).join(' | ')}`,
        );
    }
    const n = qa.length;
    const pct = (x: number) => `${x}/${n} (${((100 * x) / n).toFixed(1)}%)`;
    process.stdout.write(
      [
        `Q&A questions: ${n}, chunks: ${kb.chunks.length}`,
        `Primary sources only (Q&A chunks excluded):`,
        `  hit@1 ${pct(hit1)}`,
        `  hit@5 ${pct(hit5)}`,
        `Full knowledge base (Q&A chunks included): hit@5 ${pct(hit5WithQa)}`,
        `Held-out paraphrases (primary sources): hit@5 ${heldOut}/${HELD_OUT.length}`,
        ...(process.env.EVAL_VERBOSE ? heldOutMisses : []),
        process.env.EVAL_VERBOSE
          ? `Misses:\n${misses.join('\n')}`
          : `Misses: ${misses.length} (EVAL_VERBOSE=1 lists them)`,
      ].join('\n') + '\n',
    );
    expect(n).toBe(72);
  });
});
