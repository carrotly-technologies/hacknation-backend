import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { loginAs, withToken } from './auth.helpers.js';

describe('Authentication, roles and permissions (e2e)', () => {
  let app: INestApplication<App>;
  let kaminska: string;
  let sikora: string;
  let hr: string;
  let admin: string;

  beforeAll(async () => {
    process.env.DEMO_TODAY = '2026-11-21';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    [kaminska, sikora, hr, admin] = await Promise.all(
      ['j.kaminska', 'r.sikora', 'a.lis', 'admin'].map((l) => loginAs(app, l)),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await withToken(app, kaminska).post('/api/demo/reset').expect(200);
  });

  const OBSERVATION = {
    date: '2026-11-20',
    criterionId: 'komunikacja',
    indicatorId: null,
    kind: 'STRENGTH',
    situation: 'x',
    action: '',
    result: '',
  };
  const anon = () => request(app.getHttpServer());
  const as = (token: string) => withToken(app, token);

  describe('sign-in', () => {
    it('returns an 8 h bearer token and the user', async () => {
      const res = await anon()
        .post('/api/auth/login')
        .send({ login: 'J.Kaminska', password: 'Kompas2026!' })
        .expect(200);
      expect(res.body).toMatchObject({
        tokenType: 'Bearer',
        expiresIn: 8 * 3600,
        user: { id: 'u-kaminska', role: 'SUPERVISOR', name: 'Joanna Kamińska' },
      });
      expect(res.body.user).not.toHaveProperty('passwordHash');
      expect(res.body.accessToken.split('.')).toHaveLength(3);
    });

    it('answers a wrong password and an unknown login with the same 401', async () => {
      const wrong = await anon()
        .post('/api/auth/login')
        .send({ login: 'j.kaminska', password: 'nope' })
        .expect(401);
      const unknown = await anon()
        .post('/api/auth/login')
        .send({ login: 'nobody', password: 'nope' })
        .expect(401);
      expect(wrong.body.message).toBe('Nieprawidłowy login lub hasło.');
      expect(unknown.body).toEqual(wrong.body);
    });

    it('validates the body (400)', async () => {
      await anon().post('/api/auth/login').send({ login: 'x' }).expect(400);
    });

    it('logout is a no-op 204', async () => {
      await anon().post('/api/auth/logout').expect(204);
    });
  });

  describe('401 without a valid token', () => {
    it.each([
      ['get', '/api/cases'],
      ['get', '/api/cases/c-001'],
      ['get', '/api/team'],
      ['get', '/api/me'],
      ['get', '/api/hr/overview'],
      ['get', '/api/admin/users'],
      ['get', '/api/docs'],
      ['get', '/api/competency-model'],
      ['post', '/api/demo/reset'],
    ] as const)('%s %s', async (method, path) => {
      await anon()[method](path).expect(401);
    });

    it('rejects a forged token', async () => {
      await anon()
        .get('/api/cases')
        .set('Authorization', `Bearer ${kaminska.slice(0, -4)}AAAA`)
        .expect(401);
    });

    it('keeps health, config, login and the doc files public', async () => {
      await anon().get('/api/health').expect(200);
      await anon().get('/api/config').expect(200);
      await anon()
        .get('/api/docs/ocena-okresowa/rozporzadzenie-oceny-okresowe-2016.pdf')
        .expect(200);
    });
  });

  describe('GET /api/me', () => {
    it.each([
      ['hr', 'HR', 'Agnieszka Lis'],
      ['admin', 'ADMIN', 'Marek Zając'],
      ['sikora', 'SUPERVISOR', 'Robert Sikora'],
    ])('returns the signed-in %s', async (who, role, name) => {
      const token = { hr, admin, sikora }[who]!;
      const res = await as(token).get('/api/me').expect(200);
      expect(res.body).toMatchObject({ role, name });
    });
  });

  describe('supervisor scope', () => {
    it('lists only own cases', async () => {
      const mine = await as(kaminska).get('/api/cases').expect(200);
      expect(mine.body.map((c: { id: string }) => c.id)).toEqual([
        'c-001',
        'c-002',
        'c-003',
        'c-004',
        'c-005',
        'c-006',
      ]);
      const theirs = await as(sikora).get('/api/cases').expect(200);
      expect(theirs.body.map((c: { id: string }) => c.id)).toEqual([
        'c-101',
        'c-102',
      ]);
      const team = await as(sikora).get('/api/team').expect(200);
      expect(team.body.cases).toHaveLength(2);
    });

    it("403 on another supervisor's case: read, edit, observe, act", async () => {
      await as(sikora).get('/api/cases/c-001').expect(403);
      await as(sikora)
        .patch('/api/cases/c-001')
        .send({ iprz: 'x' })
        .expect(403);
      await as(sikora)
        .post('/api/cases/c-001/observations')
        .send(OBSERVATION)
        .expect(403);
      await as(sikora)
        .post('/api/cases/c-002/actions')
        .send({ action: 'ACCEPT_OSP_ANALYSIS' })
        .expect(403);
      await as(kaminska).get('/api/cases/c-101').expect(403);
      await as(sikora).get('/api/cases/c-101').expect(200);
    });

    it('404 still comes first for an unknown case', async () => {
      await as(sikora).get('/api/cases/nope').expect(404);
    });

    it("403 for the assistant with another supervisor's case", async () => {
      await as(sikora)
        .post('/api/assistant/ask')
        .send({
          question: 'Jak przekazać informację zwrotną?',
          assistant: 'CONVERSATION',
          caseId: 'c-001',
        })
        .expect(403);
    });

    it('403 on the HR panel and the admin API', async () => {
      await as(kaminska).get('/api/hr/overview').expect(403);
      await as(kaminska).get('/api/admin/users').expect(403);
    });
  });

  describe('HR', () => {
    it('sees the HR panel and every case', async () => {
      await as(hr).get('/api/hr/overview').expect(200);
      const all = await as(hr).get('/api/cases').expect(200);
      expect(all.body).toHaveLength(10);
      const detail = await as(hr).get('/api/cases/c-001').expect(200);
      expect(detail.body.status).toBe('W_TOKU');
    });

    it('cannot edit assessments (403)', async () => {
      await as(hr).patch('/api/cases/c-001').send({ iprz: 'x' }).expect(403);
      await as(hr)
        .post('/api/cases/c-001/actions')
        .send({ action: 'SIGN_ASSESSMENT' })
        .expect(403);
      await as(hr)
        .post('/api/cases/c-001/observations')
        .send(OBSERVATION)
        .expect(403);
      await as(hr).get('/api/team').expect(403);
      await as(hr).get('/api/admin/users').expect(403);
    });

    it('uses the shared resources', async () => {
      await as(hr).get('/api/docs').expect(200);
      await as(hr).get('/api/competency-model').expect(200);
      await as(hr).get('/api/assistant/suggestions').expect(200);
    });
  });

  describe('ADMIN', () => {
    it('lists users without password hashes', async () => {
      const res = await as(admin).get('/api/admin/users').expect(200);
      expect(res.body.map((u: { login: string }) => u.login)).toEqual([
        'j.kaminska',
        'r.sikora',
        'a.pawlak',
        'a.lis',
        'admin',
      ]);
      expect(JSON.stringify(res.body)).not.toContain('scrypt');
    });

    it('changes a role, which applies to that user from then on', async () => {
      try {
        const res = await as(admin)
          .patch('/api/admin/users/u-pawlak')
          .send({ role: 'HR' })
          .expect(200);
        expect(res.body).toMatchObject({ id: 'u-pawlak', role: 'HR' });
        const token = await loginAs(app, 'a.pawlak');
        const me = await as(token).get('/api/me').expect(200);
        expect(me.body.role).toBe('HR');
        await as(token).get('/api/hr/overview').expect(200);
        await as(token).get('/api/team').expect(403);
      } finally {
        await as(admin)
          .patch('/api/admin/users/u-pawlak')
          .send({ role: 'SUPERVISOR' })
          .expect(200);
      }
    });

    it('validates the role, the user and self-demotion', async () => {
      await as(admin)
        .patch('/api/admin/users/u-pawlak')
        .send({ role: 'BOSS' })
        .expect(400);
      await as(admin)
        .patch('/api/admin/users/nope')
        .send({ role: 'HR' })
        .expect(404);
      await as(admin)
        .patch('/api/admin/users/u-admin')
        .send({ role: 'HR' })
        .expect(409);
    });

    it('has no access to cases or the HR panel', async () => {
      await as(admin).get('/api/cases').expect(403);
      await as(admin).get('/api/hr/overview').expect(403);
    });
  });
});
