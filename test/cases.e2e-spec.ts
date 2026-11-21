import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { loginAs, withToken } from './auth.helpers.js';

describe('Cases, team, OSP and HR (e2e, contract v2)', () => {
  let app: INestApplication<App>;
  let supervisor: string;
  let hr: string;

  beforeAll(async () => {
    process.env.DEMO_TODAY = '2026-11-21';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    supervisor = await loginAs(app, 'j.kaminska');
    hr = await loginAs(app, 'a.lis');
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await http().post('/api/demo/reset').expect(200);
  });

  const http = () => withToken(app, supervisor);
  const asHr = () => withToken(app, hr);
  const act = (id: string, action: string) =>
    http().post(`/api/cases/${id}/actions`).send({ action });

  it('GET /api/me returns the signed-in supervisor', async () => {
    const res = await http().get('/api/me').expect(200);
    expect(res.body).toEqual({
      id: 'u-kaminska',
      login: 'j.kaminska',
      name: 'Joanna Kamińska',
      role: 'SUPERVISOR',
      position: 'Naczelnik wydziału',
      unit: expect.stringContaining('Wydział'),
      officeName: 'Ministerstwo Cyfryzacji (dane demonstracyjne)',
    });
  });

  it('GET /api/team returns the 6 team cases and todo sorted by date', async () => {
    const res = await http().get('/api/team').expect(200);
    expect(res.body.cases.map((c: { id: string }) => c.id)).toEqual([
      'c-001',
      'c-002',
      'c-003',
      'c-004',
      'c-005',
      'c-006',
    ]);
    const dates = res.body.todo.map(
      (t: { deadline: { date: string } }) => t.deadline.date,
    );
    expect(dates).toEqual(
      [...dates].sort((a: string, b: string) => a.localeCompare(b)),
    );
    expect(res.body.todo[0]).toMatchObject({
      caseId: 'c-005',
      stageId: 'OPENING_TALK',
      deadline: { date: '2026-11-24', state: 'SOON', daysLeft: 3 },
    });
  });

  it('GET /api/cases/c-001 is the main demo case', async () => {
    const res = await http().get('/api/cases/c-001').expect(200);
    expect(res.body).toMatchObject({
      sheetId: 'C',
      currentStage: 'ASSESSMENT',
      status: 'W_TOKU',
      partI: { additionalCriteria: ['myslenie_analityczne'] },
      evaluation: null,
      ratings: {},
      osp: { source: 'OSP DSI WWI 5 radca.docx' },
      evaluator: { firstName: 'Joanna', lastName: 'Kamińska' },
    });
    expect(res.body.observations).toHaveLength(8);
    expect(res.body.formalCheck.some((f: { ok: boolean }) => !f.ok)).toBe(true);
  });

  it('GET /api/cases/:id answers 404 for an unknown case', async () => {
    const res = await http().get('/api/cases/nope').expect(404);
    expect(res.body.message).toContain('Nie znaleziono');
  });

  it('OSP analysis suggests sheet C and myślenie analityczne for c-002', async () => {
    const res = await http().get('/api/cases/c-002').expect(200);
    expect(res.body.sheetId).toBeNull();
    expect(res.body.ospAnalysis.suggestedSheet.sheetId).toBe('C');
    expect(res.body.ospAnalysis.additionalCandidates).toEqual([
      expect.objectContaining({ criterionId: 'myslenie_analityczne' }),
    ]);
    const accepted = await act('c-002', 'ACCEPT_OSP_ANALYSIS').expect(200);
    expect(accepted.body).toMatchObject({
      sheetId: 'C',
      currentStage: 'SHEET_PROPOSAL',
      availableActions: ['ACCEPT_SHEET'],
    });
    const sheetAccepted = await act('c-002', 'ACCEPT_SHEET').expect(200);
    expect(sheetAccepted.body.currentStage).toBe('OPENING_TALK');
    expect(
      sheetAccepted.body.stages.find(
        (s: { id: string }) => s.id === 'SHEET_PROPOSAL',
      ),
    ).toMatchObject({ name: 'Wstępny formularz', status: 'DONE' });
  });

  it('rates, decides and signs the main case', async () => {
    const decisions = {
      wykorzystywanie_wiedzy: 7,
      rzetelnosc: 7,
      organizacja_pracy: 5,
      wspolpraca: 7,
      komunikacja: 5,
      myslenie_analityczne: 7,
    };
    let res = await http()
      .patch('/api/cases/c-001')
      .send({
        ratings: { komunikacja: { 'komunikacja.1': 5, 'komunikacja.2': null } },
      })
      .expect(200);
    expect(res.body.ratings.komunikacja).toEqual({
      'komunikacja.1': 5,
      'komunikacja.2': null,
    });

    // signing too early: 409 with the failing checks
    res = await act('c-001', 'SIGN_ASSESSMENT').expect(409);
    expect(res.body.message).toContain('kontrola formalna');
    expect(res.body.formalCheck.length).toBeGreaterThan(0);

    res = await http()
      .patch('/api/cases/c-001')
      .send({ decisions })
      .expect(200);
    expect(res.body.currentStage).toBe('JUSTIFICATION');
    expect(res.body.evaluation).toMatchObject({
      result: 'POSITIVE',
      averageDisplay: '6,33',
    });

    await http()
      .patch('/api/cases/c-001')
      .send({
        iprz: 'Szkolenie z prostego języka w pismach urzędowych.',
        promotionRequest: { attached: 'NO' },
      })
      .expect(200);
    res = await act('c-001', 'SIGN_ASSESSMENT').expect(200);
    expect(res.body).toMatchObject({
      currentStage: 'DOCUMENT',
      signedByEvaluatorOn: '2026-11-21',
    });

    // locked after signing
    res = await http()
      .patch('/api/cases/c-001')
      .send({ decisions: { komunikacja: 7 } })
      .expect(409);
    expect(res.body.message).toContain('zablokowane');

    await act('c-001', 'SEND_FOR_ACK').expect(200);
    res = await act('c-001', 'EMPLOYEE_ACK_ASSESSMENT').expect(200);
    expect(res.body).toMatchObject({
      status: 'OKRES_SPRZECIWU',
      acknowledgedOn: '2026-11-21',
      objectionDeadline: {
        date: '2026-11-30',
        legalBasis: expect.stringContaining('art. 83'),
      },
    });
  });

  it('PATCH validates values (400) and stage locks (409)', async () => {
    let res = await http()
      .patch('/api/cases/c-001')
      .send({ decisions: { komunikacja: 4 } })
      .expect(400);
    expect(res.body.message[0]).toContain('1, 3, 5, 7 lub 9');
    res = await http()
      .patch('/api/cases/c-001')
      .send({ partI: { additionalCriteria: ['kreatywnosc'] } })
      .expect(409);
    expect(res.body.message).toContain('Część I jest zablokowana');
    res = await http()
      .patch('/api/cases/c-005')
      .send({ partI: { additionalCriteria: ['komunikacja'] } })
      .expect(400);
    expect(res.body.message[0]).toContain('obowiązkowe w arkuszu C');
  });

  describe('previous assessment and the request for the next grade', () => {
    const decisions = {
      wykorzystywanie_wiedzy: 7,
      rzetelnosc: 7,
      organizacja_pracy: 7,
      wspolpraca: 7,
      komunikacja: 5,
      myslenie_analityczne: 7,
    };
    const partIII = {
      appointedYear: 2018,
      currentGrade: 'III',
      gradeGrantedOn: '2018-03-01',
      requestedGrade: 'IV',
      motivation:
        'Dwie kolejne oceny powyżej oczekiwań; samodzielnie prowadzi opinie w sprawach systemów wysokiego ryzyka.',
    };

    it('seeds the previous assessment of an urzędnik and an empty request', async () => {
      const res = await http().get('/api/cases/c-001').expect(200);
      expect(res.body.previousAssessment).toMatchObject({
        result: 'POSITIVE',
        level: 'powyżej oczekiwań',
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      });
      expect(res.body.promotionRequest).toEqual({
        attached: null,
        appointedYear: null,
        currentGrade: null,
        gradeGrantedOn: null,
        requestedGrade: null,
        motivation: '',
      });
      expect(
        res.body.formalCheck.find(
          (f: { id: string }) => f.id === 'PROMOTION_REQUEST',
        ),
      ).toMatchObject({ ok: false, message: expect.stringContaining('TAK') });
    });

    it('saves and reads back the new fields, locked after signing', async () => {
      await http()
        .patch('/api/cases/c-001')
        .send({
          decisions,
          iprz: 'Szkolenie z prostego języka.',
          previousAssessment: { level: 'na poziomie oczekiwań' },
          promotionRequest: { attached: 'YES', ...partIII },
        })
        .expect(200);
      let res = await http().get('/api/cases/c-001').expect(200);
      expect(res.body.previousAssessment.level).toBe('na poziomie oczekiwań');
      expect(res.body.promotionRequest).toEqual({
        attached: 'YES',
        ...partIII,
      });

      res = await http()
        .patch('/api/cases/c-001')
        .send({ promotionRequest: { requestedGrade: 'VI' } })
        .expect(400);
      expect(res.body.message[0]).toContain('po stopniu III jest stopień IV');
      res = await http()
        .patch('/api/cases/c-001')
        .send({ promotionRequest: { appointedYear: 99 } })
        .expect(400);
      expect(JSON.stringify(res.body.message)).toContain('4 cyfry');
      res = await http()
        .patch('/api/cases/c-001')
        .send({ promotionRequest: { motivation: 'x'.repeat(4001) } })
        .expect(400);
      expect(JSON.stringify(res.body.message)).toContain('4000');

      await act('c-001', 'SIGN_ASSESSMENT').expect(200);
      res = await http()
        .patch('/api/cases/c-001')
        .send({ promotionRequest: { motivation: 'Zmiana po podpisie.' } })
        .expect(409);
      expect(res.body.message).toContain('zablokowane');
      res = await http()
        .patch('/api/cases/c-001')
        .send({ previousAssessment: null })
        .expect(409);
      expect(res.body.message).toContain('zablokowane');
      res = await http().get('/api/cases/c-001').expect(200);
      expect(res.body.promotionRequest.requestedGrade).toBe('IV');
    });

    it('forces NOT_APPLICABLE for a pracownik służby cywilnej', async () => {
      let res = await http().get('/api/cases/c-002').expect(200);
      expect(res.body.person.employment).toBe('PRACOWNIK');
      expect(res.body.promotionRequest.attached).toBe('NOT_APPLICABLE');
      expect(res.body.previousAssessment).toBeNull();

      // c-101 belongs to another supervisor; use the team's own pracownik in part II.
      await act('c-002', 'ACCEPT_OSP_ANALYSIS').expect(200);
      await act('c-002', 'ACCEPT_SHEET').expect(200);
      await act('c-002', 'CONFIRM_PART_I').expect(200);
      await act('c-002', 'EMPLOYEE_ACK_PART_I').expect(200);
      await act('c-002', 'START_ASSESSMENT').expect(200);
      res = await http()
        .patch('/api/cases/c-002')
        .send({ promotionRequest: { attached: 'YES' } })
        .expect(400);
      expect(res.body.message[0]).toContain('pracownikiem służby cywilnej');
      res = await http().get('/api/cases/c-002').expect(200);
      expect(res.body.promotionRequest.attached).toBe('NOT_APPLICABLE');
      expect(
        res.body.formalCheck.find(
          (f: { id: string }) => f.id === 'PROMOTION_REQUEST',
        ).ok,
      ).toBe(true);
    });
  });

  it('illegal action -> 409 with a Polish explanation; unknown action -> 400', async () => {
    const res = await act('c-003', 'CONFIRM_PART_I').expect(409);
    expect(res.body.message).toMatch(
      /^Akcja „Zatwierdź część I” jest teraz niedostępna/,
    );
    await act('c-003', 'DANCE').expect(400);
  });

  it('POST observations adds an S-D-R note', async () => {
    const res = await http()
      .post('/api/cases/c-003/observations')
      .send({
        date: '2026-11-20',
        criterionId: 'zarzadzanie_ludzmi',
        indicatorId: 'zarzadzanie_ludzmi.2',
        kind: 'STRENGTH',
        situation: 'Opóźnienie dostawcy.',
        action: 'Ustalił punkty kontrolne.',
        result: 'Termin dotrzymany.',
      })
      .expect(201);
    expect(res.body.observations).toHaveLength(5);
    await http()
      .post('/api/cases/c-003/observations')
      .send({
        date: '2026-11-20',
        criterionId: 'rzetelnosc', // not a criterion on sheet B here
        indicatorId: null,
        kind: 'STRENGTH',
        situation: 'x',
        action: '',
        result: '',
      })
      .expect(400);
  });

  it('first assessment: report submitted moves to the assessment', async () => {
    const res = await act('c-004', 'REPORT_SUBMITTED').expect(200);
    expect(res.body).toMatchObject({
      path: 'FIRST',
      currentStage: 'FIRST_ASSESSMENT',
      firstConditions: { reportSubmittedOn: '2026-11-21', examPassed: 'YES' },
    });
  });

  it('GET /api/osp returns the 3 real OSP documents', async () => {
    const res = await http().get('/api/osp').expect(200);
    expect(res.body).toHaveLength(3);
    expect(res.body.map((o: { source: string }) => o.source)).toEqual([
      'OSP DC WZKSOiC 6 starszy specjalista.docx',
      'OSP DSI WWI 5 radca.docx',
      'OSP DWM WKAM 1 naczelnik wydziału.docx',
    ]);
    expect(res.body[0]).not.toHaveProperty('softCompetenciesQuote');
  });

  it('HR overview counts and simulated reminders', async () => {
    let res = await asHr().get('/api/hr/overview').expect(200);
    expect(res.body.counters).toEqual({
      inProgress: 8,
      dueSoon: 5,
      overdue: 2,
      awaitingAck: 1,
      objectionPeriod: 1,
    });
    expect(res.body.cases).toHaveLength(10);
    expect(res.body.cases[0]).toMatchObject({
      evaluatorName: 'Joanna Kamińska',
      lastReminderOn: null,
    });

    res = await asHr()
      .post('/api/hr/reminders')
      .send({ caseIds: ['c-102', 'c-103'] })
      .expect(200);
    expect(res.body.sent).toBe(2);
    expect(res.body.log[0]).toMatchObject({
      caseId: 'c-102',
      date: '2026-11-21',
    });
    expect(res.body.log[0].text).toContain('Robert Sikora');

    const detail = await asHr().get('/api/cases/c-102').expect(200);
    expect(detail.body.history.at(-1).text).toContain('Przypomnienie');
    await asHr()
      .post('/api/hr/reminders')
      .send({ caseIds: ['nope'] })
      .expect(404);
    await asHr().post('/api/hr/reminders').send({ caseIds: [] }).expect(400);
  });

  it('POST /api/demo/reset restores the seed', async () => {
    await act('c-002', 'ACCEPT_OSP_ANALYSIS').expect(200);
    await http().post('/api/demo/reset').expect(200);
    const res = await http().get('/api/cases/c-002').expect(200);
    expect(res.body.currentStage).toBe('OSP_ANALYSIS');
  });
});
