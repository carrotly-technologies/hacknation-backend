import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { loginAs, withToken } from './auth.helpers.js';

describe('Assistant (e2e, no LLM configured)', () => {
  let app: INestApplication<App>;
  let token: string;

  beforeAll(async () => {
    delete process.env.LLM_BASE_URL;
    delete process.env.LLM_MODEL;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    token = await loginAs(app, 'j.kaminska');
  });

  afterAll(async () => {
    await app.close();
  });

  const ask = (body: object) =>
    withToken(app, token).post('/api/assistant/ask').send(body);

  it('answers a rule question extractively with sources', async () => {
    const res = await ask({
      question:
        'W jakim terminie przeprowadza się rozmowę wstępną w pierwszej ocenie?',
      assistant: 'FORMAL',
    }).expect(200);
    expect(res.body).toMatchObject({ grounded: true, mode: 'EXTRACTIVE' });
    expect(res.body.answer).toContain('21 dni');
    const [first] = res.body.sources;
    expect(first).toEqual({
      n: 1,
      title: expect.any(String),
      ref: expect.any(String),
      quote: expect.any(String),
      url: first.url === null ? null : expect.any(String),
    });
    expect(res.body.disclaimer).toMatch(/decyzja należy do oceniającego/);
  });

  it('says when the knowledge base does not cover the question', async () => {
    const res = await ask({
      question: 'Jaka jest stolica Francji?',
      assistant: 'FORMAL',
    }).expect(200);
    expect(res.body).toMatchObject({
      grounded: false,
      mode: 'EXTRACTIVE',
      sources: [],
    });
    expect(res.body.answer).toMatch(/^Nie znalazłem tego w bazie wiedzy/);
  });

  describe('follow-up with history', () => {
    const first = 'Ile dni ma pracownik na sprzeciw od oceny okresowej?';
    const followUp = 'a do kogo się go składa?';

    it('answers the follow-up from the knowledge base with the right source', async () => {
      const one = await ask({ question: first, assistant: 'FORMAL' }).expect(
        200,
      );
      expect(one.body.grounded).toBe(true);
      const res = await ask({
        question: followUp,
        assistant: 'FORMAL',
        history: [{ question: first, answer: one.body.answer }],
      }).expect(200);
      expect(res.body).toMatchObject({ grounded: true, mode: 'EXTRACTIVE' });
      // art. 83 ust. 1 itself or the Q&A entry that restates it.
      expect(res.body.sources[0].quote).toContain(
        'dyrektora generalnego urzędu',
      );
      expect(res.body.sources[0].quote).toMatch(
        /art\. 83 ust\. 1|^Art\. 83\. 1\./,
      );
      expect(res.body.answer).toContain('dyrektora generalnego urzędu');
    });

    it('answers the same without history and with an empty one', async () => {
      const body = { question: first, assistant: 'FORMAL' };
      const plain = await ask(body).expect(200);
      const empty = await ask({ ...body, history: [] }).expect(200);
      expect(empty.body).toEqual(plain.body);
    });

    it('cuts long history instead of rejecting it, and validates its shape', async () => {
      const long = 'x'.repeat(5000);
      await ask({
        question: followUp,
        assistant: 'FORMAL',
        history: Array.from({ length: 5 }, () => ({
          question: first,
          answer: long,
        })),
      }).expect(200);
      await ask({
        question: followUp,
        assistant: 'FORMAL',
        history: [{ question: first }],
      }).expect(400);
      await ask({
        question: followUp,
        assistant: 'FORMAL',
        history: 'nope',
      }).expect(400);
    });
  });

  it('prepares a talk for a case', async () => {
    const res = await ask({
      question: 'Pomóż przygotować rozmowę oceniającą',
      caseId: 'c-001',
      stageId: 'ASSESSMENT_TALK',
    }).expect(200);
    expect(res.body.mode).toBe('EXTRACTIVE');
    expect(res.body.answer).toContain('Pytania do rozmowy:');
  });

  it('answers a rule question in the same case with sources', async () => {
    const res = await ask({
      question: 'Ile dni ma oceniany na sprzeciw?',
      caseId: 'c-001',
      stageId: 'ASSESSMENT_TALK',
    }).expect(200);
    expect(res.body.grounded).toBe(true);
    expect(res.body.sources.length).toBeGreaterThan(0);
    expect(res.body.answer).not.toContain('Pytania do rozmowy:');
  });

  it('answers a talk question outside a case', async () => {
    const res = await ask({
      question: 'Jakie pytania zadać na rozmowie oceniającej?',
    }).expect(200);
    expect(res.body.grounded).toBe(true);
    expect(res.body.sources.length).toBeGreaterThan(0);
  });

  it('still accepts the legacy `assistant` field', async () => {
    await ask({
      question: 'Jak często sporządza się ocenę okresową?',
      assistant: 'CONVERSATION',
    }).expect(200);
  });

  it('validates the body and the case', async () => {
    await ask({ question: '', assistant: 'FORMAL' }).expect(400);
    await ask({ question: 'Pytanie testowe', assistant: 'X' }).expect(400);
    await ask({ question: 'Pytanie testowe', caseId: 'nope' }).expect(404);
  });

  it('GET /api/assistant/suggestions returns questions per stage', async () => {
    const res = await withToken(app, token)
      .get('/api/assistant/suggestions?stageId=FIRST_CONDITIONS')
      .expect(200);
    expect(res.body).toEqual(
      expect.arrayContaining([expect.stringMatching(/pierwszej oceny/)]),
    );
    const talk = await withToken(app, token)
      .get('/api/assistant/suggestions?stageId=ASSESSMENT_TALK')
      .expect(200);
    expect(talk.body[0]).toMatch(/pytania zadać/);
    expect(new Set(talk.body).size).toBe(talk.body.length);
    expect(talk.body.length).toBeLessThanOrEqual(6);
    await withToken(app, token).get('/api/assistant/suggestions').expect(200);
    await withToken(app, token)
      .get('/api/assistant/suggestions?stageId=NOPE')
      .expect(400);
  });
});
