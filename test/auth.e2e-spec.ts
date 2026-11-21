import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { asUser } from './auth.helpers.js';

describe('Demo account switching, roles and permissions (e2e)', () => {
  let app: INestApplication<App>;
  const kaminska = 'u-kaminska';
  const sikora = 'u-sikora';
  const hr = 'u-lis';
  const admin = 'u-admin';

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
  });

  beforeEach(async () => {
    await as(kaminska).post('/api/demo/reset').expect(200);
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
  const as = (userId: string) => asUser(app, userId);
  const ids = (body: { id: string }[]) => body.map((c) => c.id);
  const KAMINSKA_CASES = ['c-001', 'c-002', 'c-003', 'c-004', 'c-005', 'c-006'];

  describe('no sign-in', () => {
    it('has no login or logout route', async () => {
      await anon()
        .post('/api/auth/login')
        .send({ login: 'j.kaminska', password: 'Kompas2026!' })
        .expect(404);
      await anon().post('/api/auth/logout').expect(404);
    });

    it('acts as j.kaminska (SUPERVISOR) without X-User-Id', async () => {
      const me = await anon().get('/api/me').expect(200);
      expect(me.body).toMatchObject({
        id: 'u-kaminska',
        role: 'SUPERVISOR',
        name: 'Joanna Kamińska',
      });
      const cases = await anon().get('/api/cases').expect(200);
      expect(ids(cases.body)).toEqual(KAMINSKA_CASES);
    });

    it('acts as the account from X-User-Id (trimmed)', async () => {
      const me = await anon()
        .get('/api/me')
        .set('X-User-Id', '  u-sikora ')
        .expect(200);
      expect(me.body).toMatchObject({ id: 'u-sikora', name: 'Robert Sikora' });
    });

    it('answers an unknown id with 400 and a Polish message', async () => {
      const res = await as('u-nobody').get('/api/cases').expect(400);
      expect(res.body.message).toContain('u-nobody');
      await as('u-nobody').get('/api/me').expect(400);
    });

    it('keeps health, config, the demo accounts and the doc files public', async () => {
      await as('u-nobody').get('/api/health').expect(200);
      await as('u-nobody').get('/api/config').expect(200);
      await as('u-nobody').get('/api/users/demo').expect(200);
      await anon()
        .get('/api/docs/ocena-okresowa/rozporzadzenie-oceny-okresowe-2016.pdf')
        .expect(200);
    });
  });

  describe('GET /api/users/demo', () => {
    it('lists every demo account as UserView, without internal links', async () => {
      const res = await anon().get('/api/users/demo').expect(200);
      expect(ids(res.body)).toEqual([
        'u-kaminska',
        'u-sikora',
        'u-pawlak',
        'u-lis',
        'u-admin',
      ]);
      expect(res.body[0]).toEqual({
        id: 'u-kaminska',
        login: 'j.kaminska',
        name: 'Joanna Kamińska',
        firstName: 'Joanna',
        lastName: 'Kamińska',
        role: 'SUPERVISOR',
        position: 'Naczelnik wydziału',
        unit: 'Wydział Analiz i Koordynacji, Departament Spraw Cyfrowych',
      });
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|evaluatorId/);
    });
  });

  describe('GET /api/me', () => {
    it.each([
      [hr, 'HR', 'Agnieszka Lis'],
      [admin, 'ADMIN', 'Marek Zając'],
      [sikora, 'SUPERVISOR', 'Robert Sikora'],
    ])('returns the account %s', async (userId, role, name) => {
      const res = await as(userId).get('/api/me').expect(200);
      expect(res.body).toMatchObject({ role, name });
    });
  });

  describe('supervisor scope', () => {
    it('lists only own cases', async () => {
      const mine = await as(kaminska).get('/api/cases').expect(200);
      expect(ids(mine.body)).toEqual(KAMINSKA_CASES);
      const theirs = await as(sikora).get('/api/cases').expect(200);
      expect(ids(theirs.body)).toEqual(['c-101', 'c-102']);
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
    it('lists users', async () => {
      const res = await as(admin).get('/api/admin/users').expect(200);
      expect(res.body.map((u: { login: string }) => u.login)).toEqual([
        'j.kaminska',
        'r.sikora',
        'a.pawlak',
        'a.lis',
        'admin',
      ]);
    });

    it('changes a role, which applies to that user from the next request', async () => {
      try {
        const res = await as(admin)
          .patch('/api/admin/users/u-pawlak')
          .send({ role: 'HR' })
          .expect(200);
        expect(res.body).toMatchObject({ id: 'u-pawlak', role: 'HR' });
        const me = await as('u-pawlak').get('/api/me').expect(200);
        expect(me.body.role).toBe('HR');
        await as('u-pawlak').get('/api/hr/overview').expect(200);
        await as('u-pawlak').get('/api/team').expect(403);
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
