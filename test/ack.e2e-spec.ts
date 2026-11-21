import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { CaseStore } from './../src/cases/case-store.service.js';
import { configureApp } from './../src/configure-app.js';
import { loginAs, withToken } from './auth.helpers.js';

/** c-101: signed by Robert Sikora, waiting for the assessed person. */
describe('Link for the assessed person (e2e)', () => {
  let app: INestApplication<App>;
  let sikora: string;
  let kaminska: string;
  let hr: string;

  beforeAll(async () => {
    process.env.DEMO_TODAY = '2026-11-21';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    sikora = await loginAs(app, 'r.sikora');
    kaminska = await loginAs(app, 'j.kaminska');
    hr = await loginAs(app, 'a.lis');
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await withToken(app, sikora).post('/api/demo/reset').expect(200);
  });

  const anon = () => request(app.getHttpServer());
  const sendForAck = async (id = 'c-101', token = sikora) => {
    const res = await withToken(app, token)
      .post(`/api/cases/${id}/actions`)
      .send({ action: 'SEND_FOR_ACK' })
      .expect(200);
    return res.body as { ackLink: string; ackLinkExpiresOn: string };
  };
  const tokenOf = (link: string) => link.replace('/zapoznanie/', '');

  it('generates the link only after the evaluator signed', async () => {
    const res = await withToken(app, kaminska)
      .post('/api/cases/c-001/actions')
      .send({ action: 'SEND_FOR_ACK' })
      .expect(409);
    expect(res.body.message).toContain('Najpierw zatwierdź ocenę');
    const view = await withToken(app, kaminska)
      .get('/api/cases/c-001')
      .expect(200);
    expect(view.body.ackLink).toBeNull();
  });

  it('gives the link to the evaluator only, never the token itself', async () => {
    const body = await sendForAck();
    expect(body.ackLink).toMatch(/^\/zapoznanie\/[A-Za-z0-9_-]{43}$/);
    expect(body.ackLinkExpiresOn).toBe('2026-12-05');
    expect(JSON.stringify(body)).not.toContain('ackToken');

    const own = await withToken(app, sikora)
      .get('/api/cases/c-101')
      .expect(200);
    expect(own.body.ackLink).toBe(body.ackLink);
    const asHr = await withToken(app, hr).get('/api/cases/c-101').expect(200);
    expect(asHr.body.ackLink).toBeNull();
    expect(JSON.stringify(asHr.body)).not.toContain(tokenOf(body.ackLink));
  });

  it('opens the read-only sheet without signing in, then confirms', async () => {
    const token = tokenOf((await sendForAck()).ackLink);

    const read = await anon().get(`/api/ack/${token}`).expect(200);
    expect(read.body).toMatchObject({
      acknowledgedOn: null,
      expiresOn: '2026-12-05',
      case: {
        path: 'PERIODIC',
        sheetId: 'C',
        person: { firstName: 'Karolina', lastName: 'Wieczorek' },
        evaluator: { lastName: 'Sikora' },
        decisions: { rzetelnosc: 7 },
        evaluation: { result: 'POSITIVE' },
        signedByEvaluatorOn: expect.any(String),
      },
      sheet: {
        id: 'C',
        template: { objectionNotice: expect.stringContaining('sprzeciw') },
      },
      scale: expect.arrayContaining([{ points: 5, label: expect.any(String) }]),
    });
    expect(read.body.competencies).toContainEqual({
      id: 'rzetelnosc',
      name: expect.any(String),
    });
    // data minimisation: no ids, observations, ratings or history
    for (const key of ['id', 'observations', 'ratings', 'history', 'osp']) {
      expect(read.body.case).not.toHaveProperty(key);
    }
    expect(read.body.case.person).not.toHaveProperty('id');

    await anon().post(`/api/ack/${token}`).send({}).expect(400);
    await anon()
      .post(`/api/ack/${token}`)
      .send({ confirmed: 'true' })
      .expect(400);

    const done = await anon()
      .post(`/api/ack/${token}`)
      .send({ confirmed: true })
      .expect(200);
    expect(done.body).toEqual({
      acknowledgedOn: '2026-11-21',
      objectionDeadline: expect.objectContaining({
        date: '2026-11-30',
        legalBasis: expect.stringContaining('art. 83'),
      }),
    });

    const view = await withToken(app, sikora)
      .get('/api/cases/c-101')
      .expect(200);
    expect(view.body).toMatchObject({
      acknowledgedOn: '2026-11-21',
      status: 'OKRES_SPRZECIWU',
      objectionDeadline: { date: '2026-11-30' },
      ackLink: null,
    });

    // re-entering the link shows only the date
    const again = await anon().get(`/api/ack/${token}`).expect(200);
    expect(again.body).toEqual(done.body);
    await anon()
      .post(`/api/ack/${token}`)
      .send({ confirmed: true })
      .expect(200);
  });

  it('a new link revokes the previous one', async () => {
    const first = tokenOf((await sendForAck()).ackLink);
    const second = tokenOf((await sendForAck()).ackLink);
    expect(second).not.toBe(first);
    const res = await anon().get(`/api/ack/${first}`).expect(404);
    expect(res.body.message).toContain('Link jest nieważny');
    await anon()
      .post(`/api/ack/${first}`)
      .send({ confirmed: true })
      .expect(404);
    await anon().get(`/api/ack/${second}`).expect(200);
  });

  it('404s an unknown or expired token', async () => {
    await anon().get('/api/ack/nie-ma-takiego').expect(404);
    const token = tokenOf((await sendForAck()).ackLink);
    const store = app.get(CaseStore);
    store.save({ ...store.find('c-101')!, ackTokenExpiresOn: '2026-11-20' });
    const res = await anon().get(`/api/ack/${token}`).expect(404);
    expect(res.body.message).toContain('Poproś przełożonego o nowy link');
    await anon()
      .post(`/api/ack/${token}`)
      .send({ confirmed: true })
      .expect(404);
  });
});
