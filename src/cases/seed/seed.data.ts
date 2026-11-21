import type { CaseRecord, Evaluator } from '../case.types.js';
import { defaultAssessmentDue, defaultReportDue } from '../deadlines.rules.js';
import { addDays, formatDatePl } from '../dates.js';
import { emptyPromotionRequest } from '../promotion.rules.js';
import {
  caseRecord,
  emptyPartI,
  observations,
  previousAssessment,
  ratingsFor,
  relative,
} from './seed-helpers.js';

/**
 * Demo data (notatki/ux-koncepcja.md, "Dane demonstracyjne"). Every person,
 * unit and event is FICTIONAL; only the three OSP documents are real. All
 * dates are relative to DEMO_TODAY, so the demo looks the same on any day.
 */

export const OFFICE_NAME = 'Ministerstwo Cyfryzacji (dane demonstracyjne)';
export const SUPERVISOR_ID = 'ev-kaminska';
const TEAM_UNIT = 'Wydział Analiz i Koordynacji, Departament Spraw Cyfrowych';

export const EVALUATORS: readonly Evaluator[] = [
  {
    id: SUPERVISOR_ID,
    firstName: 'Joanna',
    lastName: 'Kamińska',
    position: 'Naczelnik wydziału',
    unit: TEAM_UNIT,
  },
  {
    id: 'ev-sikora',
    firstName: 'Robert',
    lastName: 'Sikora',
    position: 'Naczelnik wydziału',
    unit: 'Wydział Budżetu i Finansów, Biuro Dyrektora Generalnego',
  },
  {
    id: 'ev-pawlak',
    firstName: 'Agnieszka',
    lastName: 'Pawlak',
    position: 'Naczelnik wydziału',
    unit: 'Wydział Legislacji, Departament Prawny',
  },
];

export function buildSeed(today: string): CaseRecord[] {
  const r = relative(today);
  return [
    mainCase(r),
    ospAnalysisCase(r),
    sheetBCase(r),
    firstAssessmentCase(r),
    afterNegativeCase(r),
    objectionPeriodCase(r),
    ...otherUnitCases(r),
  ];
}

type Rel = ReturnType<typeof relative>;

/** Main demo path: sheet C, right before the assessment talk, 8 observations. */
function mainCase(r: Rel): CaseRecord {
  const id = 'c-001';
  // Part I confirmed ~23.5 months ago, so the assessment is due in ~2 weeks.
  const confirmed = r.months(-24, 13);
  const previous = r.workday(confirmed.replace(/-\d\d$/, '-01'));
  const due = defaultAssessmentDue(confirmed);
  const startedAssessment = r.days(-2);
  return caseRecord({
    id,
    person: {
      id: 'p-nowak',
      firstName: 'Anna',
      lastName: 'Nowak',
      position: 'Radca do spraw regulacji sztucznej inteligencji',
      unit: TEAM_UNIT,
      employment: 'URZEDNIK',
      hiredOn: '2017-04-03',
    },
    evaluatorId: SUPERVISOR_ID,
    path: 'PERIODIC',
    sheetId: 'C',
    ospId: 'osp-dsi-wwi-5',
    cycleStart: { kind: 'PREVIOUS_POSITIVE', assessedOn: previous },
    previousAssessment: previousAssessment(
      { kind: 'PREVIOUS_POSITIVE', assessedOn: previous },
      'powyżej oczekiwań',
    ),
    stage: 'ASSESSMENT',
    completedOn: {
      OSP_ANALYSIS: r.workday(confirmed.replace(/-\d\d$/, '-02')),
      OPENING_TALK: confirmed,
      OBSERVATION: startedAssessment,
    },
    partI: {
      additionalCriteria: ['myslenie_analityczne'],
      assessmentDue: due,
      topics: {
        duties:
          'Omówiono zadania z OSP DSI WWI 5: analizy prawa krajowego i unijnego w obszarze AI, opinie indywidualne, projekty stanowisk Komisji, odpowiedzi na wystąpienia zewnętrzne. Priorytet na 2025 r.: opinie dotyczące systemów wysokiego ryzyka.',
        criteria:
          'Pięć kryteriów obowiązkowych arkusza C oraz kryterium dodatkowe „Myślenie analityczne”: przeważająca część zadań to analiza przepisów, orzecznictwa i wytycznych oraz formułowanie rekomendacji.',
        expectations:
          'Uzgodniono oczekiwania na poziomie „na poziomie oczekiwań” dla wszystkich kryteriów; szczególny nacisk na terminowość opinii i przystępność pism kierowanych do podmiotów spoza administracji.',
        goals:
          '1) Przygotowanie wzoru opinii indywidualnej do końca I kwartału 2025 r. 2) Udział w co najmniej jednym szkoleniu z wytycznych Komisji Europejskiej do aktu w sprawie AI.',
      },
      expectations: {
        wykorzystywanie_wiedzy:
          'Stosuje aktualne przepisy aktu w sprawie AI i RODO w opiniach; śledzi wytyczne organów UE i dzieli się wnioskami z wydziałem.',
        rzetelnosc:
          'Opinie i projekty stanowisk zgodne z procedurą wydziału, sprawdzone przed przekazaniem; terminy ustawowe dotrzymane, ryzyko opóźnienia zgłaszane z wyprzedzeniem.',
        organizacja_pracy:
          'Planuje pracę nad opiniami z terminami cząstkowymi; przy zbiegu zadań uzgadnia priorytety z naczelnikiem.',
        wspolpraca:
          'Przekazuje zespołowi ustalenia z prac Komisji; wspiera nowe osoby wzorami i przykładami z ukończonych spraw.',
        komunikacja:
          'Pisma do podmiotów zewnętrznych są zwięzłe, z odpowiedzią na pytania na początku; w rozmowach dostosowuje język do odbiorcy.',
        myslenie_analityczne:
          'Odróżnia ustalenia od przypuszczeń, wskazuje zależności między przepisami i formułuje wnioski z ich podstawą oraz ograniczeniami.',
      },
      confirmedByEvaluatorOn: confirmed,
      acknowledgedByEmployeeOn: confirmed,
    },
    observations: observations(id, [
      {
        date: r.months(-21, 10),
        criterionId: 'rzetelnosc',
        indicatorId: 'rzetelnosc.2',
        kind: 'STRENGTH',
        situation:
          'Do wydziału wpłynęło 14 wniosków o opinie indywidualne dotyczące klasyfikacji systemów AI jako systemów wysokiego ryzyka, z terminem 30 dni.',
        action:
          'Rozpisała harmonogram z terminami cząstkowymi. Po tygodniu zgłosiła, że dwa wnioski wymagają uzupełnienia, i uzgodniła treść wezwań.',
        result:
          'Wszystkie opinie trafiły do podpisu w terminie; żadna sprawa nie wymagała przedłużenia terminu.',
      },
      {
        date: r.months(-18, 5),
        criterionId: 'komunikacja',
        indicatorId: 'komunikacja.3',
        kind: 'DEVELOPMENT',
        situation:
          'Projekt odpowiedzi na pismo stowarzyszenia branżowego w sprawie obowiązków dostawców modeli AI ogólnego przeznaczenia.',
        action:
          'Przygotowała sześciostronicowy projekt z obszerną analizą przepisów, bez wyodrębnienia odpowiedzi na trzy zadane pytania.',
        result:
          'Projekt wrócił z prośbą o skrócenie. Druga wersja (dwie strony, odpowiedzi w punktach) została przyjęta bez uwag. Ustaliłyśmy, że pisma zewnętrzne zaczynają się od krótkiej odpowiedzi.',
      },
      {
        date: r.months(-15, 12),
        criterionId: 'myslenie_analityczne',
        indicatorId: 'myslenie_analityczne.2',
        kind: 'STRENGTH',
        situation:
          'Analiza barier prawnych dla piaskownic regulacyjnych AI na potrzeby posiedzenia Komisji.',
        action:
          'Zestawiła wymogi aktu w sprawie AI z przepisami RODO i prawa zamówień publicznych, wskazała dwie kolizje przepisów i oddzieliła je od problemów wynikających z praktyki urzędów.',
        result:
          'Analizę włączono do materiałów na posiedzenie; dwie rekomendacje trafiły do założeń projektu nowelizacji.',
      },
      {
        date: r.months(-12, 3),
        criterionId: 'wspolpraca',
        indicatorId: 'wspolpraca.6',
        kind: 'STRENGTH',
        situation:
          'Do wydziału dołączyły dwie nowe osoby bez doświadczenia w opiniowaniu.',
        action:
          'Z własnej inicjatywy przygotowała zestaw wzorów opinii i listę najczęstszych pytań wnioskodawców oraz poprowadziła dwa krótkie spotkania instruktażowe.',
        result:
          'Po miesiącu nowe osoby samodzielnie przygotowywały projekty prostych opinii.',
      },
      {
        date: r.months(-9, 8),
        criterionId: 'organizacja_pracy',
        indicatorId: 'organizacja_pracy.2',
        kind: 'DEVELOPMENT',
        situation:
          'W jednym tygodniu zbiegły się: projekt stanowiska na posiedzenie Komisji i uwagi do projektu ustawy w uzgodnieniach międzyresortowych.',
        action:
          'Kontynuowała pracę nad stanowiskiem; o zagrożeniu terminu uwag poinformowała w dniu jego upływu.',
        result:
          'Uwagi wysłano z jednodniowym opóźnieniem, po uzgodnieniu z organizatorem uzgodnień. Omówiłyśmy, jak sygnalizować kolizję terminów z wyprzedzeniem.',
      },
      {
        date: r.months(-6, 2),
        criterionId: 'wykorzystywanie_wiedzy',
        indicatorId: 'wykorzystywanie_wiedzy.2',
        kind: 'STRENGTH',
        situation:
          'Komisja Europejska opublikowała wytyczne dotyczące praktyk zakazanych w obszarze AI.',
        action:
          'Wzięła udział w szkoleniu z wytycznych i opracowała dla wydziału notatkę z wnioskami dla opinii indywidualnych.',
        result:
          'Notatka stała się podstawą aktualizacji wzoru opinii; spadła liczba pytań uzupełniających od wnioskodawców.',
      },
      {
        date: r.months(-3, 4),
        criterionId: 'komunikacja',
        indicatorId: 'komunikacja.2',
        kind: 'DEVELOPMENT',
        situation:
          'Spotkanie konsultacyjne z przedstawicielami młodych firm technologicznych.',
        action:
          'Odpowiadała na pytania językiem przepisów, bez przykładów; dwie osoby prosiły o ponowne wyjaśnienie.',
        result:
          'Sama zaproponowała zestaw pytań i odpowiedzi napisany prostym językiem. Na kolejnym spotkaniu korzystała z przykładów i nie było pytań doprecyzowujących.',
      },
      {
        date: r.days(-24),
        criterionId: 'myslenie_analityczne',
        indicatorId: 'myslenie_analityczne.3',
        kind: 'STRENGTH',
        situation:
          'Rozbieżne interpretacje wydziału i organu ochrony danych co do podstawy przetwarzania danych przy trenowaniu modeli.',
        action:
          'Przedstawiła dwa warianty wniosków, dla każdego podała podstawę w orzecznictwie TSUE i ograniczenia dostępnych danych.',
        result:
          'Dyrektor wybrał wariant rekomendowany; stanowisko uzgodniono bez dodatkowej rundy uwag.',
      },
    ]),
    history: [
      {
        date: previous,
        text: 'Sporządzono poprzednią ocenę okresową: pozytywna, „Powyżej oczekiwań”.',
      },
      {
        date: confirmed,
        text: `Rozmowa rozpoczynająca. Oceniający zatwierdził część I (kryterium dodatkowe: Myślenie analityczne), termin sporządzenia oceny: ${formatDatePl(due)}. Oceniany potwierdził zapoznanie.`,
      },
      {
        date: startedAssessment,
        text: 'Otwarto formularz oceny kompetencji (część II arkusza).',
      },
    ],
  });
}

/** New cycle, OSP analysis (starszy specjalista: myślenie analityczne). */
function ospAnalysisCase(r: Rel): CaseRecord {
  const previous = r.days(-11);
  return caseRecord({
    id: 'c-002',
    person: {
      id: 'p-wojcik',
      firstName: 'Piotr',
      lastName: 'Wójcik',
      position:
        'Starszy specjalista do spraw zarządzania kryzysowego w cyberprzestrzeni',
      unit: TEAM_UNIT,
      employment: 'PRACOWNIK',
      hiredOn: '2019-10-01',
    },
    evaluatorId: SUPERVISOR_ID,
    path: 'PERIODIC',
    sheetId: null,
    ospId: 'osp-dc-wzksoic-6',
    cycleStart: { kind: 'PREVIOUS_POSITIVE', assessedOn: previous },
    stage: 'OSP_ANALYSIS',
    history: [
      {
        date: previous,
        text: 'Sporządzono poprzednią ocenę okresową: pozytywna, „Na poziomie oczekiwań”. Rozpoczął się nowy cykl oceny.',
      },
    ],
  });
}

/** Sheet B (team leader; the naczelnik OSP is the job description), observation period. */
function sheetBCase(r: Rel): CaseRecord {
  const id = 'c-003';
  const confirmed = r.months(-14);
  return caseRecord({
    id,
    person: {
      id: 'p-lewandowski',
      firstName: 'Michał',
      lastName: 'Lewandowski',
      position: 'Kierownik zespołu do spraw współpracy międzynarodowej',
      unit: TEAM_UNIT,
      employment: 'URZEDNIK',
      hiredOn: '2014-02-03',
    },
    evaluatorId: SUPERVISOR_ID,
    path: 'PERIODIC',
    sheetId: 'B',
    ospId: 'osp-dwm-wkam-1',
    cycleStart: { kind: 'PREVIOUS_POSITIVE', assessedOn: r.months(-15, 10) },
    previousAssessment: previousAssessment(
      { kind: 'PREVIOUS_POSITIVE', assessedOn: r.months(-15, 10) },
      'na poziomie oczekiwań',
    ),
    stage: 'OBSERVATION',
    completedOn: { OSP_ANALYSIS: r.months(-14, -3), OPENING_TALK: confirmed },
    partI: {
      ...emptyPartI(),
      additionalCriteria: ['wykorzystywanie_wiedzy', 'negocjowanie'],
      assessmentDue: defaultAssessmentDue(confirmed),
      topics: {
        duties:
          'Koordynacja zespołu (6 osób), przygotowanie wizyt zagranicznych kierownictwa, obsługa dotacji i zamówień na usługi podróży.',
        criteria:
          'Pięć kryteriów obowiązkowych arkusza B; dodatkowe: „Wykorzystywanie wiedzy i doskonalenie zawodowe” (wskazane w OSP) i „Negocjowanie” (uzgodnienia z partnerami zagranicznymi i wykonawcami).',
        expectations:
          'Regularne punkty kontrolne z zespołem, informacja zwrotna co kwartał, przygotowanie mandatu przed każdą rundą uzgodnień.',
        goals:
          'Wdrożenie wspólnego kalendarza wizyt i wydarzeń do końca 2025 r.',
      },
      expectations: {
        zarzadzanie_ludzmi:
          'Przydziela zadania z jasnym zakresem i terminem; co kwartał przekazuje członkom zespołu informację zwrotną.',
        podejmowanie_decyzji:
          'Podejmuje decyzje w sprawach organizacji wizyt w swoim zakresie, bez odkładania ich na ostatnią chwilę.',
        organizacja_pracy:
          'Planuje kalendarz wizyt z wyprzedzeniem i ustala zastępstwa w zespole.',
        wspolpraca:
          'Uzgadnia przygotowanie wizyt z departamentami merytorycznymi i protokołem.',
        komunikacja:
          'Przekazuje kierownictwu zwięzłe notatki przed wizytami i po nich.',
        wykorzystywanie_wiedzy:
          'Zna zasady rozliczania dotacji i zamówień na usługi podróży; aktualizuje wiedzę po zmianach przepisów.',
        negocjowanie:
          'Przed każdą rundą uzgodnień przygotowuje mandat i stanowisko minimalne.',
      },
      confirmedByEvaluatorOn: confirmed,
      acknowledgedByEmployeeOn: confirmed,
    },
    observations: observations(id, [
      {
        date: r.months(-11, 6),
        criterionId: 'zarzadzanie_ludzmi',
        indicatorId: 'zarzadzanie_ludzmi.4',
        kind: 'STRENGTH',
        situation:
          'Po nieudanej organizacji spotkania dwustronnego członek zespołu pominął potwierdzenie tłumacza.',
        action:
          'Omówił z pracownikiem przebieg sprawy na konkretnych faktach i uzgodnił listę kontrolną przed wizytą.',
        result: 'Kolejne cztery wizyty odbyły się bez braków organizacyjnych.',
      },
      {
        date: r.months(-8, 1),
        criterionId: 'negocjowanie',
        indicatorId: 'negocjowanie.1',
        kind: 'DEVELOPMENT',
        situation:
          'Uzgadnianie z wykonawcą zmian w umowie na usługi tłumaczeniowe.',
        action:
          'Przystąpił do rozmów bez ustalonego zakresu ustępstw i wariantu na wypadek braku porozumienia.',
        result:
          'Rozmowy przerwano i powtórzono po tygodniu, po przygotowaniu mandatu z naczelnikiem.',
      },
      {
        date: r.months(-4, 9),
        criterionId: 'podejmowanie_decyzji',
        indicatorId: 'podejmowanie_decyzji.2',
        kind: 'STRENGTH',
        situation:
          'Odwołany lot delegacji na dzień przed konferencją w Brukseli.',
        action:
          'W ciągu dwóch godzin porównał trzy warianty podróży i podjął decyzję w granicach budżetu.',
        result: 'Delegacja dotarła na czas, koszt mieścił się w planie.',
      },
      {
        date: r.days(-30),
        criterionId: 'komunikacja',
        indicatorId: 'komunikacja.3',
        kind: 'STRENGTH',
        situation:
          'Notatka dla kierownictwa przed wizytą partnerów z Europy Północnej.',
        action:
          'Wyodrębnił najważniejsze ustalenia, kwestie otwarte i podział odpowiedzialności.',
        result:
          'Notatkę przyjęto bez uzupełnień i wykorzystano jako wzór dla zespołu.',
      },
    ]),
    history: [
      {
        date: confirmed,
        text: 'Rozmowa rozpoczynająca. Zatwierdzono część I (2 kryteria dodatkowe); oceniany potwierdził zapoznanie.',
      },
    ],
  });
}

/** First assessment: hired ~8 months ago, waiting for the report. */
function firstAssessmentCase(r: Rel): CaseRecord {
  const id = 'c-004';
  const hiredOn = r.months(-8, -5);
  const intro = r.workday(addDays(hiredOn, 10));
  return caseRecord({
    id,
    person: {
      id: 'p-mazur',
      firstName: 'Julia',
      lastName: 'Mazur',
      position: 'Specjalista do spraw analiz danych',
      unit: TEAM_UNIT,
      employment: 'PRACOWNIK',
      hiredOn,
    },
    evaluatorId: SUPERVISOR_ID,
    path: 'FIRST',
    sheetId: 'FIRST',
    cycleStart: { kind: 'HIRED', date: hiredOn },
    stage: 'REPORT',
    completedOn: { INTRO_TALK: intro },
    firstConditions: {
      examPassed: 'YES',
      reportSubmittedOn: null,
      reportDue: defaultReportDue(hiredOn),
    },
    observations: observations(id, [
      {
        date: r.months(-5),
        criterionId: 'rzetelnosc',
        indicatorId: 'rzetelnosc.1',
        kind: 'STRENGTH',
        situation:
          'Pierwsze samodzielne zestawienie danych do sprawozdania kwartalnego.',
        action:
          'Sprawdziła kompletność danych ze źródłami i opisała przyjęte założenia.',
        result: 'Zestawienie przyjęto bez poprawek.',
      },
      {
        date: r.months(-2),
        criterionId: 'komunikacja',
        indicatorId: 'komunikacja.1',
        kind: 'DEVELOPMENT',
        situation:
          'Spotkanie z departamentem merytorycznym w sprawie zakresu analizy.',
        action:
          'Nie dopytała o niejasny zakres danych i nie potwierdziła ustaleń po spotkaniu.',
        result:
          'Analizę trzeba było częściowo powtórzyć; ustaliliśmy, że po spotkaniach wysyła krótkie podsumowanie.',
      },
    ]),
    history: [
      {
        date: hiredOn,
        text: 'Nawiązanie stosunku pracy na czas określony 12 miesięcy (art. 35 ust. 3 ustawy o służbie cywilnej).',
      },
      {
        date: intro,
        text: `Odbyła się rozmowa wstępna. Termin na złożenie sprawozdania: ${formatDatePl(defaultReportDue(hiredOn))}.`,
      },
      {
        date: r.months(-4, 12),
        text: 'Służba przygotowawcza zakończona egzaminem z wynikiem pozytywnym.',
      },
    ],
  });
}

/** After a negative assessment: re-assessment in 6 months, opening talk within 7 days. */
function afterNegativeCase(r: Rel): CaseRecord {
  const assessedOn = r.days(-4);
  const acknowledgedOn = r.days(-3);
  return caseRecord({
    id: 'c-005',
    person: {
      id: 'p-szymanski',
      firstName: 'Paweł',
      lastName: 'Szymański',
      position: 'Starszy specjalista do spraw infrastruktury krytycznej',
      unit: TEAM_UNIT,
      employment: 'URZEDNIK',
      hiredOn: '2020-06-01',
    },
    evaluatorId: SUPERVISOR_ID,
    path: 'PERIODIC',
    sheetId: 'C',
    ospId: 'osp-dc-wzksoic-6',
    cycleStart: { kind: 'PREVIOUS_NEGATIVE', assessedOn, acknowledgedOn },
    stage: 'OPENING_TALK',
    completedOn: { OSP_ANALYSIS: r.days(-2) },
    // Part I stays empty (no additional criteria either): the supervisor
    // fills it by hand at the opening talk.
    history: [
      {
        date: assessedOn,
        text: 'Sporządzono ocenę okresową: negatywna, „Poniżej oczekiwań” (rzetelność 1 pkt: dwa protokoły kontroli przekazane po terminie i z brakami).',
      },
      {
        date: acknowledgedOn,
        text: 'Oceniany zapoznał się z oceną negatywną. Ponowna ocena po upływie 6 miesięcy (art. 81 ust. 9 ustawy o służbie cywilnej); rozmowa rozpoczynająca w 7 dni od sporządzenia oceny (§7 pkt 2).',
      },
      {
        date: r.days(-2),
        text: 'Zatwierdzono analizę opisu stanowiska: arkusz C.',
      },
    ],
  });
}

/** Assessment acknowledged 3 days ago: the 7-day objection term is running. */
function objectionPeriodCase(r: Rel): CaseRecord {
  const confirmed = r.months(-24, 6);
  const signed = r.days(-5);
  const acknowledged = r.days(-3);
  return caseRecord({
    id: 'c-006',
    person: {
      id: 'p-dabrowska',
      firstName: 'Ewa',
      lastName: 'Dąbrowska',
      position: 'Główny specjalista do spraw opiniowania aktów prawnych',
      unit: TEAM_UNIT,
      employment: 'URZEDNIK',
      hiredOn: '2012-09-03',
    },
    evaluatorId: SUPERVISOR_ID,
    path: 'PERIODIC',
    sheetId: 'C',
    ospId: 'osp-dsi-wwi-5',
    cycleStart: { kind: 'PREVIOUS_POSITIVE', assessedOn: r.months(-25, 20) },
    previousAssessment: previousAssessment(
      { kind: 'PREVIOUS_POSITIVE', assessedOn: r.months(-25, 20) },
      'na poziomie oczekiwań',
    ),
    promotionRequest: { ...emptyPromotionRequest('URZEDNIK'), attached: 'NO' },
    stage: 'DOCUMENT',
    completedOn: {
      OSP_ANALYSIS: r.months(-24, 2),
      OPENING_TALK: confirmed,
      OBSERVATION: r.days(-9),
      ASSESSMENT: r.days(-7),
      JUSTIFICATION: signed,
      DOCUMENT: acknowledged,
    },
    partI: {
      ...emptyPartI(),
      additionalCriteria: ['kreatywnosc'],
      assessmentDue: defaultAssessmentDue(confirmed),
      topics: {
        duties:
          'Omówiono zadania z OSP: opiniowanie projektów aktów prawnych pod kątem zgodności z prawem UE, przygotowanie uwag w uzgodnieniach międzyresortowych i udział w konferencjach uzgodnieniowych.',
        criteria:
          'Pięć kryteriów obowiązkowych arkusza C oraz kryterium dodatkowe „Kreatywność”: zadania obejmują proponowanie nowych rozwiązań w projektach przepisów.',
        expectations:
          'Uzgodniono oczekiwania dla każdego kryterium (niżej); szczególny nacisk na terminowość uwag w uzgodnieniach.',
        goals: '',
      },
      expectations: {
        wykorzystywanie_wiedzy:
          'Stosuje aktualne orzecznictwo i wytyczne w opiniach; dzieli się z wydziałem wnioskami ze szkoleń.',
        rzetelnosc:
          'Opinie i uwagi sprawdzone przed przekazaniem, w terminach wyznaczonych w uzgodnieniach.',
        organizacja_pracy:
          'Planuje pracę nad kilkoma projektami naraz; przy zbiegu terminów uzgadnia priorytety z naczelnikiem.',
        wspolpraca:
          'Uzgadnia stanowisko z departamentami merytorycznymi przed konferencją uzgodnieniową.',
        komunikacja:
          'Uwagi do projektów są zwięzłe, z podstawą prawną i propozycją brzmienia przepisu.',
        kreatywnosc:
          'Proponuje alternatywne brzmienie przepisów, gdy projekt budzi wątpliwości.',
      },
      confirmedByEvaluatorOn: confirmed,
      acknowledgedByEmployeeOn: confirmed,
    },
    ratings: {
      wykorzystywanie_wiedzy: ratingsFor('wykorzystywanie_wiedzy', 7),
      rzetelnosc: ratingsFor('rzetelnosc', 7),
      organizacja_pracy: ratingsFor('organizacja_pracy', 5, {
        'organizacja_pracy.3': null,
      }),
      wspolpraca: ratingsFor('wspolpraca', 7, { 'wspolpraca.3': 5 }),
      komunikacja: ratingsFor('komunikacja', 5),
      kreatywnosc: ratingsFor('kreatywnosc', 7),
    },
    decisions: {
      wykorzystywanie_wiedzy: 7,
      rzetelnosc: 7,
      organizacja_pracy: 5,
      wspolpraca: 7,
      komunikacja: 5,
      kreatywnosc: 7,
    },
    justification:
      'Oceniana przez cały okres przygotowywała opinie do projektów aktów prawnych terminowo i bez błędów merytorycznych. Wyróżnia ją łączenie wiedzy z kilku dziedzin prawa i proponowanie nowych rozwiązań (m.in. lista kontrolna oceny skutków regulacji). Organizacja pracy i komunikacja na poziomie oczekiwań.',
    iprz: 'Szkolenie z prowadzenia spotkań konsultacyjnych (I półrocze); udział w zespole ds. wdrożenia aktu w sprawie AI jako ekspert; mentoring nowej osoby w wydziale.',
    signedByEvaluatorOn: signed,
    sentForAckOn: signed,
    acknowledgedOn: acknowledged,
    history: [
      {
        date: confirmed,
        text: 'Rozmowa rozpoczynająca. Zatwierdzono część I (kryterium dodatkowe: Kreatywność).',
      },
      {
        date: signed,
        text: 'Oceniający zatwierdził ocenę na piśmie: pozytywna, „Powyżej oczekiwań” (średnia 6,33). Ocenę przekazano do zapoznania.',
      },
      {
        date: acknowledged,
        text: 'Oceniany zapoznał się z oceną. Biegnie 7-dniowy termin na sprzeciw (art. 83 ust. 1 ustawy o służbie cywilnej).',
      },
      {
        date: acknowledged,
        text: 'Nowy cykl oceny: rozmowa rozpoczynająca w 30 dni od sporządzenia oceny (§7 pkt 1). Sprzeciw nie wstrzymuje nowego cyklu.',
      },
    ],
  });
}

/** Cases of other units: visible only in the HR overview. */
function otherUnitCases(r: Rel): CaseRecord[] {
  const budget = EVALUATORS[1];
  const legal = EVALUATORS[2];
  const signed = r.days(-2);
  const overdueConfirmed = r.months(-24, -6);
  return [
    caseRecord({
      id: 'c-101',
      person: {
        id: 'p-wieczorek',
        firstName: 'Karolina',
        lastName: 'Wieczorek',
        position: 'Starszy referent do spraw rozliczeń dotacji',
        unit: budget.unit,
        employment: 'PRACOWNIK',
        hiredOn: '2021-01-04',
      },
      evaluatorId: budget.id,
      path: 'PERIODIC',
      sheetId: 'C',
      cycleStart: { kind: 'HIRED', date: '2024-11-04' },
      stage: 'DOCUMENT',
      completedOn: {
        OSP_ANALYSIS: '2024-11-12',
        OPENING_TALK: '2024-11-20',
        OBSERVATION: r.days(-6),
        ASSESSMENT: r.days(-4),
        JUSTIFICATION: signed,
      },
      partI: {
        ...emptyPartI(),
        assessmentDue: defaultAssessmentDue('2024-11-20'),
        confirmedByEvaluatorOn: '2024-11-20',
        acknowledgedByEmployeeOn: '2024-11-20',
      },
      decisions: {
        wykorzystywanie_wiedzy: 5,
        rzetelnosc: 7,
        organizacja_pracy: 5,
        wspolpraca: 5,
        komunikacja: 5,
      },
      iprz: 'Szkolenie z kontroli rozliczeń dotacji; samodzielne prowadzenie rozliczeń w nowym systemie finansowym.',
      signedByEvaluatorOn: signed,
      sentForAckOn: signed,
      history: [
        {
          date: signed,
          text: 'Ocenę zatwierdzono i przekazano do zapoznania.',
        },
      ],
    }),
    caseRecord({
      id: 'c-102',
      person: {
        id: 'p-krawczyk',
        firstName: 'Damian',
        lastName: 'Krawczyk',
        position: 'Specjalista do spraw planowania budżetu',
        unit: budget.unit,
        employment: 'URZEDNIK',
        hiredOn: '2018-05-02',
      },
      evaluatorId: budget.id,
      path: 'PERIODIC',
      sheetId: 'C',
      cycleStart: { kind: 'PREVIOUS_POSITIVE', assessedOn: r.days(-47) },
      stage: 'OPENING_TALK',
      completedOn: { OSP_ANALYSIS: r.days(-40) },
      lastReminderOn: r.days(-7),
      history: [
        {
          date: r.days(-47),
          text: 'Sporządzono poprzednią ocenę okresową: pozytywna.',
        },
        {
          date: r.days(-7),
          text: 'Kadry wysłały przypomnienie o rozmowie rozpoczynającej.',
        },
      ],
    }),
    caseRecord({
      id: 'c-103',
      person: {
        id: 'p-gorska',
        firstName: 'Natalia',
        lastName: 'Górska',
        position: 'Radca do spraw legislacji',
        unit: legal.unit,
        employment: 'URZEDNIK',
        hiredOn: '2015-03-02',
      },
      evaluatorId: legal.id,
      path: 'PERIODIC',
      sheetId: 'C',
      cycleStart: { kind: 'PREVIOUS_POSITIVE', assessedOn: r.months(-25, -10) },
      previousAssessment: previousAssessment(
        { kind: 'PREVIOUS_POSITIVE', assessedOn: r.months(-25, -10) },
        'na poziomie oczekiwań',
      ),
      stage: 'OBSERVATION',
      completedOn: {
        OSP_ANALYSIS: overdueConfirmed,
        OPENING_TALK: overdueConfirmed,
      },
      partI: {
        ...emptyPartI(),
        additionalCriteria: ['negocjowanie'],
        assessmentDue: defaultAssessmentDue(overdueConfirmed),
        confirmedByEvaluatorOn: overdueConfirmed,
        acknowledgedByEmployeeOn: overdueConfirmed,
      },
    }),
    caseRecord({
      id: 'c-104',
      person: {
        id: 'p-olszewski',
        firstName: 'Bartosz',
        lastName: 'Olszewski',
        position: 'Referent do spraw legislacji',
        unit: legal.unit,
        employment: 'PRACOWNIK',
        hiredOn: r.days(-12),
      },
      evaluatorId: legal.id,
      path: 'FIRST',
      sheetId: 'FIRST',
      cycleStart: { kind: 'HIRED', date: r.days(-12) },
      stage: 'INTRO_TALK',
      firstConditions: {
        examPassed: null,
        reportSubmittedOn: null,
        reportDue: null,
      },
    }),
  ];
}
