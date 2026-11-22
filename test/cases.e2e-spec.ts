import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { loginAs, resetDemo, withToken } from './auth.helpers.js';

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
    await resetDemo(app);
  });

  const http = () => withToken(app, supervisor);
  const asHr = () => withToken(app, hr);
  const act = (id: string, action: string, extra: object = {}) =>
    http()
      .post(`/api/cases/${id}/actions`)
      .send({ action, ...extra });

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

  it('GET /api/team returns the 7 team cases and todo sorted by date', async () => {
    const res = await http().get('/api/team').expect(200);
    expect(res.body.cases.map((c: { id: string }) => c.id)).toEqual([
      'c-001',
      'c-002',
      'c-003',
      'c-004',
      'c-005',
      'c-006',
      'c-007',
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

    // signing too early: 409, the form is not complete
    res = await act('c-001', 'SIGN_ASSESSMENT').expect(409);
    expect(res.body.message).toContain('Weryfikacja formularza');

    res = await http()
      .patch('/api/cases/c-001')
      .send({ decisions })
      .expect(200);
    expect(res.body.currentStage).toBe('ASSESSMENT_TALK');
    expect(res.body.evaluation).toMatchObject({
      result: 'POSITIVE',
      averageDisplay: '6,33',
    });
    expect(res.body.assessmentTalkTopics).toHaveLength(3);

    // §10: no signature before the assessment talk
    res = await act('c-001', 'SIGN_ASSESSMENT').expect(409);
    expect(res.body.message).toContain('Najpierw odnotuj rozmowę oceniającą');
    res = await act('c-001', 'RECORD_ASSESSMENT_TALK', {
      date: '2026-11-20',
    }).expect(200);
    expect(res.body).toMatchObject({
      currentStage: 'JUSTIFICATION',
      assessmentTalkOn: '2026-11-20',
    });

    // signing with failing checks: 409 with the list
    res = await act('c-001', 'SIGN_ASSESSMENT').expect(409);
    expect(res.body.message).toContain('kontrola formalna');
    expect(res.body.formalCheck.length).toBeGreaterThan(0);

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

  it('RECORD_ASSESSMENT_TALK: today by default, 400 for a future or invalid date', async () => {
    const detail = await http().get('/api/cases/c-007').expect(200);
    expect(detail.body).toMatchObject({
      currentStage: 'ASSESSMENT_TALK',
      assessmentTalkOn: null,
      availableActions: ['RECORD_ASSESSMENT_TALK'],
      assessmentTalkTopics: [
        { id: 'DUTIES', legalBasis: '§10 pkt 1 rozp. PRM z 4.04.2016' },
        { id: 'GOALS', legalBasis: '§10 pkt 2 rozp. PRM z 4.04.2016' },
        { id: 'DEVELOPMENT', legalBasis: '§10 pkt 3 rozp. PRM z 4.04.2016' },
      ],
    });
    expect(
      detail.body.stages.map((s: { name: string }) => s.name).slice(4, 7),
    ).toEqual([
      'Formularz oceny kompetencji',
      'Rozmowa oceniająca',
      'Weryfikacja formularza',
    ]);

    let res = await act('c-007', 'RECORD_ASSESSMENT_TALK', {
      date: '2026-11-22',
    }).expect(400);
    expect(JSON.stringify(res.body.message)).toContain('z przyszłości');
    await act('c-007', 'RECORD_ASSESSMENT_TALK', { date: '21.11.2026' }).expect(
      400,
    );
    res = await act('c-007', 'SIGN_ASSESSMENT').expect(409);
    expect(res.body.message).toContain('§10');

    res = await act('c-007', 'RECORD_ASSESSMENT_TALK').expect(200);
    expect(res.body).toMatchObject({
      currentStage: 'JUSTIFICATION',
      assessmentTalkOn: '2026-11-21',
    });
    expect(
      res.body.formalCheck.find(
        (f: { id: string }) => f.id === 'ASSESSMENT_TALK_HELD',
      ),
    ).toMatchObject({ ok: true });
    // Corrections after the talk are still saved (§11 ust. 2).
    await http()
      .patch('/api/cases/c-007')
      .send({ decisions: { komunikacja: 5 }, iprz: 'Plan po rozmowie.' })
      .expect(200);
    await act('c-007', 'RECORD_ASSESSMENT_TALK').expect(409);
  });

  it('part II is a draft before the assessment talk, saved until signing', async () => {
    for (const id of ['c-003', 'c-005']) {
      await http()
        .patch(`/api/cases/${id}`)
        .send({
          ratings: { komunikacja: { 'komunikacja.1': 5 } },
          decisions: { komunikacja: 5 },
          justification: 'Uzasadnienie robocze.',
          iprz: 'Szkolenie robocze.',
        })
        .expect(200);
      const res = await http().get(`/api/cases/${id}`).expect(200);
      expect(res.body).toMatchObject({
        currentStage: id === 'c-003' ? 'OBSERVATION' : 'OPENING_TALK',
        ratings: { komunikacja: { 'komunikacja.1': 5 } },
        decisions: { komunikacja: 5 },
        justification: 'Uzasadnienie robocze.',
        iprz: 'Szkolenie robocze.',
      });
      expect(res.body.availableActions).not.toContain('SIGN_ASSESSMENT');
    }
    const res = await act('c-003', 'SIGN_ASSESSMENT').expect(409);
    expect(res.body.message).toContain(
      'dopiero w otwartym formularzu oceny kompetencji',
    );
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

      await act('c-001', 'RECORD_ASSESSMENT_TALK').expect(200);
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
      inProgress: 9,
      dueSoon: 5,
      overdue: 2,
      awaitingAck: 1,
      objectionPeriod: 1,
    });
    expect(res.body.cases).toHaveLength(11);
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

  describe('POST /api/cases', () => {
    it('starts the next periodic cycle for an acknowledged assessment and lands on OSP analysis', async () => {
      const before = await http().get('/api/people/p-dabrowska').expect(200);
      expect(before.body.canStartCase).toBe(true);
      const res = await http()
        .post('/api/cases')
        .send({ personId: 'p-dabrowska' })
        .expect(201);
      expect(res.body).toMatchObject({
        path: 'PERIODIC',
        currentStage: 'OSP_ANALYSIS',
        status: 'W_TOKU',
        person: { id: 'p-dabrowska' },
      });
      expect(res.body.id).toMatch(/^c-\d{3}$/);
      const opening = res.body.stages.find(
        (s: { id: string }) => s.id === 'OPENING_TALK',
      );
      expect(opening.deadline.legalBasis).toContain('§7 pkt 1');
      await http().get(`/api/cases/${res.body.id}`).expect(200);
      const after = await http().get('/api/people/p-dabrowska').expect(200);
      expect(after.body.currentCase.id).toBe(res.body.id);
      expect(after.body.canStartCase).toBe(false);
      await http()
        .post('/api/cases')
        .send({ personId: 'p-dabrowska' })
        .expect(409);
    });

    it('409 while a case is in progress, 404 for an unknown or foreign person, 400 without personId', async () => {
      await http().post('/api/cases').send({ personId: 'p-nowak' }).expect(409);
      await http()
        .post('/api/cases')
        .send({ personId: 'p-nobody' })
        .expect(404);
      await http()
        .post('/api/cases')
        .send({ personId: 'p-wieczorek' })
        .expect(404);
      await http().post('/api/cases').send({}).expect(400);
    });

    it('HR may start a case for any person; it stays with the supervisor', async () => {
      const res = await asHr()
        .post('/api/cases')
        .send({ personId: 'p-dabrowska' })
        .expect(201);
      expect(res.body.ackLink ?? null).toBeNull();
      const own = await http().get(`/api/cases/${res.body.id}`).expect(200);
      expect(own.body.currentStage).toBe('OSP_ANALYSIS');
    });
  });

  it('POST /api/demo/reset restores the seed', async () => {
    await act('c-002', 'ACCEPT_OSP_ANALYSIS').expect(200);
    await resetDemo(app);
    const res = await http().get('/api/cases/c-002').expect(200);
    expect(res.body.currentStage).toBe('OSP_ANALYSIS');
  });
});
