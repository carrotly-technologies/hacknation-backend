import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { loginAs, withToken } from './auth.helpers.js';

describe('Source documents (e2e)', () => {
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
    token = await loginAs(app, 'k.wisniewska');
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (path: string) => withToken(app, token).get(path);

  it('serves a PDF from docs/', async () => {
    const res = await get(
      '/api/docs/ocena-okresowa/rozporzadzenie-oceny-okresowe-2016.pdf',
    )
      .buffer(true)
      .expect(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toMatch(/^inline/);
    expect(
      Buffer.from(res.body as Buffer)
        .subarray(0, 5)
        .toString(),
    ).toBe('%PDF-');
  });

  it('serves a docx with its content type', async () => {
    const res = await get('/api/docs/ocena-okresowa/arkusz-oceny-c.docx')
      .buffer(true)
      .expect(200);
    expect(res.headers['content-type']).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
  });

  it.each([
    '/api/docs/../package.json',
    '/api/docs/%2e%2e/package.json',
    '/api/docs/..%2fpackage.json',
    '/api/docs/ocena-okresowa/..%2f..%2fpackage.json',
    '/api/docs/%2fetc%2fpasswd',
    '/api/docs/ocena-okresowa',
    '/api/docs/nie-ma.pdf',
  ])('returns 404 for %s', async (path) => {
    await get(path).expect(404);
  });

  it('lists the documents with descriptions at /api/docs', async () => {
    const res = await get('/api/docs').expect(200);
    const docs = res.body as { id: string; description: string }[];
    expect(docs).toEqual(
      (await get('/api/assistant/documents').expect(200)).body,
    );
    for (const d of docs) expect(d.description, d.id).not.toBe('');
  });

  it('lists the documents with links', async () => {
    const res = await get('/api/assistant/documents').expect(200);
    const docs = res.body as {
      id: string;
      title: string;
      url: string | null;
      indexed: boolean;
      note: string | null;
    }[];
    expect(docs.length).toBeGreaterThanOrEqual(15);
    const ro = docs.find((d) => d.id === 'RO')!;
    expect(ro).toMatchObject({ indexed: true, note: null });
    await get(ro.url!).expect(200);
    for (const d of docs.filter((x) => x.url?.startsWith('/api/docs/'))) {
      await get(d.url!).expect(200);
    }
    expect(docs.find((d) => d.id === 'opis-zadania')?.indexed).toBe(false);
  });

  it('lists the civil service act and the HR standards with their PDFs', async () => {
    const docs = (await get('/api/docs').expect(200)).body as {
      id: string;
      url: string | null;
      indexed: boolean;
    }[];
    for (const [id, url] of [
      ['U', '/api/docs/akty-prawne/ustawa-o-sluzbie-cywilnej.pdf'],
      ['SZ', '/api/docs/akty-prawne/standardy-zzl.pdf'],
    ]) {
      expect(docs.find((d) => d.id === id)).toMatchObject({
        url,
        indexed: true,
      });
      await get(url).expect(200);
    }
  });

  it('answers from the HR standards with a link to their page', async () => {
    const res = await withToken(app, token)
      .post('/api/assistant/ask')
      .send({ question: 'Co standardy ZZL mówią o IPRZ?', assistant: 'FORMAL' })
      .expect(200);
    const sources = res.body.sources as { ref: string; url: string | null }[];
    expect(sources).toContainEqual(
      expect.objectContaining({
        ref: expect.stringContaining('cz. VI pkt 2 standardów ZZL'),
        url: '/api/docs/akty-prawne/standardy-zzl.pdf#page=16',
      }),
    );
  });

  it('links each source of an answer, PDFs on their page', async () => {
    const res = await withToken(app, token)
      .post('/api/assistant/ask')
      .send({
        question:
          'W jakim terminie przeprowadza się rozmowę rozpoczynającą ocenę okresową?',
        assistant: 'FORMAL',
      })
      .expect(200);
    const sources = res.body.sources as { ref: string; url: string | null }[];
    expect(sources.length).toBeGreaterThan(0);
    const ro = sources.find((s) => s.ref.includes('ocen okresowych (2016)'));
    expect(ro?.url).toMatch(
      /^\/api\/docs\/ocena-okresowa\/rozporzadzenie-oceny-okresowe-2016\.pdf#page=\d+$/,
    );
  });
});
