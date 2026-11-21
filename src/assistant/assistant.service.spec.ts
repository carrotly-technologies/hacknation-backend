import { NotFoundException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  AuthenticationContext,
  AuthenticationModule,
} from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { CasePolicy } from '../auth/case.policy.js';
import { USER_SEED } from '../auth/users.seed.js';
import { CasesModule } from '../cases/cases.module.js';
import { CasesService } from '../cases/cases.service.js';
import { AssistantService } from './assistant.service.js';
import { NOT_FOUND } from './assistant.types.js';
import { LlmClient } from './llm.client.js';

describe('AssistantService', () => {
  let service: AssistantService;
  let cases: CasesService;
  const chat = vi.fn<LlmClient['chat']>();

  beforeEach(async () => {
    chat.mockReset();
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        AuthenticationModule.forRoot({ globalGuard: false }),
        AuthorizationModule.forRoot({ globalGuard: false }),
        CasesModule,
      ],
      providers: [
        AssistantService,
        CasePolicy,
        { provide: LlmClient, useValue: { chat } },
      ],
    })
      .overrideProvider(AuthenticationContext)
      .useValue({ requireUser: () => USER_SEED[0] })
      .compile();
    service = moduleRef.get(AssistantService);
    cases = moduleRef.get(CasesService);
  });

  const ask = (question: string, extra = {}) =>
    service.ask({ question, ...extra });

  it('answers extractively when the LLM is not available', async () => {
    chat.mockResolvedValue(null);
    const res = await ask('Jak często sporządza się ocenę okresową?');
    expect(res.mode).toBe('EXTRACTIVE');
    expect(res.grounded).toBe(true);
    expect(res.sources.length).toBeGreaterThan(0);
    expect(res.answer).toContain('[1]');
    expect(res.disclaimer).toMatch(/doradcz/);
  });

  it('uses the LLM answer and keeps only valid citations', async () => {
    chat.mockResolvedValue('Co 24 miesiące [1][9].');
    const res = await ask('Jak często sporządza się ocenę okresową?');
    expect(res).toMatchObject({
      mode: 'LLM',
      grounded: true,
      answer: 'Co 24 miesiące [1].',
    });
    const [messages] = chat.mock.calls[0];
    expect(messages[0].role).toBe('system');
    expect(messages[1].content).toContain('[1] ');
  });

  it('reports "not in the knowledge base" without calling the LLM', async () => {
    const res = await ask('Jak upiec sernik?');
    expect(res).toMatchObject({
      grounded: false,
      answer: NOT_FOUND,
      sources: [],
    });
    expect(chat).not.toHaveBeenCalled();
  });

  it('trusts the LLM when it says the excerpts do not cover the question', async () => {
    chat.mockResolvedValue('Nie znalazłem tego w bazie wiedzy.');
    const res = await ask('Czy od oceny okresowej przysługuje sprzeciw?');
    expect(res).toMatchObject({
      mode: 'LLM',
      grounded: false,
      answer: NOT_FOUND,
    });
  });

  it('never decides a rating, even with an LLM', async () => {
    chat.mockResolvedValue('Skala ocen to 1–9 [1].');
    const res = await ask(
      'Jaką ocenę powinienem dać pracownikowi za komunikację?',
    );
    expect(res.answer).toMatch(/^Nie mogę rozstrzygnąć/);
  });

  it('builds a deterministic talk plan for a case without the LLM', async () => {
    chat.mockResolvedValue(null);
    const res = await service.ask({
      question: 'Jakie pytania zadać na rozmowie oceniającej?',
      caseId: 'c-001',
    });
    expect(res.mode).toBe('EXTRACTIVE');
    expect(res.answer).toContain('Pytania do rozmowy:');
    expect(res.answer).toContain('Pomysły do IPRZ');
    expect(res.sources.every((s) => !/pierwszej oceny/.test(s.title))).toBe(
      true,
    );
  });

  it('sends case context without personal names to the LLM', async () => {
    chat.mockResolvedValue('Propozycje pytań [1].');
    const res = await service.ask({
      question: 'Jak przekazać informację zwrotną?',
      caseId: 'c-001',
    });
    expect(res.mode).toBe('LLM');
    const [messages] = chat.mock.calls[0];
    expect(messages[1].content).toContain('Kontekst sprawy');
    expect(messages[0].content).toContain('teczce konkretnej sprawy');
    const { person } = cases.detail('c-001');
    const prompt = messages.map((m) => m.content).join('\n');
    expect(prompt).not.toContain(person.lastName);
    expect(prompt).toContain(person.position);
  });

  describe('follow-up questions (history)', () => {
    const history = [
      {
        question: 'Ile dni ma pracownik na sprzeciw od oceny okresowej?',
        answer:
          'Sprzeciw przysługuje w terminie 7 dni od zapoznania się z oceną [1].',
      },
    ];
    const followUp = 'a do kogo się go składa?';
    const isArt83 = (ref: string) => ref.startsWith('art. 83 ust. 1 ');

    it('answers a follow-up without the LLM by gluing the earlier question', async () => {
      chat.mockResolvedValue(null);
      const res = await ask(followUp, { history });
      expect(res).toMatchObject({ grounded: true, mode: 'EXTRACTIVE' });
      expect(isArt83(res.sources[0].ref)).toBe(true);
      expect(res.answer).toContain('dyrektora generalnego urzędu');
    });

    it('searches with the question rewritten by the LLM', async () => {
      chat
        .mockResolvedValueOnce(
          'Do kogo składa się sprzeciw od oceny okresowej?',
        )
        .mockResolvedValueOnce('Do dyrektora generalnego urzędu [1].');
      const res = await ask(followUp, { history });
      expect(res).toMatchObject({
        mode: 'LLM',
        grounded: true,
        answer: 'Do dyrektora generalnego urzędu [1].',
      });
      expect(res.sources.some((s) => isArt83(s.ref))).toBe(true);
      const [rewrite, options] = chat.mock.calls[0];
      expect(rewrite[1].content).toContain(history[0].question);
      expect(rewrite[1].content).toMatch(/Ostatnie pytanie: a do kogo/);
      expect(options).toEqual({ timeoutMs: expect.any(Number) });
      // The answer call sees the conversation, the question as asked.
      const [messages] = chat.mock.calls[1];
      expect(messages.map((m) => m.role)).toEqual([
        'system',
        'user',
        'assistant',
        'user',
      ]);
      expect(messages[1].content).toBe(history[0].question);
      expect(messages[2].content).not.toContain('[1]');
      expect(messages[3].content).toMatch(
        /Pytanie: a do kogo się go składa\?$/,
      );
    });

    it('falls back to the heuristic when the rewrite fails', async () => {
      chat
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('Do dyrektora generalnego urzędu [1].');
      const res = await ask(followUp, { history });
      expect(res).toMatchObject({ mode: 'LLM', grounded: true });
      expect(isArt83(res.sources[0].ref)).toBe(true);
    });

    it('without history, asks the LLM once, as before', async () => {
      chat.mockResolvedValue('Co 24 miesiące [1].');
      await ask('Jak często sporządza się ocenę okresową?');
      expect(chat).toHaveBeenCalledTimes(1);
      expect(chat.mock.calls[0][0]).toHaveLength(2);
    });

    it('gives the conversation assistant the history too', async () => {
      chat
        .mockResolvedValueOnce(
          'Jak przekazać informację zwrotną o mocnych stronach?',
        )
        .mockResolvedValueOnce('Propozycje [1].');
      await service.ask({
        question: 'a o mocnych stronach?',
        caseId: 'c-001',
        history: [
          {
            question: 'Jak przekazać informację zwrotną?',
            answer: 'Metodą SDR [1].',
          },
        ],
      });
      const [messages] = chat.mock.calls[1];
      expect(messages[0].content).toContain('teczce konkretnej sprawy');
      expect(messages[1]).toEqual({
        role: 'user',
        content: 'Jak przekazać informację zwrotną?',
      });
    });
  });

  describe('one assistant for rules and talks', () => {
    it('answers a rule question in a case with sources, not a talk plan', async () => {
      chat.mockResolvedValue(null);
      const res = await ask('Ile dni ma oceniany na sprzeciw?', {
        caseId: 'c-001',
        stageId: 'ASSESSMENT_TALK',
      });
      expect(res).toMatchObject({ mode: 'EXTRACTIVE', grounded: true });
      expect(res.sources.length).toBeGreaterThan(0);
      expect(res.answer).toContain('[1]');
      expect(res.answer).not.toContain('Pytania do rozmowy:');
    });

    it('answers a rule question in a case with the LLM, case context included', async () => {
      chat.mockResolvedValue('Sprzeciw w terminie 7 dni [1].');
      const res = await ask('Ile dni ma oceniany na sprzeciw?', {
        caseId: 'c-001',
      });
      expect(res).toMatchObject({ mode: 'LLM', grounded: true });
      expect(res.sources.length).toBeGreaterThan(0);
      const [messages] = chat.mock.calls[0];
      expect(messages[0].content).toContain('Nie proponuj ocen ani punktów');
      expect(messages[0].content).toContain(
        'Nie znalazłem tego w bazie wiedzy',
      );
      expect(messages[1].content).toContain('Kontekst sprawy');
    });

    it('answers a talk question outside a case', async () => {
      chat.mockResolvedValue(null);
      const res = await ask('Jakie pytania zadać na rozmowie oceniającej?');
      expect(res.grounded).toBe(true);
      expect(res.sources.length).toBeGreaterThan(0);
      expect(res.disclaimer).toMatch(/doradcz/);
    });

    it('says "not in the knowledge base" in a case too', async () => {
      const res = await ask('Jak upiec sernik?', { caseId: 'c-001' });
      expect(res).toMatchObject({ grounded: false, answer: NOT_FOUND });
      expect(chat).not.toHaveBeenCalled();
    });

    it('never decides a rating in a case', async () => {
      chat.mockResolvedValue('Skala ocen to 1–5 [1].');
      const res = await ask(
        'Jaką ocenę powinienem dać pracownikowi za komunikację?',
        { caseId: 'c-001' },
      );
      expect(res.answer).toMatch(/^Nie mogę rozstrzygnąć/);
    });

    it('ignores the legacy `assistant` field', async () => {
      chat.mockResolvedValue(null);
      const formal = await ask('Jakie pytania zadać na rozmowie oceniającej?', {
        assistant: 'FORMAL',
        caseId: 'c-001',
      });
      expect(formal.answer).toContain('Pytania do rozmowy:');
    });
  });

  it('404s for an unknown case', async () => {
    await expect(
      service.ask({
        question: 'Pytanie testowe',
        caseId: 'nope',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('suggests one list per stage, talk questions first on the assessment talk', () => {
    expect(service.suggestions('OPENING_TALK')[0]).toMatch(
      /rozmowie rozpoczynającej/,
    );
    const talk = service.suggestions('ASSESSMENT_TALK');
    expect(talk[0]).toMatch(/pytania zadać/);
    expect(talk).toEqual(
      expect.arrayContaining([expect.stringMatching(/Co omawia się/)]),
    );
    expect(new Set(talk).size).toBe(talk.length);
    for (const stage of [undefined, 'OPENING_TALK', 'DOCUMENT'] as const) {
      const list = service.suggestions(stage);
      expect(list.length).toBeGreaterThanOrEqual(2);
      expect(list.length).toBeLessThanOrEqual(6);
    }
  });
});
