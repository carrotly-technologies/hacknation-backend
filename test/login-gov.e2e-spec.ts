import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { withToken } from './auth.helpers.js';

/** Fictional demo PESELs from src/auth/users.seed.ts. */
const PESEL = {
  wisniewska: '78031504123',
  lis: '90022703645',
  admin: '68093017792',
};
/** Valid check digit, no account. */
const UNKNOWN_PESEL = '44051401458';

describe('Sign-in through the simulated login.gov.pl (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.DEMO_TODAY = '2026-11-21';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  const anon = () => request(app.getHttpServer());

  async function start(): Promise<string> {
    const res = await anon().post('/api/auth/login-gov/start').expect(200);
    return (res.body as { state: string }).state;
  }

  async function authorize(state: string, pesel: string): Promise<string> {
    const res = await anon()
      .post('/api/auth/login-gov/mock-authorize')
      .send({ state, pesel, method: 'profil-zaufany' })
      .expect(200);
    return (res.body as { artifact: string }).artifact;
  }

  it('start returns a random state and the mock page URL', async () => {
    const res = await anon().post('/api/auth/login-gov/start').expect(200);
    const { state, redirectUrl } = res.body as {
      state: string;
      redirectUrl: string;
    };
    expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const url = new URL(redirectUrl);
    expect(url.pathname).toBe('/mock-login-gov');
    expect(url.searchParams.get('state')).toBe(state);
  });

  it.each([
    ['wisniewska', 'u-kaminska', 'SUPERVISOR'],
    ['lis', 'u-lis', 'HR'],
    ['admin', 'u-admin', 'ADMIN'],
  ] as const)('full flow signs %s in', async (who, id, role) => {
    const state = await start();
    const artifact = await authorize(state, PESEL[who]);
    const res = await anon()
      .post('/api/auth/login-gov')
      .send({ artifact, state })
      .expect(200);
    expect(res.body).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: 8 * 3600,
      user: { id, role },
    });
    expect(JSON.stringify(res.body)).not.toContain(PESEL[who]);
    const me = await withToken(app, res.body.accessToken)
      .get('/api/me')
      .expect(200);
    expect(me.body).toMatchObject({ id, role });
    expect(JSON.stringify(me.body)).not.toContain(PESEL[who]);
  });

  it('a used artifact is rejected (401)', async () => {
    const state = await start();
    const artifact = await authorize(state, PESEL.wisniewska);
    await anon()
      .post('/api/auth/login-gov')
      .send({ artifact, state })
      .expect(200);
    const again = await anon()
      .post('/api/auth/login-gov')
      .send({ artifact, state })
      .expect(401);
    expect(again.body.message).toContain('już użyty');
  });

  it('an expired artifact is rejected (401)', async () => {
    const state = await start();
    const artifact = await authorize(state, PESEL.wisniewska);
    const later = Date.now() + 61_000;
    const spy = vi.spyOn(Date, 'now').mockReturnValue(later);
    try {
      await anon()
        .post('/api/auth/login-gov')
        .send({ artifact, state })
        .expect(401);
    } finally {
      spy.mockRestore();
    }
  });

  it('a wrong or unknown state is rejected (400)', async () => {
    const state = await start();
    const artifact = await authorize(state, PESEL.wisniewska);
    const other = await start();
    await anon()
      .post('/api/auth/login-gov')
      .send({ artifact, state: other })
      .expect(400);
    const bogus = 'A'.repeat(43);
    await anon()
      .post('/api/auth/login-gov/mock-authorize')
      .send({ state: bogus, pesel: PESEL.wisniewska, method: 'bank' })
      .expect(400);
    await anon()
      .post('/api/auth/login-gov')
      .send({ artifact, state: bogus })
      .expect(400);
    await anon()
      .post('/api/auth/login-gov')
      .send({ artifact: 'x', state: 'y' })
      .expect(400);
  });

  it('an unknown PESEL gets 401 "Brak konta dla tej osoby"', async () => {
    const state = await start();
    const artifact = await authorize(state, UNKNOWN_PESEL);
    const res = await anon()
      .post('/api/auth/login-gov')
      .send({ artifact, state })
      .expect(401);
    expect(res.body.message).toBe('Brak konta dla tej osoby.');
  });

  it('validates the mock-authorize body (400)', async () => {
    const state = await start();
    await anon()
      .post('/api/auth/login-gov/mock-authorize')
      .send({ state, pesel: '78031504124', method: 'bank' })
      .expect(400);
    await anon()
      .post('/api/auth/login-gov/mock-authorize')
      .send({ state, pesel: PESEL.wisniewska, method: 'haslo' })
      .expect(400);
  });

  it('never returns or logs a PESEL (users list, audit log)', async () => {
    const state = await start();
    const artifact = await authorize(state, PESEL.admin);
    const res = await anon()
      .post('/api/auth/login-gov')
      .send({ artifact, state })
      .expect(200);
    const users = await withToken(app, res.body.accessToken)
      .get('/api/admin/users')
      .expect(200);
    const body = JSON.stringify(users.body);
    for (const p of Object.values(PESEL)) expect(body).not.toContain(p);
    const audit = await withToken(app, res.body.accessToken)
      .get('/api/admin/audit')
      .expect(200);
    const actions = (audit.body.items as { action: string }[]).map(
      (e) => e.action,
    );
    expect(actions).toEqual(
      expect.arrayContaining(['LOGIN_GOV', 'LOGIN_GOV_FAILED']),
    );
    const log = JSON.stringify(audit.body);
    for (const p of [...Object.values(PESEL), UNKNOWN_PESEL])
      expect(log).not.toContain(p);
  });
});
