import {
  listPoints,
  RO_2016,
  RP_2015,
} from '../assessments/assessment.format.js';
import {
  caseCriteria,
  computeEvaluation,
  criterionName,
  reportOnTime,
  sheetOf,
} from './case.rules.js';
import type { CaseRecord, FormalCheckItem } from './case.types.js';
import { ASSESSMENT_TALK_LEGAL_BASIS } from './assessment-talk.rules.js';
import { formatDatePl } from './dates.js';
import { firstAssessmentWindow, USC } from './deadlines.rules.js';
import { promotionRequestCheck } from './promotion.rules.js';

const quoted = (ids: readonly string[]) =>
  ids.map((id) => `„${criterionName(id)}”`).join(', ');

/**
 * Formal check before the evaluator signs the assessment (notatki/formularze.md
 * sections 1.2 and 2: the forms block approval on these). Every item is
 * returned, so the UI can show ✓ and ✗; signing requires all `ok`.
 */
export function formalCheck(
  record: CaseRecord,
  today: string,
): FormalCheckItem[] {
  const sheet = sheetOf(record);
  if (!sheet) {
    return [
      {
        id: 'SHEET_SELECTED',
        ok: false,
        message:
          'Nie wybrano arkusza oceny: zatwierdź analizę opisu stanowiska.',
        legalBasis: `§3 ${RO_2016}`,
      },
    ];
  }
  const isFirst = sheet.kind === 'FIRST';
  const criteria = caseCriteria(record);
  const evaluation = computeEvaluation(record, today);
  const items: FormalCheckItem[] = [];

  if (!isFirst) {
    const confirmed =
      record.partI.confirmedByEvaluatorOn !== null &&
      record.partI.acknowledgedByEmployeeOn !== null;
    items.push({
      id: 'PART_I_CONFIRMED',
      ok: confirmed,
      message: confirmed
        ? `Część I zatwierdzona, oceniany zapoznał się z kryteriami ${formatDatePl(record.partI.acknowledgedByEmployeeOn!)}.`
        : 'Część I nie została zatwierdzona lub oceniany nie potwierdził zapoznania z kryteriami.',
      legalBasis: `§5 ust. 3, §6 ${RO_2016}`,
    });
  }

  const missing = criteria.filter((id) => record.decisions[id] == null);
  items.push({
    id: 'ALL_CRITERIA_DECIDED',
    ok: missing.length === 0,
    message:
      missing.length === 0
        ? `Wszystkie ${isFirst ? 'elementy' : 'kryteria'} (${criteria.length}) mają ocenę cząstkową.`
        : `Brak oceny cząstkowej: ${quoted(missing)}.`,
    legalBasis: isFirst
      ? `§9 ust. 1 ${RP_2015}`
      : `§11 ust. 1 pkt 1 ${RO_2016}`,
  });

  const outOfScale = Object.entries(record.decisions)
    .filter(([, points]) => !sheet.scale.includes(points))
    .map(([id]) => id);
  items.push({
    id: 'POINTS_IN_SCALE',
    ok: outOfScale.length === 0,
    message:
      outOfScale.length === 0
        ? `Oceny cząstkowe mieszczą się w skali arkusza (${listPoints(sheet.scale)} pkt).`
        : `Ocena spoza skali ${listPoints(sheet.scale)} pkt: ${quoted(outOfScale)}.`,
    legalBasis: isFirst
      ? `§9 ust. 1 ${RP_2015}`
      : `§11 ust. 1 pkt 1 ${RO_2016}`,
  });

  if (!isFirst) {
    const additional = record.partI.additionalCriteria;
    const allowed = new Set(criteria);
    const foreign = Object.keys(record.decisions).filter(
      (id) => !allowed.has(id),
    );
    const mandatoryDup = additional.filter((id) =>
      sheet.mandatoryCriteria.includes(id),
    );
    const consistent =
      foreign.length === 0 &&
      mandatoryDup.length === 0 &&
      additional.length <= sheet.maxAdditionalCriteria &&
      new Set(additional).size === additional.length;
    const problems: string[] = [];
    if (foreign.length > 0) {
      problems.push(
        `oceniono kryteria nieustalone w części I: ${quoted(foreign)}`,
      );
    }
    if (mandatoryDup.length > 0) {
      problems.push(
        `kryteria obowiązkowe wpisane jako dodatkowe: ${quoted(mandatoryDup)}`,
      );
    }
    if (additional.length > sheet.maxAdditionalCriteria) {
      problems.push(
        `więcej niż ${sheet.maxAdditionalCriteria} kryteria dodatkowe`,
      );
    }
    items.push({
      id: 'ADDITIONAL_CRITERIA_CONSISTENT',
      ok: consistent,
      message: consistent
        ? additional.length === 0
          ? 'Brak kryteriów dodatkowych; część II obejmuje tylko kryteria obowiązkowe arkusza.'
          : `Kryteria dodatkowe w części II są te same co w części I: ${quoted(additional)}.`
        : `Niezgodność kryteriów części I i II: ${problems.join('; ')}.`,
      legalBasis: `§2 ust. 2, §5 ust. 2 ${RO_2016}`,
    });

    const talk = record.assessmentTalkOn;
    items.push({
      id: 'ASSESSMENT_TALK_HELD',
      ok: talk !== null,
      message: talk
        ? `Rozmowa oceniająca przeprowadzona ${formatDatePl(talk)}.`
        : 'Najpierw przeprowadź i odnotuj rozmowę oceniającą: odbywa się ona przed sporządzeniem oceny na piśmie.',
      legalBasis: `${ASSESSMENT_TALK_LEGAL_BASIS}; §11 ust. 2 ${RO_2016}`,
    });
  }

  if (isFirst) {
    const onTime = reportOnTime(record.firstConditions, today);
    const exam = record.firstConditions?.examPassed ?? null;
    const filled = exam !== null && onTime !== null;
    const parts: string[] = [];
    if (exam === null)
      parts.push(
        'wynik egzaminu ze służby przygotowawczej (TAK / NIE / NIE DOTYCZY)',
      );
    if (onTime === null)
      parts.push('informację o złożeniu sprawozdania w terminie');
    items.push({
      id: 'FIRST_CONDITIONS_FILLED',
      ok: filled,
      message: filled
        ? 'Warunki pierwszej oceny są uzupełnione (egzamin, sprawozdanie w terminie).'
        : `Uzupełnij warunki pierwszej oceny: ${parts.join(' oraz ')}.`,
      legalBasis: `§10 ust. 1 pkt 1–2 ${RP_2015}`,
    });

    const window = firstAssessmentWindow(record.person.hiredOn);
    const inWindow = today >= window.from && today <= window.to;
    items.push({
      id: 'FIRST_ASSESSMENT_WINDOW',
      ok: inWindow,
      message: inWindow
        ? `Ocena mieści się w terminie: od ${formatDatePl(window.from)} do ${formatDatePl(window.to)}.`
        : today < window.from
          ? `Pierwszej oceny można dokonać dopiero po upływie 8 miesięcy pracy, od ${formatDatePl(window.from)}.`
          : `Minął termin pierwszej oceny (${formatDatePl(window.to)}: miesiąc przed końcem umowy).`,
      legalBasis: `art. 38 ust. 1 ${USC}`,
    });
  }

  const justified = record.justification.trim().length > 0;
  const negative = evaluation?.result === 'NEGATIVE';
  items.push({
    id: 'JUSTIFICATION_IF_NEGATIVE',
    ok: justified || evaluation?.result === 'POSITIVE',
    message: justified
      ? 'Uzasadnienie oceny jest wpisane.'
      : evaluation === null
        ? 'Wynik oceny nie jest jeszcze znany. Uzasadnienie jest obowiązkowe, jeśli ocena będzie negatywna.'
        : negative
          ? 'Ocena jest negatywna: wpisz uzasadnienie (pole obowiązkowe).'
          : 'Ocena jest pozytywna: uzasadnienie jest opcjonalne, ale zalecane.',
    legalBasis: isFirst ? `§10 ust. 4 ${RP_2015}` : `§11 ust. 3–4 ${RO_2016}`,
  });

  const hasIprz = record.iprz.trim().length > 0;
  if (isFirst) {
    const ok = !(hasIprz && negative);
    items.push({
      id: 'DEVELOPMENT_ONLY_IF_POSITIVE',
      ok,
      message: ok
        ? 'Wnioski dotyczące rozwoju zawodowego są opcjonalne i dopuszczalne tylko przy ocenie pozytywnej.'
        : 'Ocena jest negatywna: usuń wnioski dotyczące rozwoju zawodowego (dopuszczalne tylko przy ocenie pozytywnej).',
      legalBasis: `§10 ust. 5–6 ${RP_2015}`,
    });
  } else {
    items.push({
      id: 'IPRZ_REQUIRED',
      ok: hasIprz,
      message: hasIprz
        ? 'Wnioski dotyczące indywidualnego programu rozwoju zawodowego są wpisane.'
        : 'Wpisz wnioski do IPRZ: są wymagane niezależnie od wyniku oceny.',
      legalBasis: `§11 ust. 1 pkt 5 ${RO_2016}; art. 108 ${USC}`,
    });
    items.push(promotionRequestCheck(record, evaluation));
  }

  return items;
}
