import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { CaseStore } from './../src/cases/case-store.service.js';
import { configureApp } from './../src/configure-app.js';
import { RetentionService } from './../src/retention/retention.service.js';
import { loginAs, resetDemo, withToken } from './auth.helpers.js';

/**
 * Free text about the assessed person and internal fields of a case
 * (`lastReminderOn` is not here: the HR overview needs it).
 */
const CASE_INTERNALS = [
  'ackToken',
  'ackTokenExpiresOn',
  'evaluatorId',
  'observations',
  'ratings',
  'deviationNotes',
  'justification',
  'iprz',
  'history',
  'cycleStart',
];

const keysOf = (value: object) => Object.keys(value).sort();

/** docs/rodo: data minimisation and retention, checked through the API. */
describe('RODO (e2e)', () => {
  let app: INestApplication<App>;
  let sikora: string;
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
    sikora = await loginAs(app, 'r.sikora');
    hr = await loginAs(app, 'a.lis');
    admin = await loginAs(app, 'admin');
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDemo(app);
  });

  describe('minimisation', () => {
    it('GET /api/ack/:token returns only what the sheet prints', async () => {
      const sent = await withToken(app, sikora)
        .post('/api/cases/c-101/actions')
        .send({ action: 'SEND_FOR_ACK' })
        .expect(200);
      const token = (sent.body.ackLink as string).replace('/zapoznanie/', '');
      const { body } = await request(app.getHttpServer())
        .get(`/api/ack/${token}`)
        .expect(200);

      expect(keysOf(body)).toEqual(
        [
          'acknowledgedOn',
          'case',
          'competencies',
          'expiresOn',
          'scale',
          'sheet',
        ].sort(),
      );
      expect(keysOf(body.case)).toEqual(
        [
          'path',
          'sheetId',
          'officeName',
          'person',
          'evaluator',
          'stages',
          'partI',
          'decisions',
          'evaluation',
          'justification',
          'iprz',
          'previousAssessment',
          'promotionRequest',
          'firstConditions',
          'assessmentTalkOn',
          'signedByEvaluatorOn',
          'acknowledgedOn',
        ].sort(),
      );
      expect(keysOf(body.case.person)).toEqual(
        [
          'firstName',
          'lastName',
          'position',
          'unit',
          'employment',
          'hiredOn',
        ].sort(),
      );
      expect(keysOf(body.case.evaluator)).toEqual(
        ['firstName', 'lastName', 'position', 'unit'].sort(),
      );
      expect(keysOf(body.case.partI)).toEqual(
        [
          'additionalCriteria',
          'assessmentDue',
          'confirmedByEvaluatorOn',
          'acknowledgedByEmployeeOn',
        ].sort(),
      );
      for (const s of body.case.stages) {
        expect(keysOf(s)).toEqual(['completedOn', 'id']);
      }
      const text = JSON.stringify(body);
      for (const key of [
        ...CASE_INTERNALS.filter((k) => !['justification', 'iprz'].includes(k)),
        'c-101',
        'osp',
      ]) {
        expect(text).not.toContain(`"${key}"`);
      }
    });

    it('lists and the HR overview carry no free text about the person', async () => {
      const lists = [
        (await withToken(app, hr).get('/api/hr/overview').expect(200)).body
          .cases,
        (await withToken(app, hr).get('/api/cases').expect(200)).body,
        (await withToken(app, sikora).get('/api/team').expect(200)).body.cases,
      ] as object[][];
      for (const list of lists) {
        expect(list.length).toBeGreaterThan(0);
        for (const item of list) {
          for (const key of CASE_INTERNALS) {
            expect(item).not.toHaveProperty(key);
          }
        }
      }
    });

    it('the case view never holds the link secret, only the derived link', async () => {
      for (const token of [sikora, hr]) {
        const { body } = await withToken(app, token)
          .get('/api/cases/c-101')
          .expect(200);
        for (const key of [
          'ackToken',
          'evaluatorId',
          'cycleStart',
          'lastReminderOn',
        ]) {
          expect(body).not.toHaveProperty(key);
        }
        expect(body.evaluator).not.toHaveProperty('id');
      }
    });

    it('the employee profile has no assessment texts', async () => {
      const team = await withToken(app, sikora).get('/api/team').expect(200);
      const personId = team.body.cases[0].person.id as string;
      const { body } = await withToken(app, sikora)
        .get(`/api/people/${personId}`)
        .expect(200);
      const text = JSON.stringify(body);
      for (const key of [
        'justification',
        'observations',
        'ratings',
        'iprz',
        'ackToken',
      ]) {
        expect(text).not.toContain(`"${key}"`);
      }
    });

    it('admin user list has no password hashes', async () => {
      const { body } = await withToken(app, admin)
        .get('/api/admin/users')
        .expect(200);
      for (const user of body as object[]) {
        expect(keysOf(user)).toEqual(
          [
            'firstName',
            'id',
            'lastName',
            'login',
            'name',
            'position',
            'role',
            'unit',
          ].sort(),
        );
      }
    });
  });

  describe('retention', () => {
    it('anonymizes a case that ended over RETENTION_YEARS ago and leaves the rest', async () => {
      const store = app.get(CaseStore);
      const old = store.find('c-102')!;
      store.save({ ...old, acknowledgedOn: '2015-12-01' });
      const before = (
        await withToken(app, sikora).get('/api/cases/c-101').expect(200)
      ).body;

      const report = await app.get(RetentionService).run();
      expect(report).toMatchObject({
        years: 10,
        cutoff: '2016-11-21',
        casesAnonymized: 1,
      });

      const anon = (
        await withToken(app, sikora).get('/api/cases/c-102').expect(200)
      ).body;
      expect(anon.person).toMatchObject({
        id: 'anon-c-102',
        firstName: 'Osoba',
        lastName: 'zanonimizowana',
      });
      expect(anon).toMatchObject({
        justification: '',
        observations: [],
        iprz: '',
      });
      expect(JSON.stringify(anon)).not.toContain(old.person.lastName);
      const hrView = await withToken(app, hr)
        .get('/api/hr/overview')
        .expect(200);
      expect(
        (
          hrView.body.cases as { id: string; person: { lastName: string } }[]
        ).find((c) => c.id === 'c-102')!.person.lastName,
      ).toBe('zanonimizowana');

      expect(
        (await withToken(app, sikora).get('/api/cases/c-101').expect(200)).body,
      ).toEqual(before);
      expect((await app.get(RetentionService).run()).casesAnonymized).toBe(0);
    });
  });
});
