import { retrieve, selectQuote } from './answer.rules.js';
import { Bm25Index } from './bm25.js';
import { SYNONYMS, type SynonymEntry } from './data/synonyms.data.js';
import { KnowledgeBase } from './knowledge-base.js';
import { expandQuery, expandedTerms } from './query-expansion.rules.js';
import { tokenize } from './text-normalize.js';

const ENTRIES: SynonymEntry[] = [
  {
    phrases: ['indywidualny program rozwoju zawodowego', 'IPRZ'],
    source: 'test',
  },
  { phrases: ['opis stanowiska pracy'], aliases: ['OSP'], source: 'test' },
];

describe('expandQuery', () => {
  it('expands an abbreviation to the full name', () => {
    expect(expandQuery('Co to jest IPRZ?', ENTRIES)).toEqual([
      {
        terms: tokenize('indywidualny program rozwoju zawodowego'),
        phrase: tokenize('indywidualny program rozwoju zawodowego'),
        covers: ['iprz'],
      },
    ]);
  });

  it('expands the full name, in any inflection, to the abbreviation', () => {
    const [e] = expandQuery(
      'Kto ustala indywidualnego programu rozwoju zawodowego?',
      ENTRIES,
    );
    expect(e.terms).toEqual(['iprz']);
    expect(e.covers).toEqual(
      tokenize('indywidualny program rozwoju zawodowego'),
    );
  });

  it('expands an alias, but never adds the alias itself', () => {
    expect(
      expandQuery('Kto zatwierdza OSP?', ENTRIES).map((e) => e.terms),
    ).toEqual([tokenize('opis stanowiska pracy')]);
    expect(expandQuery('Co zawiera opis stanowiska pracy?', ENTRIES)).toEqual(
      [],
    );
  });

  it('matches a phrase only as a whole, in order', () => {
    expect(expandQuery('Jaki jest program szkolenia?', ENTRIES)).toEqual([]);
    expect(expandQuery('pracy stanowiska opis', ENTRIES)).toEqual([]);
    expect(expandQuery('', ENTRIES)).toEqual([]);
  });

  it('adds only the words the question does not have yet', () => {
    const terms = expandedTerms('Kiedy jest ponowna ocena?');
    expect(terms).toEqual(
      expect.arrayContaining([...tokenize('ponowna ocena'), 'nowa', 'okres']),
    );
    expect(new Set(terms).size).toBe(terms.length);
  });
});

describe('synonym dictionary', () => {
  it('has a source for every entry and only phrases that survive tokenizing', () => {
    for (const entry of SYNONYMS) {
      expect(entry.source.length).toBeGreaterThan(5);
      for (const p of [...entry.phrases, ...(entry.aliases ?? [])]) {
        expect(tokenize(p).length, p).toBeGreaterThan(0);
      }
    }
  });

  it('uses only wordings found in the knowledge base as phrases', () => {
    const kb = new KnowledgeBase();
    const corpus = kb.chunks
      .filter((c) => c.doc !== 'QA')
      .map((c) => tokenize(c.text).join(' '))
      .join(' | ');
    for (const entry of SYNONYMS) {
      for (const p of entry.phrases) {
        expect(corpus, p).toContain(tokenize(p).join(' '));
      }
    }
  });

  it('does not list the same wording twice', () => {
    const all = SYNONYMS.flatMap((e) => [
      ...e.phrases,
      ...(e.aliases ?? []),
    ]).map((p) => tokenize(p).join(' '));
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('Bm25Index with expansions', () => {
  const docs = [
    'Bezpośredni przełożony ustala indywidualny program rozwoju zawodowego.',
    'IPRZ sporządza się po ocenie okresowej.',
    'Termin sprzeciwu wynosi 7 dni.',
  ];
  const index = new Bm25Index(docs);
  const search = (q: string) =>
    index.search(q, 3, undefined, expandQuery(q, ENTRIES));

  it('finds a document that uses only the full name of an abbreviation', () => {
    const hits = search('Kto ustala IPRZ?');
    expect(hits.map((h) => h.index)).toEqual(expect.arrayContaining([0, 1]));
    const full = hits.find((h) => h.index === 0)!;
    // The full name stands for "IPRZ", so the question counts as covered.
    expect(full.coverage).toBe(1);
  });

  it('ranks the exact wording above the expansion', () => {
    const hits = search('IPRZ');
    expect(hits[0].index).toBe(1);
    expect(hits[1].index).toBe(0);
  });

  it('gives full weight when the documents never use the abbreviation', () => {
    const osp = new Bm25Index([
      'Opis stanowiska pracy zawiera główne obowiązki.',
      'Termin sprzeciwu wynosi 7 dni.',
    ]);
    const q = 'OSP';
    const viaAlias = osp.search(q, 2, undefined, expandQuery(q, ENTRIES));
    const direct = osp.search('opis stanowiska pracy', 2);
    expect(viaAlias.map((h) => h.index)).toEqual([0]);
    expect(viaAlias[0].score).toBeCloseTo(direct[0].score);
    expect(viaAlias[0].coverage).toBe(1);
  });

  it('scores as before without expansions', () => {
    expect(index.search('Kto ustala IPRZ?', 3)).toEqual(
      index.search('Kto ustala IPRZ?', 3, undefined, []),
    );
  });
});

describe('expansion in the assistant', () => {
  const kb = new KnowledgeBase();

  it('answers an abbreviation with sources that use the full name', () => {
    for (const q of ['Co to jest IPRZ?', 'Kto zatwierdza OSP?']) {
      const { grounded, hits } = retrieve(kb, q);
      expect(grounded, q).toBe(true);
      expect(
        hits.some((h) =>
          /indywidualn\S* program\S* rozwoju|opis\S* stanowisk\S* pracy/i.test(
            h.chunk.text,
          ),
        ),
        q,
      ).toBe(true);
    }
  });

  it('finds the re-assessment criteria for a "ponowna ocena" question', () => {
    const refs = kb
      .search('Czy przy ponownej ocenie można wybrać nowe kryteria?', {
        k: 5,
        exclude: ['QA'],
      })
      .map((h) => `${h.chunk.doc}:${h.chunk.page ?? h.chunk.unit}`);
    expect(refs).toContain('PO:23');
  });

  it('quotes the sentence with the full name for an abbreviation', () => {
    const text =
      'Ocena okresowa jest sporządzana co 24 miesiące. ' +
      'Arkusz zawiera wnioski dotyczące indywidualnego programu rozwoju zawodowego ocenianego, które ustala bezpośredni przełożony.';
    expect(selectQuote(text, 'IPRZ', 130)).toContain('indywidualnego programu');
  });
});
