import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { loginAs, withToken } from './auth.helpers.js';

describe('Config: the assistant is always on (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    delete process.env.LLM_BASE_URL;
    delete process.env.LLM_MODEL;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication<INestApplication<App>>();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/config always reports the assistant as on', async () => {
    await request(app.getHttpServer())
      .get('/api/config')
      .expect(200)
      .expect({ features: { assistant: true } });
  });

  it('serves every /api/assistant/* route', async () => {
    const token = await loginAs(app, 'j.kaminska');
    const http = () => withToken(app, token);
    await http()
      .post('/api/assistant/ask')
      .send({ question: 'Jak liczyć terminy?', assistant: 'FORMAL' })
      .expect(200);
    await http().get('/api/assistant/suggestions').expect(200);
    await http().get('/api/assistant/documents').expect(200);
  });
});
