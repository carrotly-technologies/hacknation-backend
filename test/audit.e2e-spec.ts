import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { AUDITED_ROUTES, routeKey } from './../src/audit/audit-actions.js';
import { USER_SEED } from './../src/auth/users.seed.js';
import { configureApp } from './../src/configure-app.js';
import {
  DEMO_PASSWORD,
  loginAs,
  resetDemo,
  withToken,
} from './auth.helpers.js';

/** Demo logins by account id, so a renamed demo account does not break the test. */
const loginOf = (id: string) => USER_SEED.find((u) => u.id === id)!.login;

interface Entry {
  id: string;
  at: string;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  actionLabel: string;
  resourceType: string | null;
  resourceTypeLabel: string | null;
  resourceId: string | null;
  changedFields: string[];
  ip: string | null;
  result: string;
}

describe('Audit log (e2e)', () => {
  let app: INestApplication<App>;
  let admin: string;
  let supervisor: string;
  let hr: string;

  beforeAll(async () => {
    process.env.DEMO_TODAY = '2026-11-21';
    delete process.env.DATABASE_URL;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    admin = await loginAs(app, loginOf('u-admin'));
    supervisor = await loginAs(app, loginOf('u-kaminska'));
    hr = await loginAs(app, loginOf('u-lis'));
    await resetDemo(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const latest = async (query = ''): Promise<Entry[]> =>
    (await withToken(app, admin).get(`/api/admin/audit${query}`).expect(200))
      .body.items as Entry[];

  it('only ADMIN reads the log (401 anonymous, 403 other roles)', async () => {
    await request(app.getHttpServer()).get('/api/admin/audit').expect(401);
    for (const token of [supervisor, hr]) {
      await withToken(app, token).get('/api/admin/audit').expect(403);
      await withToken(app, token).get('/api/admin/audit/verify').expect(403);
      await withToken(app, token).get('/api/admin/audit/actions').expect(403);
    }
  });

  it('records a case action with who, what, which case and when', async () => {
    await withToken(app, supervisor)
      .post('/api/cases/c-001/actions')
      .send({ action: 'SEND_FOR_ACK' })
      .expect(409);
    await withToken(app, supervisor)
      .patch('/api/cases/c-001')
      .send({ justification: 'Tajne uzasadnienie oceny 123.' })
      .expect(200);

    const [patch, action] = await latest('?actorId=u-kaminska');
    expect(patch).toMatchObject({
      actorId: 'u-kaminska',
      actorName: 'Joanna Kamińska',
      actorRole: 'SUPERVISOR',
      action: 'CASE_PATCH',
      actionLabel: 'Zmiana danych w ocenie',
      resourceType: 'CASE',
      resourceTypeLabel: 'Ocena',
      resourceId: 'c-001',
      changedFields: ['justification'],
      result: 'OK',
    });
    expect(Date.now() - Date.parse(patch.at)).toBeLessThan(60_000);
    expect(patch.ip).toEqual(expect.any(String));
    expect(action).toMatchObject({
      action: 'CASE_ACTION:SEND_FOR_ACK',
      actionLabel: 'Akcja w ocenie: Przekaż do zapoznania',
      resourceId: 'c-001',
      result: 'ERROR',
    });
    // Field names only: never the content of the assessment.
    const all = await withToken(app, admin)
      .get('/api/admin/audit?pageSize=200')
      .expect(200);
    expect(JSON.stringify(all.body)).not.toContain('Tajne uzasadnienie');
  });

  it('records sign-ins, failed ones without the login typed or the password', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: loginOf('u-lis'), password: 'zle-haslo-987' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: 'nie.ma.takiego', password: DEMO_PASSWORD })
      .expect(401);
    const [unknown, wrongPassword] = await latest('?action=LOGIN_FAILED');
    expect(wrongPassword).toMatchObject({
      actorId: null,
      action: 'LOGIN_FAILED',
      resourceType: 'USER',
      resourceId: 'u-lis',
      changedFields: [],
      result: 'DENIED',
    });
    expect(unknown).toMatchObject({ resourceId: null, result: 'DENIED' });
    const body = JSON.stringify(await latest());
    expect(body).not.toContain('zle-haslo-987');
    expect(body).not.toContain('nie.ma.takiego');

    await loginAs(app, loginOf('u-lis'));
    const [ok] = await latest('?action=LOGIN');
    expect(ok).toMatchObject({
      actorId: 'u-lis',
      actorRole: 'HR',
      action: 'LOGIN',
      result: 'OK',
    });
  });

  it('records a change refused by the role guard as DENIED', async () => {
    await withToken(app, hr)
      .patch('/api/cases/c-001')
      .send({ iprz: 'x' })
      .expect(403);
    await expect
      .poll(async () => (await latest('?actorId=u-lis'))[0])
      .toMatchObject({
        action: 'CASE_PATCH',
        resourceId: 'c-001',
        changedFields: ['iprz'],
        result: 'DENIED',
      });
  });

  it('logs the assessed person on the link as ASSESSED_VIA_LINK, with the case and not the token', async () => {
    const sikora = await loginAs(app, loginOf('u-sikora'));
    const sent = await withToken(app, sikora)
      .post('/api/cases/c-101/actions')
      .send({ action: 'SEND_FOR_ACK' })
      .expect(200);
    const token = (sent.body.ackLink as string).replace('/zapoznanie/', '');
    await request(app.getHttpServer())
      .post(`/api/ack/${token}`)
      .send({ confirmed: true })
      .expect(200);
    const [ack] = await latest('?action=ACK_CONFIRM');
    expect(ack).toMatchObject({
      actorId: null,
      actorRole: 'ASSESSED_VIA_LINK',
      resourceType: 'CASE',
      resourceId: 'c-101',
      changedFields: ['confirmed'],
      result: 'OK',
    });
    expect(JSON.stringify(await latest('?pageSize=200'))).not.toContain(token);
  });

  it('demo reset adds DEMO_RESET and keeps the log', async () => {
    const before = (await withToken(app, admin).get('/api/admin/audit'))
      .body as { total: number };
    await resetDemo(app);
    const after = await withToken(app, admin)
      .get('/api/admin/audit')
      .expect(200);
    // + the admin's sign-in of resetDemo + DEMO_RESET
    expect(after.body.total).toBe(before.total + 2);
    expect(after.body.items[0]).toMatchObject({
      action: 'DEMO_RESET',
      actorId: 'u-admin',
      result: 'OK',
    });
  });

  it('filters, pages and verifies the chain', async () => {
    const page = await withToken(app, admin)
      .get('/api/admin/audit?page=2&pageSize=2')
      .expect(200);
    expect(page.body).toMatchObject({ page: 2, pageSize: 2 });
    expect(page.body.items).toHaveLength(2);
    expect(page.body.total).toBeGreaterThan(4);

    const caseActions = await latest('?action=CASE_ACTION');
    expect(caseActions.length).toBeGreaterThan(0);
    expect(caseActions.every((e) => e.action.startsWith('CASE_ACTION:'))).toBe(
      true,
    );
    expect(await latest('?from=2000-01-01&to=2000-01-02')).toEqual([]);

    const bad = await withToken(app, admin)
      .get('/api/admin/audit?pageSize=1000&from=wczoraj')
      .expect(400);
    expect(bad.body.message.join(' ')).toContain('pageSize');

    const verify = await withToken(app, admin)
      .get('/api/admin/audit/verify')
      .expect(200);
    expect(verify.body).toEqual({ ok: true, count: page.body.total });

    const actions = await withToken(app, admin)
      .get('/api/admin/audit/actions')
      .expect(200);
    expect(actions.body).toContainEqual({
      action: 'USER_ROLE_CHANGED',
      label: 'Zmiana roli użytkownika',
    });
  });

  it('every data-changing route has an entry in AUDITED_ROUTES', () => {
    const router = (
      app.getHttpAdapter().getInstance() as {
        router: {
          stack: {
            route?: { path: string; methods: Record<string, boolean> };
          }[];
        };
      }
    ).router;
    // Nest mounts middleware (AuditMiddleware) as a route of every method; skip those.
    const mutating = router.stack.flatMap((layer) =>
      layer.route && Object.keys(layer.route.methods).length < 10
        ? Object.keys(layer.route.methods)
            .map((m) => m.toUpperCase())
            .filter((m) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(m))
            .map((m) => routeKey(m, layer.route!.path))
        : [],
    );
    expect(mutating.length).toBeGreaterThan(15);
    expect(mutating.filter((key) => !(key in AUDITED_ROUTES))).toEqual([]);
  });
});
