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
    service.ask({ question, assistant: 'FORMAL', ...extra });

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
      assistant: 'CONVERSATION',
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
      assistant: 'CONVERSATION',
      caseId: 'c-001',
    });
    expect(res.mode).toBe('LLM');
    const [messages] = chat.mock.calls[0];
    expect(messages[1].content).toContain('Kontekst sprawy');
    expect(messages[0].content).toContain('Tryb asystenta rozmowy');
    const { person } = cases.detail('c-001');
    const prompt = messages.map((m) => m.content).join('\n');
    expect(prompt).not.toContain(person.lastName);
    expect(prompt).toContain(person.position);
  });

  it('404s for an unknown case', async () => {
    await expect(
      service.ask({
        question: 'Pytanie testowe',
        assistant: 'CONVERSATION',
        caseId: 'nope',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('suggests questions per stage', () => {
    expect(service.suggestions('OPENING_TALK')[0]).toMatch(
      /rozmowie rozpoczynającej/,
    );
    expect(service.suggestions().length).toBeGreaterThan(0);
  });
});
