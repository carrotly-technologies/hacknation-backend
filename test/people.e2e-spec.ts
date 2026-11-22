import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { loginAs, resetDemo, withToken } from './auth.helpers.js';

// p-nowak, p-mazur, p-dabrowska: cases of the demo supervisor (j.kaminska);
// p-wieczorek: a case of another evaluator (ev-sikora).
describe('People: employee profile (e2e)', () => {
  let app: INestApplication<App>;
  let supervisor: string;
  let hr: string;
  let admin: string;

  beforeAll(async () => {
    process.env.DEMO_TODAY = '2026-11-21';
    delete process.env.DATABASE_URL;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    supervisor = await loginAs(app, 'j.kaminska');
    hr = await loginAs(app, 'a.lis');
    admin = await loginAs(app, 'admin');
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDemo(app);
  });

  const asSupervisor = () => withToken(app, supervisor);

  it('GET /api/people/:personId returns data, supervisor, history and current case', async () => {
    const res = await asSupervisor().get('/api/people/p-nowak').expect(200);
    expect(res.body).toEqual({
      person: {
        id: 'p-nowak',
        firstName: 'Anna',
        lastName: 'Nowak',
        position: expect.any(String),
        unit: expect.any(String),
        employment: 'URZEDNIK',
        hiredOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      },
      supervisor: {
        firstName: 'Joanna',
        lastName: 'Kamińska',
        position: 'Naczelnik wydziału',
        unit: expect.any(String),
      },
      osp: {
        title: expect.any(String),
        purpose: expect.any(String),
        mainTasks: expect.arrayContaining([expect.any(String)]),
      },
      history: [
        {
          source: 'SYSTEM',
          caseId: 'c-001',
          path: 'PERIODIC',
          cycleLabel: expect.stringContaining('Ocena okresowa'),
          status: 'W_TOKU',
          result: null,
          level: null,
          signedByEvaluatorOn: null,
          acknowledgedOn: null,
        },
        {
          source: 'EXTERNAL',
          result: 'POSITIVE',
          level: 'powyżej oczekiwań',
          date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        },
      ],
      currentCase: {
        id: 'c-001',
        path: 'PERIODIC',
        currentStage: 'ASSESSMENT',
      },
      nextAssessment: 'OKRESOWA',
      canStartCase: false,
    });
  });

  it('a signed and acknowledged assessment carries its result and dates', async () => {
    const res = await asSupervisor().get('/api/people/p-dabrowska').expect(200);
    expect(res.body.history[0]).toMatchObject({
      caseId: 'c-006',
      result: 'POSITIVE',
      signedByEvaluatorOn: expect.any(String),
      acknowledgedOn: expect.any(String),
    });
  });

  it('the first assessment path: current FIRST case, PIERWSZA next', async () => {
    const res = await asSupervisor().get('/api/people/p-mazur').expect(200);
    expect(res.body.currentCase).toMatchObject({ id: 'c-004', path: 'FIRST' });
    expect(res.body.nextAssessment).toBe('PIERWSZA');
    // The first assessment case has no OSP attached.
    expect(res.body.osp).toBeNull();
  });

  it("a supervisor gets 404 for someone else's employee and an unknown person", async () => {
    const other = await asSupervisor()
      .get('/api/people/p-wieczorek')
      .expect(404);
    expect(other.body.message).toBe('Nie znaleziono pracownika „p-wieczorek”.');
    await asSupervisor().get('/api/people/p-nobody').expect(404);
  });

  it('HR sees every employee', async () => {
    const res = await withToken(app, hr)
      .get('/api/people/p-wieczorek')
      .expect(200);
    expect(res.body.person.id).toBe('p-wieczorek');
    expect(res.body.supervisor.lastName).toBe('Sikora');
    await withToken(app, hr).get('/api/people/p-nowak').expect(200);
  });

  it('PATCH /api/people/:personId saves the data; 400 for a future date; 404 without access', async () => {
    const data = {
      position: 'Starszy specjalista',
      unit: 'Wydział Kadr',
      employment: 'PRACOWNIK',
      hiredOn: '2020-01-15',
    };
    const res = await asSupervisor()
      .patch('/api/people/p-nowak')
      .send(data)
      .expect(200);
    expect(res.body.person).toMatchObject(data);
    const again = await asSupervisor().get('/api/people/p-nowak').expect(200);
    expect(again.body.person).toMatchObject(data);
    const caseRes = await asSupervisor().get('/api/cases/c-001').expect(200);
    expect(caseRes.body.person.position).toBe('Starszy specjalista');

    await asSupervisor()
      .patch('/api/people/p-nowak')
      .send({ ...data, hiredOn: '2099-01-01' })
      .expect(400);
    await asSupervisor()
      .patch('/api/people/p-nowak')
      .send({ ...data, position: ' ' })
      .expect(400);
    await asSupervisor()
      .patch('/api/people/p-wieczorek')
      .send(data)
      .expect(404);
  });

  it('ADMIN gets 403', async () => {
    await withToken(app, admin).get('/api/people/p-nowak').expect(403);
  });
});
