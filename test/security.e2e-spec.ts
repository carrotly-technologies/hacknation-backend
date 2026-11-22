import { createHmac } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { DEV_JWT_SECRET } from './../src/auth/jwt-secret.js';
import { USER_SEED } from './../src/auth/users.seed.js';
import { configureApp } from './../src/configure-app.js';
import {
  DEFAULT_RATE_LIMIT_LOGIN_PER_MINUTE,
  DEFAULT_RATE_LIMIT_PER_MINUTE,
} from './../src/security/security.config.js';
import { DEMO_PASSWORD } from './auth.helpers.js';

const FRONTEND = 'https://kompas.example.gov.pl';
const loginOf = (id: string) => USER_SEED.find((u) => u.id === id)!.login;
const SUPERVISOR = loginOf('u-kaminska');
const OTHER_SUPERVISOR = 'u-pawlak';

const b64 = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

/** A JWT signed by hand, to send what the API must refuse. */
function jwt(
  header: object,
  claims: object,
  secret: string | null = DEV_JWT_SECRET,
): string {
  const input = `${b64(header)}.${b64(claims)}`;
  const alg = (header as { alg?: string }).alg;
  if (!secret || alg === 'none') return `${input}.`;
  const hash = alg === 'HS512' ? 'sha512' : 'sha256';
  return `${input}.${createHmac(hash, secret).update(input).digest('base64url')}`;
}

const now = () => Math.floor(Date.now() / 1000);

describe('Security: headers, rate limits, sessions, validation (e2e)', () => {
  let app: INestApplication<App>;
  /** Each test signs in from its own client IP (X-Forwarded-For), so only the rate-limit tests share a counter. */
  let ip = 0;
  const nextIp = () => `203.0.113.${++ip}`;

  beforeAll(async () => {
    process.env.DEMO_TODAY = '2026-11-21';
    process.env.FRONTEND_URL = FRONTEND;
    // The production defaults, not the lifted limits of vitest.config.e2e.ts.
    delete process.env.RATE_LIMIT_PER_MINUTE;
    delete process.env.RATE_LIMIT_LOGIN_PER_MINUTE;
    delete process.env.JWT_SECRET;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const anon = () => request(app.getHttpServer());
  const login = (user: string, from = nextIp(), password = DEMO_PASSWORD) =>
    anon()
      .post('/api/auth/login')
      .set('X-Forwarded-For', from)
      .send({ login: user, password });
  const tokenFor = async (user: string) =>
    ((await login(user).expect(200)).body as { accessToken: string })
      .accessToken;
  const as = (token: string) => ({
    get: (url: string) =>
      anon().get(url).set('Authorization', `Bearer ${token}`),
    patch: (url: string) =>
      anon().patch(url).set('Authorization', `Bearer ${token}`),
    post: (url: string) =>
      anon().post(url).set('Authorization', `Bearer ${token}`),
  });

  describe('headers', () => {
    it('sends the helmet security headers and hides Express', async () => {
      const res = await anon().get('/api/health').expect(200);
      expect(res.headers).toMatchObject({
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'strict-transport-security': expect.stringContaining('max-age='),
        'referrer-policy': 'no-referrer',
        'cross-origin-opener-policy': 'same-origin',
        'cache-control': 'no-store',
      });
      expect(res.headers).not.toHaveProperty('x-powered-by');
      // A JSON API: the frontend's nginx sets the page CSP.
      expect(res.headers).not.toHaveProperty('content-security-policy');
    });

    it('still serves Swagger UI (no CSP from the API)', async () => {
      const ui = await anon().get('/api/swagger/').expect(200);
      expect(ui.headers['content-type']).toContain('text/html');
      expect(ui.headers).not.toHaveProperty('content-security-policy');
      await anon().get('/api/swagger.json').expect(200);
    });

    it('lets browsers cache the public source documents', async () => {
      const res = await anon()
        .get('/api/docs/ocena-okresowa/rozporzadzenie-oceny-okresowe-2016.pdf')
        .expect(200);
      expect(res.headers['cache-control']).not.toBe('no-store');
      expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
    });

    it('allows CORS for FRONTEND_URL only', async () => {
      const ok = await anon()
        .options('/api/auth/login')
        .set('Origin', FRONTEND)
        .set('Access-Control-Request-Method', 'POST');
      expect(ok.headers['access-control-allow-origin']).toBe(FRONTEND);
      const other = await anon()
        .options('/api/auth/login')
        .set('Origin', 'https://evil.example')
        .set('Access-Control-Request-Method', 'POST');
      expect(other.headers['access-control-allow-origin']).not.toBe(
        'https://evil.example',
      );
      expect(other.headers['access-control-allow-origin']).not.toBe('*');
    });
  });

  // Several scrypt sign-ins in a row: slower than the default 5 s on a busy machine.
  describe('rate limits', { timeout: 30_000 }, () => {
    it(`answers the ${DEFAULT_RATE_LIMIT_LOGIN_PER_MINUTE + 1}th sign-in of a minute from one IP with 429`, async () => {
      const from = nextIp();
      for (let i = 0; i < DEFAULT_RATE_LIMIT_LOGIN_PER_MINUTE; i++) {
        await login(SUPERVISOR, from, i % 2 ? DEMO_PASSWORD : 'zle').expect(
          i % 2 ? 200 : 401,
        );
      }
      const res = await login(SUPERVISOR, from).expect(429);
      expect(res.body.message).toBe(
        'Zbyt wiele prób logowania. Spróbuj ponownie za minutę.',
      );
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
      // Another client (X-Forwarded-For from the trusted proxy) still signs in.
      await login(SUPERVISOR, nextIp()).expect(200);
    });

    it('limits the confirmation link of the assessed person the same way', async () => {
      const from = nextIp();
      for (let i = 0; i < DEFAULT_RATE_LIMIT_LOGIN_PER_MINUTE; i++) {
        await anon()
          .post('/api/ack/zgadywany-token')
          .set('X-Forwarded-For', from)
          .send({ confirmed: true })
          .expect(404);
      }
      const res = await anon()
        .post('/api/ack/zgadywany-token')
        .set('X-Forwarded-For', from)
        .send({ confirmed: true })
        .expect(429);
      expect(res.body.message).toContain('Zbyt wiele prób');
    });

    it(`limits other routes to ${DEFAULT_RATE_LIMIT_PER_MINUTE} a minute per client`, async () => {
      const from = nextIp();
      const get = () => anon().get('/api/config').set('X-Forwarded-For', from);
      for (let i = 0; i < DEFAULT_RATE_LIMIT_PER_MINUTE; i++) {
        await get().expect(200);
      }
      const res = await get().expect(429);
      expect(res.body.message).toContain('Zbyt wiele żądań');
      await anon()
        .get('/api/config')
        .set('X-Forwarded-For', nextIp())
        .expect(200);
    });
  });

  describe('session tokens', { timeout: 30_000 }, () => {
    const claims = (over: object = {}) => ({
      sub: 'u-admin',
      jti: 'test-jti',
      iat: now(),
      exp: now() + 3600,
      ...over,
    });
    const me = (token: string) => as(token).get('/api/me');

    it('accepts a token signed the way the API signs them (control)', async () => {
      await me(jwt({ alg: 'HS256', typ: 'JWT' }, claims())).expect(200);
    });

    it('refuses alg "none"', async () => {
      await me(jwt({ alg: 'none', typ: 'JWT' }, claims(), null)).expect(401);
    });

    it('refuses another algorithm with the right key (HS512)', async () => {
      await me(jwt({ alg: 'HS512', typ: 'JWT' }, claims())).expect(401);
    });

    it('refuses another key', async () => {
      await me(
        jwt({ alg: 'HS256', typ: 'JWT' }, claims(), 'x'.repeat(48)),
      ).expect(401);
    });

    it('refuses an expired token', async () => {
      await me(
        jwt(
          { alg: 'HS256', typ: 'JWT' },
          claims({ iat: now() - 9 * 3600, exp: now() - 3600 }),
        ),
      ).expect(401);
    });

    it('issues tokens for at most 8 hours', async () => {
      const res = await login(SUPERVISOR).expect(200);
      expect(res.body.expiresIn).toBeLessThanOrEqual(8 * 3600);
      const payload = JSON.parse(
        Buffer.from(res.body.accessToken.split('.')[1], 'base64url').toString(),
      ) as { exp: number; iat: number };
      expect(payload.exp - payload.iat).toBeLessThanOrEqual(8 * 3600);
    });

    it('ends the session at sign-out', async () => {
      const token = await tokenFor(SUPERVISOR);
      await me(token).expect(200);
      await as(token).post('/api/auth/logout').expect(204);
      await me(token).expect(401);
      // Other sessions of the same account go on.
      await me(await tokenFor(SUPERVISOR)).expect(200);
    });

    it('ends the sessions of a user whose role an ADMIN changed', async () => {
      const admin = await tokenFor('admin');
      const user = await tokenFor(loginOf(OTHER_SUPERVISOR));
      try {
        await me(user).expect(200);
        await as(admin)
          .patch(`/api/admin/users/${OTHER_SUPERVISOR}`)
          .send({ role: 'HR' })
          .expect(200);
        await me(user).expect(401);
        const again = await tokenFor(loginOf(OTHER_SUPERVISOR));
        expect((await me(again).expect(200)).body.role).toBe('HR');
      } finally {
        await as(admin)
          .patch(`/api/admin/users/${OTHER_SUPERVISOR}`)
          .send({ role: 'SUPERVISOR' })
          .expect(200);
      }
    });
  });

  describe('input validation', () => {
    it('answers broken JSON with a Polish 400', async () => {
      const res = await anon()
        .post('/api/auth/login')
        .set('X-Forwarded-For', nextIp())
        .set('Content-Type', 'application/json')
        .send('{zly json')
        .expect(400);
      expect(res.body.message).toContain('poprawnym JSON-em');
    });

    it('rejects unknown fields (400)', async () => {
      await anon()
        .post('/api/auth/login')
        .set('X-Forwarded-For', nextIp())
        .send({ login: SUPERVISOR, password: DEMO_PASSWORD, role: 'ADMIN' })
        .expect(400);
      const token = await tokenFor(SUPERVISOR);
      await as(token)
        .patch('/api/cases/c-001')
        .send({ iprz: 'x', evaluatorId: 'ev-pawlak' })
        .expect(400);
      await as(token)
        .patch('/api/cases/c-001')
        .send({ partI: { confirmedByEvaluatorOn: '2026-11-01' } })
        .expect(400);
    });

    it('rejects malformed ids in the path (400)', async () => {
      const token = await tokenFor(SUPERVISOR);
      const res = await as(token)
        .get('/api/cases/c-001%20OR%201=1')
        .expect(400);
      expect(JSON.stringify(res.body.message)).toContain(
        'Nieprawidłowy identyfikator',
      );
      await as(token)
        .get(`/api/cases/${'a'.repeat(129)}`)
        .expect(400);
      await anon().get('/api/ack/..%2F..%2Fetc').expect(400);
    });

    it('refuses a body over the limit (413)', async () => {
      const token = await tokenFor(SUPERVISOR);
      const res = await as(token)
        .post('/api/assistant/ask')
        .send({ question: 'x'.repeat(1.1 * 1024 * 1024) })
        .expect(413);
      expect(res.body.message).toBe(
        'Przesłane dane są zbyt duże (limit: 1mb).',
      );
    });
  });
});
