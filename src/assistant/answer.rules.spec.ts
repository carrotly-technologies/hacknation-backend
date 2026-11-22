import {
  asksForRatingDecision,
  buildMessages,
  extractiveAnswer,
  questionPath,
  retrieve,
  sanitizeCitations,
  selectQuote,
  toSources,
} from './answer.rules.js';
import { NOT_FOUND } from './assistant.types.js';
import { KnowledgeBase } from './knowledge-base.js';

describe('answer rules', () => {
  const kb = new KnowledgeBase();

  it('is not grounded for out-of-domain questions', () => {
    for (const q of [
      'Jaka jest stolica Francji?',
      'Ile wynosi płaca minimalna w 2026 roku?',
      'Kto wygrał mundial w 2022?',
    ]) {
      const r = retrieve(kb, q);
      expect(r.grounded).toBe(false);
      expect(r.hits).toEqual([]);
      expect(extractiveAnswer(q, r, [])).toBe(NOT_FOUND);
    }
  });

  it('builds an extractive answer with numbered citations', () => {
    const q = 'Jak często sporządza się ocenę okresową?';
    const r = retrieve(kb, q);
    expect(r.grounded).toBe(true);
    const sources = toSources(r.hits, q);
    expect(sources.map((s) => s.n)).toEqual(sources.map((_, i) => i + 1));
    const answer = extractiveAnswer(q, r, sources);
    expect(answer).toContain('[1]');
    expect(answer).toContain('24 miesiące');
  });

  it('puts a well matching Q&A entry first', () => {
    const q = 'Ile kryteriów dodatkowych można wybrać i skąd?';
    const r = retrieve(kb, q);
    expect(r.hits[0].chunk.doc).toBe('QA');
    expect(r.hits.slice(1).every((h) => h.chunk.doc !== 'QA')).toBe(true);
  });

  it('refuses to decide an employee rating', () => {
    expect(
      asksForRatingDecision('Jaką ocenę powinienem dać Kowalskiemu?'),
    ).toBe(true);
    expect(asksForRatingDecision('Czy dać mu 7 punktów?')).toBe(true);
    expect(asksForRatingDecision('Jaka jest skala ocen?')).toBe(false);
    const q = 'Ile punktów przyznać pracownikowi za komunikację?';
    const r = retrieve(kb, `${q} skala ocen cząstkowych`);
    expect(extractiveAnswer(q, r, toSources(r.hits, q))).toMatch(
      /^Nie mogę rozstrzygnąć/,
    );
  });

  it('keeps quotes short and on topic', () => {
    const text = `${'Zdanie wstępne bez związku. '.repeat(30)}Sprzeciw wnosi się w terminie 7 dni. ${'Inne zdanie. '.repeat(30)}`;
    const quote = selectQuote(text, 'termin sprzeciwu', 120);
    expect(quote.length).toBeLessThanOrEqual(122);
    expect(quote).toContain('Sprzeciw wnosi się w terminie 7 dni.');
  });

  it('keeps to the assessment path the question names', () => {
    expect(questionPath('Czy termin oceny okresowej się przesuwa?')).toBe(
      'PERIODIC',
    );
    expect(questionPath('Kiedy dokonuje się pierwszej oceny?')).toBe('FIRST');
    expect(questionPath('Czy od oceny przysługuje sprzeciw?')).toBeNull();
    const r = retrieve(
      kb,
      'Pracownik był na zwolnieniu lekarskim przez 2 miesiące. Czy termin oceny okresowej się przesuwa?',
    );
    expect(r.hits.some((h) => h.chunk.ref.startsWith('art. 81 ust. 7'))).toBe(
      true,
    );
    expect(r.hits.every((h) => !['RP', 'PP'].includes(h.chunk.doc))).toBe(true);
    expect(
      r.hits.every((h) => !/\[(RP|PP)\]/.test(h.chunk.qa?.source ?? '')),
    ).toBe(true);
  });

  it('drops citations to excerpts that were not provided', () => {
    expect(sanitizeCitations('A [1], B [7], C [2].', 2)).toBe(
      'A [1], B , C [2].',
    );
  });

  it('builds a prompt with numbered excerpts and the rules', () => {
    const q = 'Jak często sporządza się ocenę okresową?';
    const [system, user] = buildMessages(q, retrieve(kb, q).hits, 'kontekst');
    expect(system.content).toContain('Nie znalazłem tego w bazie wiedzy.');
    expect(system.content).toMatch(/Nigdy nie rozstrzygaj/);
    expect(user.content).toMatch(/^Fragmenty źródeł:\n\n\[1\] /);
    expect(user.content).toContain('kontekst');
    expect(user.content).toContain(`Pytanie: ${q}`);
  });

  it('answers the objection deadline with 7 days, not the 14-day review', () => {
    const q = 'Ile dni ma oceniany na sprzeciw?';
    const r = retrieve(kb, q);
    const sources = toSources(r.hits, q);
    expect(sources[0].ref).toBe('Zestaw Q&A, pyt. 75');
    expect(sources[0].quote).toMatch(
      /^Sprzeciw wnosi się w terminie 7 dni od dnia zapoznania/,
    );
    // The language model gets the same first excerpt.
    expect(buildMessages(q, r.hits)[1].content).toContain(
      '[1] Zestaw pytań i odpowiedzi o ocenach w służbie cywilnej — Zestaw Q&A, pyt. 75',
    );
  });

  it('picks the Q&A entry covering more of the question', () => {
    const q = 'W jakim terminie przysługuje sprzeciw od oceny okresowej?';
    expect(retrieve(kb, q).hits[0].chunk.ref).toBe('Zestaw Q&A, pyt. 75');
  });

  it('gives the number of mandatory criteria of sheet C', () => {
    const q = 'Ile kryteriów obowiązkowych ma arkusz C?';
    const [first] = toSources(retrieve(kb, q).hits, q);
    expect(first.quote).toMatch(/Arkusz C[^.]*ma 5 kryteriów obowiązkowych/);
  });
});
