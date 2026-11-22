import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { CaseStore } from './../src/cases/case-store.service.js';
import { configureApp } from './../src/configure-app.js';
import { loginAs, resetDemo, withToken } from './auth.helpers.js';

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
    await resetDemo(app);
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
      objection: null,
      objectionOpen: true,
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

  describe('objection (art. 83 ust. 1)', () => {
    const object = (token: string, body: object) =>
      anon().post(`/api/ack/${token}/objection`).send(body);
    const ack = (token: string) =>
      anon().post(`/api/ack/${token}`).send({ confirmed: true }).expect(200);

    it('is refused before the acknowledgement', async () => {
      const token = tokenOf((await sendForAck()).ackLink);
      const res = await object(token, {
        text: 'Uwagi',
        confirmed: true,
      }).expect(409);
      expect(res.body.message).toContain('Najpierw potwierdź zapoznanie');
      const read = await anon().get(`/api/ack/${token}`).expect(200);
      expect(read.body.acknowledgedOn).toBeNull();
    });

    it('validates the text and the confirmation', async () => {
      const token = tokenOf((await sendForAck()).ackLink);
      await ack(token);
      await object(token, { text: '   ', confirmed: true }).expect(400);
      await object(token, { text: 'x'.repeat(4001), confirmed: true }).expect(
        400,
      );
      await object(token, { text: 'Uwagi' }).expect(400);
      await object(token, { text: 'Uwagi', confirmed: 'true' }).expect(400);
      await anon()
        .post('/api/ack/nie-ma-takiego/objection')
        .send({ text: 'Uwagi', confirmed: true })
        .expect(404);
    });

    it('is filed once within the term and shown to the evaluator and HR', async () => {
      const token = tokenOf((await sendForAck()).ackLink);
      await ack(token);
      const text = '  <b>Nie zgadzam się</b> z oceną kryterium rzetelność.  ';
      const res = await object(token, { text, confirmed: true }).expect(200);
      expect(res.body).toMatchObject({
        acknowledgedOn: '2026-11-21',
        objection: { text: text.trim(), submittedOn: '2026-11-21' },
        objectionOpen: false,
      });

      // the link still works and shows the objection read-only
      const again = await anon().get(`/api/ack/${token}`).expect(200);
      expect(again.body).toEqual(res.body);
      expect(again.body).not.toHaveProperty('case');

      const second = await object(token, {
        text: 'Drugi raz',
        confirmed: true,
      }).expect(409);
      expect(second.body.message).toContain('już przekazane 21.11.2026');

      const view = await withToken(app, sikora)
        .get('/api/cases/c-101')
        .expect(200);
      expect(view.body.objection).toEqual({
        text: text.trim(),
        submittedOn: '2026-11-21',
      });
      expect(view.body.history.at(-1).text).toBe(
        'Oceniany wniósł sprzeciw od oceny 21.11.2026.',
      );
      const asHr = await withToken(app, hr).get('/api/cases/c-101').expect(200);
      expect(asHr.body.objection.submittedOn).toBe('2026-11-21');

      const overview = await withToken(app, hr)
        .get('/api/hr/overview')
        .expect(200);
      const cases = overview.body.cases as {
        id: string;
        objectionSubmittedOn: string | null;
      }[];
      expect(cases.find((c) => c.id === 'c-101')!.objectionSubmittedOn).toBe(
        '2026-11-21',
      );
      expect(cases.find((c) => c.id === 'c-006')!.objectionSubmittedOn).toBe(
        null,
      );
    });

    it('the link outlives the 14 days until the term ends, then reports it', async () => {
      const token = tokenOf((await sendForAck()).ackLink);
      await ack(token);
      const store = app.get(CaseStore);
      // acknowledged 5 days ago, the link itself expired long ago
      store.save({
        ...store.find('c-101')!,
        acknowledgedOn: '2026-11-16',
        ackTokenExpiresOn: '2026-11-01',
      });
      const open = await anon().get(`/api/ack/${token}`).expect(200);
      expect(open.body).toMatchObject({
        objectionDeadline: { date: '2026-11-23' },
        objectionOpen: true,
      });

      store.save({ ...store.find('c-101')!, acknowledgedOn: '2026-11-12' });
      const closed = await anon().get(`/api/ack/${token}`).expect(200);
      expect(closed.body).toMatchObject({
        objectionDeadline: { date: '2026-11-19' },
        objection: null,
        objectionOpen: false,
      });
      const res = await object(token, {
        text: 'Za późno',
        confirmed: true,
      }).expect(409);
      expect(res.body.message).toContain('Termin na sprzeciw minął 19.11.2026');
    });
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
