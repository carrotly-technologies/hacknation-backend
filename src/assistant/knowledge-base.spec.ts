import { KnowledgeBase } from './knowledge-base.js';

describe('KnowledgeBase retrieval', () => {
  const kb = new KnowledgeBase();
  const top = (q: string, k = 5) =>
    kb.search(q, { k, exclude: ['QA'] }).map((h) => h.chunk.ref);

  it('ships chunks of every source with a citable ref', () => {
    const docs = new Set(kb.chunks.map((c) => c.doc));
    expect([...docs].sort()).toEqual(
      ['AB', 'AC', 'AP', 'LT', 'MK', 'PO', 'PP', 'QA', 'RO', 'RP', 'U'].sort(),
    );
    for (const c of kb.chunks) {
      expect(c.ref).toBeTruthy();
      expect(c.text.length).toBeGreaterThan(20);
    }
  });

  it('has the competency model: every competency, every indicator with 5 levels', () => {
    const mk = kb.chunks.filter((c) => c.doc === 'MK');
    const competencies = new Set(
      mk.filter((c) => c.unit !== 'instrukcja').map((c) => c.unit),
    );
    expect(competencies.size).toBe(14);
    const indicators = mk.filter((c) => c.section?.startsWith('Wskaźnik'));
    expect(indicators).toHaveLength(49);
    for (const c of indicators) {
      for (const p of [1, 3, 5, 7, 9]) expect(c.text).toContain(`${p} pkt (`);
    }
  });

  it('has the sheets B, C and of the first assessment', () => {
    for (const doc of ['AB', 'AC', 'AP'] as const) {
      expect(kb.chunks.some((c) => c.doc === doc)).toBe(true);
    }
    expect(
      kb.chunks.some(
        (c) => c.doc === 'AB' && c.text.includes('Zarządzanie ludźmi'),
      ),
    ).toBe(true);
  });

  it('answers a question on indicators from the competency model', () => {
    const [first] = kb.search('Jakie są wskaźniki kompetencji współpraca?');
    expect(first.chunk.doc).toBe('MK');
    expect(first.chunk.ref).toContain('„współpraca”');
  });

  it('chunks acts by legal unit', () => {
    const art = kb.chunks.find((c) =>
      c.ref.startsWith('art. 81 ust. 4 ustawy o służbie cywilnej'),
    );
    expect(art?.text).toContain('co 24 miesiące');
  });

  it.each([
    ['Jak często sporządza się ocenę okresową?', 'art. 81 ust. 4'],
    ['W jakim terminie przysługuje sprzeciw od oceny okresowej?', 'art. 83'],
    [
      'Jakie są warunki pozytywnej pierwszej oceny?',
      '§ 10 ust. 1 rozporządzenia w sprawie pierwszej',
    ],
    ['Kiedy używa się arkusza A, B, a kiedy C?', '§ 3'],
  ])('finds the rule for "%s"', (question, ref) => {
    expect(top(question).some((r) => r.startsWith(ref))).toBe(true);
  });

  it('returns nothing for questions outside the domain', () => {
    expect(kb.search('Jak upiec sernik?')).toEqual([]);
  });

  it('filters by document', () => {
    const qa = kb.search('sprzeciw od oceny', { only: ['QA'] });
    expect(qa.length).toBeGreaterThan(0);
    expect(qa.every((h) => h.chunk.doc === 'QA')).toBe(true);
    expect(
      kb
        .search('sprzeciw od oceny', { exclude: ['QA'] })
        .some((h) => h.chunk.doc === 'QA'),
    ).toBe(false);
  });
});
