import { DISCLAIMER } from './assistant.types.js';
import {
  heuristicStandalone,
  HISTORY_NOTE,
  looksLikeFollowUp,
  parseRewrite,
  rewriteMessages,
  withHistory,
} from './followup.rules.js';
import type { ChatMessage } from './llm.client.js';

const objection = {
  question: 'Ile dni ma pracownik na sprzeciw od oceny okresowej?',
  answer: `Sprzeciw przysługuje w terminie 7 dni [1][2].\n\n${DISCLAIMER}`,
};

describe('looksLikeFollowUp', () => {
  it.each([
    'a do kogo się go składa?',
    'A jeśli dłużej?',
    'I co dalej?',
    'Czy to dotyczy też pierwszej oceny?',
    'Kto go rozpatruje?',
    'W jakim terminie?',
    'Czy od tej oceny przysługuje odwołanie do sądu pracy?',
  ])('reads "%s" as a follow-up', (q) => {
    expect(looksLikeFollowUp(q)).toBe(true);
  });

  it.each([
    'Ile dni ma pracownik na sprzeciw od oceny okresowej?',
    'Kto podlega ocenie okresowej?',
    'Co to jest IPRZ?',
    'Czym jest OSP?',
    'Ile kryteriów dodatkowych można wybrać i skąd?',
    'Kiedy oceniający może zmienić termin oceny?',
  ])('reads "%s" as standalone', (q) => {
    expect(looksLikeFollowUp(q)).toBe(false);
  });
});

describe('heuristicStandalone', () => {
  it('glues the earlier question in front of a follow-up', () => {
    expect(heuristicStandalone('a do kogo się go składa?', [objection])).toBe(
      'Ile dni ma pracownik na sprzeciw od oceny okresowej? a do kogo się go składa?',
    );
  });

  it('walks back over earlier follow-ups to the last standalone question', () => {
    const history = [
      { question: 'Kto podlega ocenie okresowej?', answer: '…' },
      objection,
      { question: 'a do kogo się go składa?', answer: '…' },
    ];
    expect(
      heuristicStandalone('A w jakim terminie go rozpatruje?', history),
    ).toBe(
      `${objection.question} a do kogo się go składa? A w jakim terminie go rozpatruje?`,
    );
  });

  it('leaves standalone questions and questions without history alone', () => {
    const q = 'Kiedy dokonuje się pierwszej oceny?';
    expect(heuristicStandalone(q, [objection])).toBe(q);
    expect(heuristicStandalone('a do kogo?', [])).toBe('a do kogo?');
  });
});

describe('rewriteMessages', () => {
  it('sends the earlier exchanges without citations or the disclaimer', () => {
    const [system, user] = rewriteMessages('a do kogo się go składa?', [
      objection,
    ]);
    expect(system.content).toMatch(/przepisz OSTATNIE pytanie/);
    expect(user.content).toContain(objection.question);
    expect(user.content).toContain('Sprzeciw przysługuje w terminie 7 dni');
    expect(user.content).not.toContain('[1]');
    expect(user.content).not.toContain(DISCLAIMER);
    expect(user.content).toMatch(
      /Ostatnie pytanie: a do kogo się go składa\?$/,
    );
  });
});

describe('parseRewrite', () => {
  it('takes the question from the reply', () => {
    expect(
      parseRewrite('„Do kogo składa się sprzeciw od oceny okresowej?”'),
    ).toBe('Do kogo składa się sprzeciw od oceny okresowej?');
    expect(
      parseRewrite(
        '<think>zaimek go = sprzeciw</think>\nPytanie: Do kogo składa się sprzeciw?\nTo wszystko.',
      ),
    ).toBe('Do kogo składa się sprzeciw?');
  });

  it('rejects unusable replies', () => {
    expect(parseRewrite('')).toBeNull();
    expect(parseRewrite('  \n ')).toBeNull();
    expect(parseRewrite('Nie znalazłem tego w bazie wiedzy.')).toBeNull();
    expect(parseRewrite('x'.repeat(501))).toBeNull();
  });
});

describe('withHistory', () => {
  const messages: ChatMessage[] = [
    { role: 'system', content: 'SYSTEM' },
    { role: 'user', content: 'Fragmenty…\n\nPytanie: a do kogo?' },
  ];

  it('puts the exchanges between the system prompt and the question', () => {
    const out = withHistory(messages, [objection]);
    expect(out.map((m) => m.role)).toEqual([
      'system',
      'user',
      'assistant',
      'user',
    ]);
    expect(out[0].content).toBe(`SYSTEM\n\n${HISTORY_NOTE}`);
    expect(out[1].content).toBe(objection.question);
    expect(out[2].content).toBe('Sprzeciw przysługuje w terminie 7 dni.');
    expect(out[3]).toBe(messages[1]);
  });

  it('changes nothing without history', () => {
    expect(withHistory(messages, [])).toBe(messages);
  });
});
