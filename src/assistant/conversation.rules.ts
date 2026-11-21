import type { CaseDetail, StageId } from '../cases/case.types.js';
import {
  COMPETENCY_MODEL,
  SHEET_MAPPING,
} from '../competency-model/data/model.data.js';
import { SHEETS } from '../sheets/sheets.data.js';

const competency = (id: string) =>
  COMPETENCY_MODEL.competencies.find((c) => c.id === id);
const criterionName = (id: string) => competency(id)?.name.toLowerCase() ?? id;

/** Rule question that backs each stage with citable sources. */
export const STAGE_RULE_QUERY: Record<StageId, string> = {
  OSP_ANALYSIS:
    'wybór arkusza oceny i kryteriów dodatkowych na podstawie opisu stanowiska',
  SHEET_PROPOSAL:
    'wybór arkusza oceny A B C i kryteriów dodatkowych najwyżej 3',
  OPENING_TALK: 'co omawia się na rozmowie rozpoczynającej proces oceny',
  OBSERVATION:
    'proces oceniania obserwacja pracownika udzielanie informacji zwrotnej',
  ASSESSMENT:
    'skala ocen cząstkowych ogólny poziom spełniania kryteriów oceny średnia',
  ASSESSMENT_TALK: 'rozmowa oceniająca co omawia się kierunki rozwoju',
  JUSTIFICATION: 'uzasadnienie ocen cząstkowych wnioski do IPRZ',
  DOCUMENT: 'zapoznanie ocenianego z oceną sprzeciw 7 dni',
  INTRO_TALK: 'rozmowa wstępna pierwsza ocena 21 dni',
  REPORT: 'sprawozdanie w pierwszej ocenie termin złożenia',
  FIRST_ASSESSMENT: 'rozmowa oceniająca w pierwszej ocenie',
  FIRST_CONDITIONS: 'warunki przyznania pozytywnej pierwszej oceny',
  FIRST_DOCUMENT: 'zapoznanie z pierwszą oceną akta osobowe',
};

/** Criteria the case is assessed on: sheet mandatory + chosen additional. */
export function caseCriteria(detail: CaseDetail): string[] {
  if (detail.path === 'FIRST') return [...SHEET_MAPPING.first.elements];
  const sheetId = detail.sheetId ?? detail.ospAnalysis?.suggestedSheet?.sheetId;
  const sheet = SHEETS.find((s) => s.id === sheetId);
  return [
    ...new Set([
      ...(sheet?.mandatoryCriteria ?? []),
      ...detail.partI.additionalCriteria,
    ]),
  ];
}

/**
 * Case facts for the model prompt. Data minimisation: no names, only the
 * position, the sheet, criteria, decisions and observations.
 */
export function caseContext(detail: CaseDetail, stage: StageId): string {
  const lines = [
    `Ścieżka: ${detail.path === 'FIRST' ? 'pierwsza ocena' : 'ocena okresowa'}; arkusz: ${detail.sheetId ?? 'nie wybrano'}; etap: ${stage}.`,
    `Stanowisko ocenianego: ${detail.person.position} (${detail.person.unit}).`,
    `Kryteria: ${caseCriteria(detail).map(criterionName).join('; ')}.`,
  ];
  const expectations = Object.entries(detail.partI.expectations);
  if (expectations.length) {
    lines.push(
      'Oczekiwania z części I:',
      ...expectations.map(([id, text]) => `- ${criterionName(id)}: ${text}`),
    );
  }
  const decisions = Object.entries(detail.decisions);
  if (decisions.length) {
    lines.push(
      `Wstępne decyzje oceniającego (pkt): ${decisions.map(([id, p]) => `${criterionName(id)} ${p}`).join('; ')}.`,
    );
  }
  if (detail.observations.length) {
    lines.push(
      'Obserwacje (sytuacja / działanie / rezultat):',
      ...detail.observations.map(
        (o) =>
          `- ${o.date}, ${criterionName(o.criterionId)}, ${o.kind === 'STRENGTH' ? 'mocna strona' : 'obszar rozwoju'}: ${o.situation} / ${o.action} / ${o.result}`,
      ),
    );
  }
  return lines.join('\n');
}

const lowerFirst = (s: string) =>
  (s.charAt(0).toLowerCase() + s.slice(1)).replace(/\.+$/, '');

/**
 * Deterministic coaching template used when no language model is configured:
 * questions from the criteria indicators and the observations, an SDR
 * feedback outline and IPRZ ideas. Never proposes a rating.
 */
export function conversationTemplate(
  detail: CaseDetail,
  stage: StageId,
): string {
  const criteria = caseCriteria(detail);
  const out: string[] = [
    `Propozycje do rozmowy (etap: ${stage}, stanowisko: ${detail.person.position}). To podpowiedzi – zakres rozmowy i ocenę ustala oceniający.`,
    '',
    'Pytania do rozmowy:',
  ];
  if (criteria.length === 0) {
    out.push(
      '- Arkusz nie jest jeszcze wybrany, więc nie ma kryteriów – najpierw dobierz arkusz na podstawie opisu stanowiska.',
    );
  }
  for (const id of criteria) {
    const indicators = competency(id)?.indicators.slice(0, 1) ?? [];
    for (const ind of indicators) {
      out.push(
        `- (${criterionName(id)}) Proszę podać przykład z ocenianego okresu, który pokazuje: ${lowerFirst(ind.name)}. Co było trudne i jaki był rezultat?`,
      );
    }
  }
  const strengths = detail.observations.filter((o) => o.kind === 'STRENGTH');
  const development = detail.observations.filter(
    (o) => o.kind === 'DEVELOPMENT',
  );
  for (const o of detail.observations.slice(0, 5)) {
    out.push(
      `- (obserwacja z ${o.date}) Porozmawiajmy o sytuacji: „${o.situation}”. Jak ocenia Pan/Pani swoje działanie i jego skutek?`,
    );
  }
  if (detail.observations.length) {
    out.push(
      '',
      'Struktura informacji zwrotnej (sytuacja – działanie – rezultat):',
    );
    for (const o of strengths) {
      out.push(
        `- Mocna strona – ${criterionName(o.criterionId)}: sytuacja: ${o.situation}; działanie: ${o.action}; rezultat: ${o.result}.`,
      );
    }
    for (const o of development) {
      out.push(
        `- Do rozwoju – ${criterionName(o.criterionId)}: sytuacja: ${o.situation}; działanie: ${o.action}; rezultat: ${o.result}. Zapytaj, co następnym razem można zrobić inaczej.`,
      );
    }
  }
  const lowDecisions = Object.entries(detail.decisions)
    .filter(([, p]) => p <= 3)
    .map(([id]) => id);
  const devAreas = [
    ...new Set([...development.map((o) => o.criterionId), ...lowDecisions]),
  ];
  out.push('', 'Pomysły do IPRZ (do uzgodnienia z ocenianym):');
  if (devAreas.length === 0) {
    out.push(
      '- Brak zapisanych obszarów rozwoju – ustal z ocenianym kierunki rozwoju i potrzeby szkoleniowe.',
    );
  }
  for (const id of devAreas) {
    const ind = competency(id)?.indicators[0];
    out.push(
      `- ${criterionName(id)}: działanie rozwojowe (szkolenie, mentoring, zadanie rozwojowe)${ind ? ` ukierunkowane na: ${lowerFirst(ind.name)}` : ''}.`,
    );
  }
  return out.join('\n');
}

export const CONVERSATION_ADDENDUM = `Tryb asystenta rozmowy: pomagasz przygotować rozmowę z pracownikiem. Na podstawie kontekstu sprawy możesz proponować pytania do rozmowy, strukturę informacji zwrotnej (sytuacja – działanie – rezultat) i pomysły do IPRZ – zaznacz, że to propozycje. Zasady i terminy podawaj wyłącznie z fragmentów źródeł, z numerem [n]. Nie proponuj ocen ani punktów.`;

/** Example questions per stage, for the assistant panel. */
export const STAGE_SUGGESTIONS: Record<StageId | 'GENERAL', string[]> = {
  GENERAL: [
    'Kto podlega ocenie okresowej?',
    'Jak często sporządza się ocenę okresową?',
    'Kiedy dokonuje się pierwszej oceny?',
    'W jakim terminie można wnieść sprzeciw od oceny okresowej?',
  ],
  OSP_ANALYSIS: [
    'Kiedy używa się arkusza A, B, a kiedy C?',
    'Ile kryteriów dodatkowych można wybrać i skąd?',
    'Kierownik zespołu bez tytułu naczelnika – który arkusz?',
  ],
  SHEET_PROPOSAL: [
    'Kiedy używa się arkusza A, B, a kiedy C?',
    'Ile kryteriów dodatkowych można wybrać i skąd?',
    'Czy można zmienić arkusz po rozmowie rozpoczynającej?',
  ],
  OPENING_TALK: [
    'Co omawia się na rozmowie rozpoczynającej?',
    'W jakim terminie trzeba przeprowadzić rozmowę rozpoczynającą?',
    'Co dzieje się z arkuszem po rozmowie rozpoczynającej?',
  ],
  OBSERVATION: [
    'Co zrobić, gdy w trakcie okresu oceny zmieni się przełożony?',
    'Czy nieobecność dłuższa niż miesiąc przedłuża termin oceny?',
    'Kiedy oceniający może zmienić termin oceny?',
  ],
  ASSESSMENT: [
    'Jaka jest skala ocen cząstkowych w ocenie okresowej?',
    'Jak ze średniej wyznacza się ogólny poziom spełniania kryteriów?',
    'Kiedy przeprowadza się rozmowę oceniającą?',
  ],
  ASSESSMENT_TALK: [
    'Co omawia się na rozmowie oceniającej?',
    'Jakie pytania zadać ocenianemu na rozmowie oceniającej?',
    'Jak uporządkować argumenty uzasadniające ocenę?',
  ],
  JUSTIFICATION: [
    'Kiedy trzeba uzasadnić ocenę cząstkową?',
    'Co powinny zawierać wnioski do IPRZ?',
    'Kiedy można wnioskować o kolejny stopień służbowy?',
  ],
  DOCUMENT: [
    'W jakim terminie przysługuje sprzeciw od oceny okresowej?',
    'Co dzieje się po uzyskaniu oceny negatywnej?',
    'Co zrobić z arkuszem po zapoznaniu ocenianego z oceną?',
  ],
  INTRO_TALK: [
    'W jakim terminie przeprowadza się rozmowę wstępną?',
    'Co omawia się na rozmowie wstępnej w pierwszej ocenie?',
  ],
  REPORT: [
    'Czym jest sprawozdanie w pierwszej ocenie i jaki okres obejmuje?',
    'Kiedy wyznacza się nowy termin na złożenie sprawozdania?',
  ],
  FIRST_ASSESSMENT: [
    'Jaka jest skala ocen w pierwszej ocenie?',
    'Kto dokonuje pierwszej oceny i co dzieje się potem?',
  ],
  FIRST_CONDITIONS: [
    'Jakie są warunki pozytywnej pierwszej oceny?',
    'Średnia 5,4, egzamin zaliczony, ale sprawozdanie złożone po terminie. Jaki jest wynik?',
  ],
  FIRST_DOCUMENT: [
    'Czy od pierwszej oceny przysługuje sprzeciw?',
    'Co oznacza negatywna pierwsza ocena dla umowy o pracę?',
  ],
};
