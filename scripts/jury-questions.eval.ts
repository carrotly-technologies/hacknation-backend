// Jury-style questions answered without a language model (extractive mode):
// the first source must be the right provision and its quote (the summary the
// user reads first) must state the expected fact. The LLM path is given the
// same hits in the same order (buildMessages), so this guards it too.
// Run: npm run eval:assistant
import {
  buildMessages,
  extractiveAnswer,
  retrieve,
  toSources,
} from '../src/assistant/answer.rules.js';
import { KnowledgeBase } from '../src/assistant/knowledge-base.js';

interface JuryQuestion {
  q: string;
  /** The first source's ref must match this. */
  ref: RegExp;
  /** The first source's quote must state this fact. */
  fact: RegExp;
}

export const JURY_QUESTIONS: JuryQuestion[] = [
  {
    q: 'Ile dni ma oceniany na sprzeciw?',
    ref: /art\. 83 ust\. 1|sprzeciw|Zestaw Q&A/i,
    fact: /7 dni od (dnia )?zapoznania/,
  },
  {
    q: 'Kiedy przeprowadza się rozmowę rozpoczynającą okres oceny?',
    ref: /§ 7|§ 5|rozmow|Zestaw Q&A/i,
    fact: /30 dni od (dnia )?sporządzenia na piśmie poprzedniej oceny/,
  },
  {
    q: 'Jak często sporządza się ocenę okresową?',
    ref: /art\. 81|okresow|Zestaw Q&A/i,
    fact: /co 24 miesiące/i,
  },
  {
    q: 'Kiedy oceniany podlega ponownej ocenie po negatywnej ocenie okresowej?',
    ref: /art\. 81|ponown|Zestaw Q&A/i,
    fact: /6 miesięcy od dnia zapoznania/,
  },
  {
    q: 'Ile kryteriów dodatkowych może wybrać oceniający?',
    ref: /§ 5|kryteri|Zestaw Q&A/i,
    fact: /nie więcej niż 3|od 0 do 3|maksymalnie 3/i,
  },
  {
    q: 'Ile kryteriów obowiązkowych ma arkusz C?',
    ref: /§ 4|arkusz|kryteri|Zestaw Q&A/i,
    fact: /(5|pięć|pięciu) kryteri/,
  },
  {
    q: 'Do kogo stosuje się arkusz A, B i C?',
    ref: /§ 3|arkusz|Zestaw Q&A/i,
    fact: /kierownik\p{L}* urzędu[\s\S]*bezpośredni\p{L}* kierowani/u,
  },
  {
    q: 'Jaka jest skala ocen cząstkowych w ocenie okresowej?',
    ref: /§ 11|skal|Zestaw Q&A/i,
    fact: /znacznie powyżej oczekiwań – 9 punktów|\| 9 \| znacznie powyżej/,
  },
  {
    q: 'Kiedy ocena okresowa jest pozytywna, a kiedy negatywna?',
    ref: /§ 11|pozytywn|negatywn|Zestaw Q&A/i,
    fact: /pozytywn[\s\S]*negatywn[\s\S]*znacznie poniżej oczekiwań|znacznie poniżej oczekiwań[\s\S]*negatywn/,
  },
  {
    q: 'W jakim terminie dokonuje się pierwszej oceny w służbie cywilnej?',
    ref: /art\. 38|§ 4|pierwsz|Zestaw Q&A/i,
    fact: /8 miesięcy od nawiązania stosunku pracy/,
  },
  {
    q: 'Kiedy urzędnik otrzymuje kolejny stopień służbowy?',
    ref: /art\. 89|stopie|Zestaw Q&A/i,
    fact: /dwie kolejne|dwóch kolejnych/,
  },
  {
    q: 'Co to jest IPRZ i gdzie się go wpisuje?',
    ref: /IPRZ|indywidualn|§ 11|art\. 81|Zestaw Q&A/i,
    fact: /indywidualn\p{L}* program\p{L}* rozwoju zawodowego/u,
  },
  {
    q: 'Kto dokonuje oceny okresowej?',
    ref: /art\. 81|§ 2|ocenia|Zestaw Q&A/i,
    fact: /bezpośredni\p{L}* przełożon/iu,
  },
  // Paraphrases of the above, so that the fix is not tied to one wording.
  {
    q: 'Ile dni ma pracownik na złożenie sprzeciwu?',
    ref: /art\. 83 ust\. 1|sprzeciw|Zestaw Q&A/i,
    fact: /7 dni od (dnia )?zapoznania/,
  },
  {
    q: 'W jakim terminie przysługuje sprzeciw od oceny okresowej?',
    ref: /art\. 83 ust\. 1|sprzeciw|Zestaw Q&A/i,
    fact: /7 dni od (dnia )?zapoznania/,
  },
  {
    q: 'Ile kryteriów obowiązkowych ma arkusz B?',
    ref: /§ 4|arkusz|Zestaw Q&A/i,
    fact: /B[^.]*ma 5 kryteriów/,
  },
  {
    q: 'Kiedy przyznaje się negatywną ocenę okresową?',
    ref: /§ 11|negatywn|Zestaw Q&A/i,
    fact: /znacznie poniżej oczekiwań/,
  },
];

describe('jury-style questions (extractive)', () => {
  const kb = new KnowledgeBase();
  const report: string[] = [];
  afterAll(() => {
    process.stdout.write(`Jury questions:\n${report.join('\n')}\n`);
  });
  for (const { q, ref, fact } of JURY_QUESTIONS) {
    it(q, () => {
      const retrieval = retrieve(kb, q);
      const sources = toSources(retrieval.hits, q);
      const first = sources[0];
      const ok =
        retrieval.grounded &&
        !!first &&
        ref.test(first.ref) &&
        fact.test(first.quote);
      report.push(
        `${ok ? 'PASS' : 'FAIL'} ${q}\n     [1] ${first?.ref ?? '-'}: ${first?.quote.slice(0, 160) ?? ''}`,
      );
      expect(retrieval.grounded).toBe(true);
      expect(first.ref).toMatch(ref);
      expect(first.quote).toMatch(fact);
      // The answer leads with the first source, and the LLM gets it as [1].
      expect(extractiveAnswer(q, retrieval, sources)).toContain(first.quote);
      expect(buildMessages(q, retrieval.hits)[1].content).toContain(
        `[1] ${retrieval.hits[0].chunk.title} — ${retrieval.hits[0].chunk.ref}`,
      );
    });
  }
});
