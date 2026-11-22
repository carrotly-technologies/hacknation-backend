import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import type {
  RequestLogEntry,
  SessionDetail,
  SessionPage,
} from './../src/monitor/monitor.types.js';
import { DEMO_PASSWORD, loginAs } from './auth.helpers.js';

const TOKEN = 'test-monitor-token-0123456789';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/133.0';

async function createApp(): Promise<INestApplication<App>> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  return app;
}

describe('Monitor: activity log and sessions (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    delete process.env.DATABASE_URL;
    process.env.MONITOR_TOKEN = TOKEN;
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.MONITOR_TOKEN;
  });

  const server = () => app.getHttpServer();
  const monitor = (path: string, token = TOKEN) =>
    request(server()).get(`/api/monitor${path}`).set('X-Monitor-Token', token);

  /** The writes happen after the response: wait until the session has `count` entries. */
  async function sessionEntries(
    sessionId: string,
    count: number,
  ): Promise<SessionDetail> {
    for (let i = 0; i < 50; i++) {
      const res = await monitor(`/sessions/${sessionId}`);
      if (
        res.status === 200 &&
        (res.body as SessionDetail).entries.length >= count
      )
        return res.body as SessionDetail;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error(`session ${sessionId} has fewer than ${count} entries`);
  }

  it('logs an API call with IP, path, status, session id, user and duration, without the body', async () => {
    const sessionId = randomUUID();
    const token = await loginAs(app, 'k.wisniewska');
    await request(server())
      .post('/api/auth/login')
      .set('X-Session-Id', sessionId)
      .set('X-Forwarded-For', '203.0.113.7, 10.0.0.1')
      .set('User-Agent', UA)
      .send({ login: 'k.wisniewska', password: DEMO_PASSWORD })
      .expect(200);
    await request(server())
      .get('/api/cases?sort=deadline')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Session-Id', sessionId)
      .set('X-Forwarded-For', '203.0.113.7')
      .set('User-Agent', UA)
      .expect(200);

    const { entries, session } = await sessionEntries(sessionId, 2);
    expect(entries.map((e) => [e.kind, e.method, e.path, e.status])).toEqual([
      ['API', 'POST', '/api/auth/login', 200],
      ['API', 'GET', '/api/cases?sort=deadline', 200],
    ]);
    const call = entries[1];
    expect(call).toEqual<RequestLogEntry>({
      id: expect.any(String),
      at: expect.any(String),
      sessionId,
      kind: 'API',
      method: 'GET',
      path: '/api/cases?sort=deadline',
      status: 200,
      durationMs: expect.any(Number),
      ip: '203.0.113.7',
      userAgent: UA,
      userId: 'u-kaminska',
      userName: 'k.wisniewska',
    });
    // The login is public: no user on the request, and never the password.
    expect(entries[0].userId).toBeNull();
    expect(JSON.stringify(entries)).not.toContain(DEMO_PASSWORD);
    expect(session).toMatchObject({
      sessionId,
      anonymous: false,
      users: [{ id: 'u-kaminska', name: 'k.wisniewska' }],
      ips: ['203.0.113.7'],
      userAgent: UA,
      apiCalls: 2,
      pageviews: 0,
      errors: 0,
    });
  });

  it('logs failed calls with their status, an invalid session id as none', async () => {
    const sessionId = randomUUID();
    await request(server())
      .get('/api/me')
      .set('X-Session-Id', sessionId)
      .expect(401);
    await request(server())
      .get('/api/nie-ma-takiej-trasy')
      .set('X-Session-Id', sessionId)
      .expect(404);
    const { entries, session } = await sessionEntries(sessionId, 2);
    expect(entries.map((e) => e.status)).toEqual([401, 404]);
    expect(session.errors).toBe(2);

    await request(server())
      .get('/api/competency-model')
      .set('X-Session-Id', 'nie-uuid')
      .set('User-Agent', 'invalid-session-agent')
      .expect(401);
    const page = await monitor('/sessions?pageSize=200').expect(200);
    const anon = (page.body as SessionPage).items.find(
      (s) => s.userAgent === 'invalid-session-agent',
    );
    expect(anon).toMatchObject({ anonymous: true, apiCalls: 1 });
    const detail = await monitor(`/sessions/${anon!.sessionId}`).expect(200);
    expect((detail.body as SessionDetail).entries[0]).toMatchObject({
      sessionId: null,
      path: '/api/competency-model',
    });
  });

  it('POST /api/telemetry/pageview logs a pageview (204) on the timeline with the calls', async () => {
    const sessionId = randomUUID();
    await request(server())
      .post('/api/telemetry/pageview')
      .set('X-Session-Id', sessionId)
      .send({ path: '/logowanie' })
      .expect(204);
    await request(server())
      .get('/api/config')
      .set('X-Session-Id', sessionId)
      .expect(200);
    await request(server())
      .post('/api/telemetry/pageview')
      .set('X-Session-Id', sessionId)
      .send({ path: '/zapoznanie/sekretny-token?x=1' })
      .expect(204);
    const { entries, session } = await sessionEntries(sessionId, 3);
    expect(entries.map((e) => [e.kind, e.path])).toEqual([
      ['PAGEVIEW', '/logowanie'],
      ['API', '/api/config'],
      // The token of the assessed person's link is never stored.
      ['PAGEVIEW', '/zapoznanie/***?x=1'],
    ]);
    expect(entries[0]).toMatchObject({
      method: null,
      status: null,
      durationMs: null,
    });
    expect(session).toMatchObject({ pageviews: 2, apiCalls: 1 });
  });

  it('rejects an invalid pageview (400)', async () => {
    await request(server())
      .post('/api/telemetry/pageview')
      .send({ path: 'x'.repeat(501) })
      .expect(400);
    await request(server())
      .post('/api/telemetry/pageview')
      .send({})
      .expect(400);
  });

  it('groups entries into sessions, newest first, filtered by IP and account', async () => {
    const older = randomUUID();
    const newer = randomUUID();
    const token = await loginAs(app, 'a.cieslak-dyjecinska');
    await request(server())
      .get('/api/sheets')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Session-Id', older)
      .set('X-Forwarded-For', '198.51.100.1')
      .expect(200);
    await sessionEntries(older, 1);
    await request(server())
      .post('/api/telemetry/pageview')
      .set('X-Session-Id', newer)
      .set('X-Forwarded-For', '198.51.100.2')
      .send({ path: '/hr' })
      .expect(204);
    await sessionEntries(newer, 1);

    const all = (await monitor('/sessions?pageSize=200').expect(200))
      .body as SessionPage;
    const ids = all.items.map((s) => s.sessionId);
    expect(ids.indexOf(newer)).toBeLessThan(ids.indexOf(older));
    expect(all.total).toBe(all.items.length);

    const byIp = (await monitor('/sessions?ip=198.51.100.2').expect(200))
      .body as SessionPage;
    expect(byIp.items.map((s) => s.sessionId)).toEqual([newer]);

    const byUser = (await monitor('/sessions?userId=cieslak').expect(200))
      .body as SessionPage;
    expect(byUser.items.map((s) => s.sessionId)).toContain(older);
    expect(byUser.items.map((s) => s.sessionId)).not.toContain(newer);

    const paged = (await monitor('/sessions?page=1&pageSize=1').expect(200))
      .body as SessionPage;
    expect(paged).toMatchObject({ page: 1, pageSize: 1 });
    expect(paged.items).toHaveLength(1);

    const future = (await monitor('/sessions?from=2999-01-01').expect(200))
      .body as SessionPage;
    expect(future.items).toEqual([]);
  });

  it('answers 404 without the token, with a wrong one, and for a signed-in ADMIN', async () => {
    await request(server()).get('/api/monitor/sessions').expect(404);
    await monitor('/sessions', 'zly-token').expect(404);
    const admin = await loginAs(app, 'admin');
    await request(server())
      .get('/api/monitor/sessions')
      .set('Authorization', `Bearer ${admin}`)
      .expect(404);
    await monitor(`/sessions/${randomUUID()}`, 'zly-token').expect(404);
    // With the right token an unknown session is 404 too.
    await monitor(`/sessions/${randomUUID()}`).expect(404);
  });

  it('does not log calls of the monitor and the health check', async () => {
    const sessionId = randomUUID();
    await request(server())
      .get('/api/health')
      .set('X-Session-Id', sessionId)
      .expect(200);
    await request(server())
      .get('/api/monitor/sessions')
      .set('X-Session-Id', sessionId)
      .set('X-Monitor-Token', TOKEN)
      .expect(200);
    await request(server())
      .get('/api/config')
      .set('X-Session-Id', sessionId)
      .expect(200);
    const { entries } = await sessionEntries(sessionId, 1);
    expect(entries.map((e) => e.path)).toEqual(['/api/config']);
  });
});

describe('Monitor without MONITOR_TOKEN (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    delete process.env.DATABASE_URL;
    delete process.env.MONITOR_TOKEN;
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('every monitor route is 404, whatever the token', async () => {
    await request(app.getHttpServer())
      .get('/api/monitor/sessions')
      .set('X-Monitor-Token', '')
      .expect(404);
    await request(app.getHttpServer())
      .get('/api/monitor/sessions')
      .set('X-Monitor-Token', TOKEN)
      .expect(404);
  });
});
