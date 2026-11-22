import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { JournalRepository } from './../src/journal/journal.repository.js';
import { loginAs, resetDemo, withToken } from './auth.helpers.js';

// p-nowak and p-wojcik: cases of the demo supervisor; p-wieczorek: a case of
// another evaluator (ev-sikora).
describe('Journal: notes and observations about an employee (e2e)', () => {
  let app: INestApplication<App>;
  let supervisor: string;
  let otherSupervisor: string;
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
    supervisor = await loginAs(app, 'k.wisniewska');
    otherSupervisor = await loginAs(app, 'a.szymanczak');
    hr = await loginAs(app, 'a.cieslak-dyjecinska');
    admin = await loginAs(app, 'admin');
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDemo(app);
  });

  const http = () => withToken(app, supervisor);
  const observation = {
    date: '2026-11-20',
    criterionId: 'komunikacja',
    indicatorId: 'komunikacja.2',
    kind: 'STRENGTH',
    situation: 'Spotkanie zespołu.',
    action: 'Podsumowała ustalenia.',
    result: 'Wszyscy znali kolejne kroki.',
  };

  describe('notes', () => {
    it('POST adds a note (201), listed first by GET', async () => {
      const created = await http()
        .post('/api/people/p-nowak/notes')
        .send({ text: '  Nowa notatka  ' })
        .expect(201);
      expect(created.body).toEqual({
        id: expect.any(String),
        personId: 'p-nowak',
        authorId: 'u-kaminska',
        text: 'Nowa notatka',
        createdAt: expect.any(String),
        updatedAt: created.body.createdAt,
      });
      const list = await http().get('/api/people/p-nowak/notes').expect(200);
      expect(list.body.length).toBeGreaterThan(1);
      expect(list.body[0].id).toBe(created.body.id);
    });

    it('PATCH changes the text and updatedAt; DELETE 204 removes it', async () => {
      const { body: note } = await http()
        .post('/api/people/p-nowak/notes')
        .send({ text: 'Przed' })
        .expect(201);
      await new Promise((r) => setTimeout(r, 5));
      const patched = await http()
        .patch(`/api/notes/${note.id}`)
        .send({ text: 'Po' })
        .expect(200);
      expect(patched.body.text).toBe('Po');
      expect(patched.body.createdAt).toBe(note.createdAt);
      expect(patched.body.updatedAt > note.updatedAt).toBe(true);
      await http().delete(`/api/notes/${note.id}`).expect(204);
      const list = await http().get('/api/people/p-nowak/notes').expect(200);
      expect(list.body.map((n: { id: string }) => n.id)).not.toContain(note.id);
      await http().delete(`/api/notes/${note.id}`).expect(404);
    });

    it('400 for empty or too long text, with a Polish message', async () => {
      const empty = await http()
        .post('/api/people/p-nowak/notes')
        .send({ text: '   ' })
        .expect(400);
      expect(JSON.stringify(empty.body)).toContain('nie może być pusta');
      await http()
        .post('/api/people/p-nowak/notes')
        .send({ text: 'x'.repeat(5001) })
        .expect(400);
      await http().post('/api/people/p-nowak/notes').send({}).expect(400);
    });
  });

  describe('observations', () => {
    it('POST adds an observation (201), GET lists newest date first', async () => {
      const created = await http()
        .post('/api/people/p-nowak/observations')
        .send(observation)
        .expect(201);
      expect(created.body).toMatchObject({
        ...observation,
        id: expect.any(String),
        personId: 'p-nowak',
        authorId: 'u-kaminska',
      });
      const list = await http()
        .get('/api/people/p-nowak/observations')
        .expect(200);
      expect(list.body[0].id).toBe(created.body.id);
      const dates = list.body.map((o: { date: string }) => o.date);
      expect(dates).toEqual(
        [...dates].sort((a: string, b: string) => b.localeCompare(a)),
      );
    });

    it('indicatorId is optional', async () => {
      const { indicatorId: _, ...rest } = observation;
      const res = await http()
        .post('/api/people/p-nowak/observations')
        .send(rest)
        .expect(201);
      expect(res.body.indicatorId).toBeNull();
    });

    it.each([
      ['unknown criterion', { criterionId: 'nie-ma' }, 'nie istnieje'],
      [
        'indicator of another criterion',
        { indicatorId: 'rzetelnosc.1' },
        'nie należy',
      ],
      ['date in the future', { date: '2026-11-22' }, 'z przyszłości'],
      ['empty situation', { situation: ' ' }, 'sytuację'],
      ['malformed date', { date: '21.11.2026' }, 'RRRR-MM-DD'],
      ['unknown kind', { kind: 'OTHER' }, 'STRENGTH'],
    ])('400 for %s', async (_name, change, message) => {
      const res = await http()
        .post('/api/people/p-nowak/observations')
        .send({ ...observation, ...change })
        .expect(400);
      expect(JSON.stringify(res.body)).toContain(message);
    });

    it('PATCH validates the merged observation; DELETE 204', async () => {
      const { body: obs } = await http()
        .post('/api/people/p-nowak/observations')
        .send(observation)
        .expect(201);
      await http()
        .patch(`/api/observations/${obs.id}`)
        .send({ criterionId: 'rzetelnosc' })
        .expect(400); // komunikacja.2 is not an indicator of rzetelnosc
      const patched = await http()
        .patch(`/api/observations/${obs.id}`)
        .send({
          criterionId: 'rzetelnosc',
          indicatorId: null,
          kind: 'DEVELOPMENT',
        })
        .expect(200);
      expect(patched.body).toMatchObject({
        criterionId: 'rzetelnosc',
        indicatorId: null,
        kind: 'DEVELOPMENT',
        situation: observation.situation,
      });
      await http().delete(`/api/observations/${obs.id}`).expect(204);
      await http().patch(`/api/observations/${obs.id}`).send({}).expect(404);
    });
  });

  describe('permissions', () => {
    it.each(['notes', 'observations'])(
      "%s: 404 for an unknown person, 403 outside the supervisor's cases",
      async (kind) => {
        await http().get(`/api/people/p-nie-ma/${kind}`).expect(404);
        const res = await http()
          .get(`/api/people/p-wieczorek/${kind}`)
          .expect(403);
        expect(res.body.message).toContain('których oceniasz');
        await http()
          .post(`/api/people/p-wieczorek/${kind}`)
          .send(kind === 'notes' ? { text: 'x' } : observation)
          .expect(403);
      },
    );

    it('401 without a token; 403 for HR, ADMIN and another supervisor', async () => {
      await request(app.getHttpServer())
        .get('/api/people/p-nowak/notes')
        .expect(401);
      for (const token of [hr, admin]) {
        await withToken(app, token)
          .get('/api/people/p-nowak/notes')
          .expect(403);
        await withToken(app, token)
          .get('/api/people/p-nowak/observations')
          .expect(403);
        await withToken(app, token).delete('/api/notes/jn-seed-1').expect(403);
      }
      await withToken(app, otherSupervisor)
        .get('/api/people/p-nowak/notes')
        .expect(403);
      await withToken(app, otherSupervisor)
        .get('/api/people/p-wieczorek/notes')
        .expect(200);
      await withToken(app, otherSupervisor)
        .patch('/api/notes/jn-seed-1')
        .send({ text: 'x' })
        .expect(404);
    });

    it("someone else's entry is not found (404) and not listed", async () => {
      const repo = app.get(JournalRepository);
      const at = new Date().toISOString();
      await repo.insertNote({
        id: 'foreign-note',
        personId: 'p-nowak',
        authorId: 'u-sikora',
        text: 'cudza',
        createdAt: at,
        updatedAt: at,
      });
      await repo.insertObservation({
        ...observation,
        kind: 'STRENGTH',
        id: 'foreign-obs',
        personId: 'p-nowak',
        authorId: 'u-sikora',
        createdAt: at,
        updatedAt: at,
      });
      await http()
        .patch('/api/notes/foreign-note')
        .send({ text: 'x' })
        .expect(404);
      await http().delete('/api/notes/foreign-note').expect(404);
      await http().patch('/api/observations/foreign-obs').send({}).expect(404);
      await http().delete('/api/observations/foreign-obs').expect(404);
      await http().patch('/api/notes/nie-ma').send({ text: 'x' }).expect(404);
      const notes = await http().get('/api/people/p-nowak/notes').expect(200);
      expect(notes.body.map((n: { id: string }) => n.id)).not.toContain(
        'foreign-note',
      );
    });
  });

  it('POST /api/demo/reset restores the seed', async () => {
    const before = await http().get('/api/people/p-nowak/notes').expect(200);
    const added = await http()
      .post('/api/people/p-nowak/notes')
      .send({ text: 'Do usunięcia przez reset' })
      .expect(201);
    await http().delete(`/api/notes/${before.body[0].id}`).expect(204);
    await resetDemo(app);
    const after = await http().get('/api/people/p-nowak/notes').expect(200);
    expect(after.body.map((n: { id: string }) => n.id)).toEqual(
      before.body.map((n: { id: string }) => n.id),
    );
    expect(after.body.map((n: { id: string }) => n.id)).not.toContain(
      added.body.id,
    );
  });
});
