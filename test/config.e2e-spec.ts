import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';

async function createApp(): Promise<INestApplication<App>> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  return app;
}

describe('Config and FEATURE_ASSISTANT (e2e)', () => {
  const original = process.env.FEATURE_ASSISTANT;
  let app: INestApplication<App> | undefined;

  beforeAll(() => {
    delete process.env.LLM_BASE_URL;
    delete process.env.LLM_MODEL;
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    if (original === undefined) delete process.env.FEATURE_ASSISTANT;
    else process.env.FEATURE_ASSISTANT = original;
  });

  it('enables the assistant when the flag is not set', async () => {
    delete process.env.FEATURE_ASSISTANT;
    app = await createApp();
    await request(app.getHttpServer())
      .get('/api/config')
      .expect(200)
      .expect({ features: { assistant: true } });
    await request(app.getHttpServer())
      .post('/api/assistant/ask')
      .send({ question: 'Jak liczyć terminy?', assistant: 'FORMAL' })
      .expect(200);
  });

  it('hides the assistant with FEATURE_ASSISTANT=false', async () => {
    process.env.FEATURE_ASSISTANT = 'false';
    app = await createApp();
    await request(app.getHttpServer())
      .get('/api/config')
      .expect(200)
      .expect({ features: { assistant: false } });
    await request(app.getHttpServer())
      .post('/api/assistant/ask')
      .send({ question: 'Jak liczyć terminy?', assistant: 'FORMAL' })
      .expect(404);
    await request(app.getHttpServer())
      .get('/api/assistant/suggestions')
      .expect(404);
    await request(app.getHttpServer())
      .get('/api/assistant/documents')
      .expect(404);
    const docs = await request(app.getHttpServer())
      .get('/api/docs')
      .expect(200);
    expect((docs.body as unknown[]).length).toBeGreaterThan(0);
    await request(app.getHttpServer())
      .get('/api/docs/ocena-okresowa/rozporzadzenie-oceny-okresowe-2016.pdf')
      .expect(200);
  });
});
