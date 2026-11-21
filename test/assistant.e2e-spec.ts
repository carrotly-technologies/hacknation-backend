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

  it('prepares a talk for a case', async () => {
    const res = await ask({
      question: 'Pomóż przygotować rozmowę oceniającą',
      assistant: 'CONVERSATION',
      caseId: 'c-001',
      stageId: 'ASSESSMENT',
    }).expect(200);
    expect(res.body.mode).toBe('EXTRACTIVE');
    expect(res.body.answer).toContain('Pytania do rozmowy:');
  });

  it('validates the body and the case', async () => {
    await ask({ question: '', assistant: 'FORMAL' }).expect(400);
    await ask({ question: 'Pytanie testowe', assistant: 'X' }).expect(400);
    await ask({
      question: 'Pytanie testowe',
      assistant: 'CONVERSATION',
      caseId: 'nope',
    }).expect(404);
  });

  it('GET /api/assistant/suggestions returns questions per stage', async () => {
    const res = await withToken(app, token)
      .get('/api/assistant/suggestions?stageId=FIRST_CONDITIONS')
      .expect(200);
    expect(res.body).toEqual(
      expect.arrayContaining([expect.stringMatching(/pierwszej oceny/)]),
    );
    await withToken(app, token).get('/api/assistant/suggestions').expect(200);
    await withToken(app, token)
      .get('/api/assistant/suggestions?stageId=NOPE')
      .expect(400);
  });
});
