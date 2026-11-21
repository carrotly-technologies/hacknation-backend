import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { loginAs, withToken } from './auth.helpers.js';

describe('Competency model, sheets and assessments (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    token = await loginAs(app, 'j.kaminska');
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => withToken(app, token);

  describe('GET /api/competency-model', () => {
    it('returns the model with Polish texts', async () => {
      const res = await http().get('/api/competency-model').expect(200);
      expect(res.body.title).toContain('MODEL KOMPETENCJI');
      expect(res.body.instructions).toHaveLength(3);
      expect(res.body.scale[0]).toEqual({
        points: 1,
        label: 'Znacznie poniżej oczekiwań',
      });
      expect(res.body.competencies).toHaveLength(14);
      expect(res.body.competencies[0]).toMatchObject({
        id: 'rzetelnosc',
        name: 'RZETELNOŚĆ',
      });
      expect(
        Object.keys(res.body.competencies[0].indicators[0].levels),
      ).toEqual(['1', '3', '5', '7', '9']);
    });
  });

  describe('GET /api/sheets', () => {
    it('returns the four sheets', async () => {
      const res = await http().get('/api/sheets').expect(200);
      expect(res.body.map((s: { id: string }) => s.id)).toEqual([
        'A',
        'B',
        'C',
        'FIRST',
      ]);
      expect(res.body[1]).toMatchObject({
        name: 'Arkusz B oceny okresowej',
        kind: 'PERIODIC',
        scale: [1, 3, 5, 7, 9],
        maxAdditionalCriteria: 3,
      });
      expect(res.body[3]).toMatchObject({
        name: 'Arkusz pierwszej oceny',
        kind: 'FIRST',
        scale: [3, 5, 7],
        maxAdditionalCriteria: 0,
      });
    });
  });

  describe('POST /api/assessments/suggest-level', () => {
    it('answers 200 with a suggestion', async () => {
      const res = await http()
        .post('/api/assessments/suggest-level')
        .send({
          sheetId: 'C',
          competencyId: 'komunikacja',
          indicatorRatings: [
            { indicatorId: 'komunikacja.1', points: 5 },
            { indicatorId: 'komunikacja.2', points: 3 },
            { indicatorId: 'komunikacja.3', points: null },
          ],
        })
        .expect(200);
      expect(res.body).toMatchObject({
        suggestedPoints: 5,
        suggestedLabel: 'Na poziomie oczekiwań',
        ratedCount: 2,
        skippedCount: 1,
        mean: 4,
        isSuggestionOnly: true,
      });
      expect(typeof res.body.rationale).toBe('string');
      expect(Array.isArray(res.body.warnings)).toBe(true);
    });

    it('returns null when nothing is rated', async () => {
      const res = await http()
        .post('/api/assessments/suggest-level')
        .send({
          sheetId: 'FIRST',
          competencyId: 'rzetelnosc',
          indicatorRatings: [],
        })
        .expect(200);
      expect(res.body).toMatchObject({ suggestedPoints: null, mean: null });
    });

    it('answers 400 for points outside 1/3/5/7/9', async () => {
      const res = await http()
        .post('/api/assessments/suggest-level')
        .send({
          sheetId: 'C',
          competencyId: 'komunikacja',
          indicatorRatings: [{ indicatorId: 'komunikacja.1', points: 4 }],
        })
        .expect(400);
      expect(res.body.message.join(' ')).toContain(
        'Ocena wskaźnika musi wynosić',
      );
    });

    it('answers 400 for an unknown sheet', async () => {
      const res = await http()
        .post('/api/assessments/suggest-level')
        .send({
          sheetId: 'D',
          competencyId: 'komunikacja',
          indicatorRatings: [],
        })
        .expect(400);
      expect(res.body.message.join(' ')).toContain('sheetId musi mieć');
    });

    it('answers 400 for an unknown competency', async () => {
      const res = await http()
        .post('/api/assessments/suggest-level')
        .send({ sheetId: 'C', competencyId: 'xyz', indicatorRatings: [] })
        .expect(400);
      expect(res.body.message).toEqual(['Nieznana kompetencja „xyz”.']);
    });
  });

  describe('POST /api/assessments/evaluate', () => {
    const C = [
      'wykorzystywanie_wiedzy',
      'rzetelnosc',
      'organizacja_pracy',
      'wspolpraca',
      'komunikacja',
    ];

    it('evaluates a periodic sheet (E4 edge case)', async () => {
      const res = await http()
        .post('/api/assessments/evaluate')
        .send({
          sheetId: 'C',
          scores: C.map((criterionId) => ({
            criterionId,
            points: criterionId === 'rzetelnosc' ? 1 : 5,
          })),
        })
        .expect(200);
      expect(res.body).toMatchObject({
        averageDisplay: '4,20',
        level: { label: 'Na poziomie oczekiwań', range: '>4–6' },
        result: 'NEGATIVE',
      });
      expect(res.body.average).toBeCloseTo(4.2);
      expect(res.body.reasons.length).toBeGreaterThan(0);
    });

    it('evaluates a first assessment', async () => {
      const res = await http()
        .post('/api/assessments/evaluate')
        .send({
          sheetId: 'FIRST',
          scores: [
            'rzetelnosc',
            'wykorzystywanie_wiedzy',
            'organizacja_pracy',
            'komunikacja',
            'wspolpraca',
          ].map((criterionId) => ({ criterionId, points: 5 })),
          firstAssessment: { examPassed: 'YES', reportSubmittedOnTime: true },
        })
        .expect(200);
      expect(res.body).toMatchObject({
        average: 5,
        averageDisplay: '5,00',
        level: null,
        result: 'POSITIVE',
      });
    });

    it('answers 400 with Polish domain messages', async () => {
      const res = await http()
        .post('/api/assessments/evaluate')
        .send({
          sheetId: 'C',
          scores: [{ criterionId: 'rzetelnosc', points: 4 }],
        })
        .expect(400);
      expect(res.body.message).toContain(
        'Ocena kryterium „Rzetelność” musi wynosić 1, 3, 5, 7 lub 9 pkt (podano 4).',
      );
      expect(res.body.message).toContain(
        'Brak oceny kryterium obowiązkowego „Komunikacja” (arkusz C).',
      );
    });

    it('answers 400 for FIRST without firstAssessment', async () => {
      const res = await http()
        .post('/api/assessments/evaluate')
        .send({
          sheetId: 'FIRST',
          scores: C.map((criterionId) => ({ criterionId, points: 5 })),
        })
        .expect(400);
      expect(res.body.message.join(' ')).toContain('firstAssessment');
    });

    it('answers 400 for a malformed body', async () => {
      const res = await http()
        .post('/api/assessments/evaluate')
        .send({ sheetId: 'C', scores: 'nope' })
        .expect(400);
      expect(res.body.message[0]).toMatch(/^scores: /);
    });
  });
});
