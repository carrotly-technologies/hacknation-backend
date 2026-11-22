import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { REWRITE_PROMPT } from './../src/assistant/followup.rules.js';
import { loginAs, withToken } from './auth.helpers.js';

interface Message {
  role: string;
  content: string;
}

/**
 * Fake OpenAI-compatible endpoint: rewrites the follow-up, answers the rest,
 * and records the messages it got.
 */
function fakeLlm(calls: Message[][]): Server {
  return createServer((req, res) => {
    let raw = '';
    req.on('data', (c: Buffer) => (raw += c.toString()));
    req.on('end', () => {
      const { messages } = JSON.parse(raw) as { messages: Message[] };
      calls.push(messages);
      const content =
        messages[0].content === REWRITE_PROMPT
          ? 'Do kogo składa się sprzeciw od oceny okresowej?'
          : 'Sprzeciw składa się do dyrektora generalnego urzędu [1].';
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ choices: [{ message: { content } }] }));
    });
  });
}

describe('Assistant (e2e, OpenAI-compatible LLM)', () => {
  let app: INestApplication<App>;
  let server: Server;
  let token: string;
  const calls: Message[][] = [];

  beforeAll(async () => {
    server = fakeLlm(calls);
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    const { port } = server.address() as AddressInfo;
    process.env.LLM_BASE_URL = `http://127.0.0.1:${port}/v1`;
    process.env.LLM_MODEL = 'fake';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    token = await loginAs(app, 'k.wisniewska');
  });

  afterAll(async () => {
    await app.close();
    await new Promise((done) => server.close(done));
    delete process.env.LLM_BASE_URL;
    delete process.env.LLM_MODEL;
  });

  beforeEach(() => {
    calls.length = 0;
  });

  const ask = (body: object) =>
    withToken(app, token).post('/api/assistant/ask').send(body);

  it('rewrites the follow-up for retrieval and answers with the conversation', async () => {
    const first = 'Ile dni ma pracownik na sprzeciw od oceny okresowej?';
    const res = await ask({
      question: 'a do kogo się go składa?',
      assistant: 'FORMAL',
      history: [{ question: first, answer: 'W terminie 7 dni [1].' }],
    }).expect(200);
    expect(res.body).toMatchObject({
      grounded: true,
      mode: 'LLM',
      answer: 'Sprzeciw składa się do dyrektora generalnego urzędu [1].',
    });
    expect(
      res.body.sources.some((s: { ref: string }) =>
        s.ref.startsWith('art. 83 ust. 1 '),
      ),
    ).toBe(true);
    expect(calls).toHaveLength(2);
    const [rewrite, answer] = calls;
    expect(rewrite[0].content).toBe(REWRITE_PROMPT);
    expect(answer.map((m) => m.role)).toEqual([
      'system',
      'user',
      'assistant',
      'user',
    ]);
    expect(answer[1].content).toBe(first);
  });

  it('makes one call without history, as before', async () => {
    await ask({
      question: 'Jak często sporządza się ocenę okresową?',
      assistant: 'FORMAL',
    }).expect(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toHaveLength(2);
  });
});
