import { displayName, RO_2016 } from '../assessments/assessment.format.js';
import type { EvaluateResult } from '../assessments/evaluate.rules.js';
import {
  GRADE_IDS,
  type GradeId,
} from '../civil-service-grades/data/grades.data.js';
import { COMPETENCY_MODEL } from '../competency-model/data/model.data.js';
import type {
  CaseRecord,
  Employment,
  FormalCheckItem,
  PreviousAssessment,
  PromotionRequest,
} from './case.types.js';
import type { PatchCase } from './cases.schemas.js';
import { USC } from './deadlines.rules.js';

/**
 * Part II items 10–11 and part III of sheets A, B, C: the previous periodic
 * assessment, the question whether a request for the next civil-service grade
 * is attached, and the request itself (art. 89 ust. 1 ustawy, §11 ust. 5 rozp.
 * PRM z 4.04.2016, footnote to part III of the templates).
 */

/** art. 89 ust. 1 ustawy: the next grade on a positive assessment with a motivated request. */
export const PROMOTION_LEGAL_BASIS = `§11 ust. 5 ${RO_2016}; art. 89 ust. 1 ${USC}`;

const PART_III_FIELDS = [
  'appointedYear',
  'currentGrade',
  'gradeGrantedOn',
  'requestedGrade',
  'motivation',
] as const;

const PART_III_LABELS: Record<(typeof PART_III_FIELDS)[number], string> = {
  appointedYear: 'rok mianowania',
  currentGrade: 'posiadany stopień służbowy',
  gradeGrantedOn: 'data przyznania stopnia służbowego',
  requestedGrade: 'wnioskowany stopień służbowy',
  motivation: 'umotywowanie wniosku',
};

/**
 * Starting value: a pracownik służby cywilnej is always "NIE DOTYCZY" (the
 * template's own wording of the third answer), an urzędnik has no answer yet.
 */
export function emptyPromotionRequest(
  employment: Employment,
): PromotionRequest {
  return {
    attached: employment === 'PRACOWNIK' ? 'NOT_APPLICABLE' : null,
    appointedYear: null,
    currentGrade: null,
    gradeGrantedOn: null,
    requestedGrade: null,
    motivation: '',
  };
}

/** The request as shown: NOT_APPLICABLE for a pracownik whatever is stored. */
export function promotionRequestOf(record: CaseRecord): PromotionRequest {
  if (record.person.employment === 'PRACOWNIK') {
    return emptyPromotionRequest('PRACOWNIK');
  }
  return record.promotionRequest;
}

/** "Kolejny stopień" of art. 89 ust. 1: the next grade on the list; null after the highest. */
export function nextGrade(id: string): GradeId | null {
  const index = GRADE_IDS.indexOf(id as GradeId);
  return index >= 0 && index < GRADE_IDS.length - 1
    ? GRADE_IDS[index + 1]
    : null;
}

/** Overall levels as the sheet writes them ("na poziomie oczekiwań"). */
export function previousLevelLabels(): string[] {
  return COMPETENCY_MODEL.scale.map((s) =>
    displayName(s.label).toLocaleLowerCase('pl-PL'),
  );
}

type PreviousPatch = NonNullable<PatchCase['previousAssessment']>;
type PromotionPatch = NonNullable<PatchCase['promotionRequest']>;

/** Merges the previous-assessment patch; pushes Polish messages to `errors`. */
export function mergePreviousAssessment(
  stored: PreviousAssessment | null,
  patch: PreviousPatch | null,
  today: string,
  errors: string[],
): PreviousAssessment | null {
  if (patch === null) return null;
  const next: PreviousAssessment = {
    ...(stored ?? { result: null, level: null, date: null }),
  };
  if (patch.result !== undefined) next.result = patch.result;
  if (patch.level !== undefined) {
    if (patch.level === null) next.level = null;
    else {
      const labels = previousLevelLabels();
      const level = patch.level.trim().toLocaleLowerCase('pl-PL');
      if (labels.includes(level)) next.level = level;
      else {
        errors.push(
          `Poziom poprzedniej oceny wybierz ze skali: ${labels.map((l) => `„${l}”`).join(', ')}.`,
        );
      }
    }
  }
  if (patch.date !== undefined) {
    if (patch.date !== null && patch.date > today) {
      errors.push(
        'Data sporządzenia poprzedniej oceny nie może być z przyszłości.',
      );
    } else next.date = patch.date;
  }
  return next;
}

/**
 * Merges the request patch. The answer depends on the employment (a
 * pracownik: only NOT_APPLICABLE; an urzędnik: YES or NO), YES needs a result
 * that is not negative, and part III fields exist only while the answer is YES.
 */
export function mergePromotionRequest(
  record: CaseRecord,
  patch: PromotionPatch,
  evaluation: EvaluateResult | null,
  today: string,
  errors: string[],
): PromotionRequest {
  const employee = record.person.employment === 'PRACOWNIK';
  const next: PromotionRequest = { ...promotionRequestOf(record) };

  if (patch.attached !== undefined) {
    if (employee && patch.attached !== 'NOT_APPLICABLE') {
      errors.push(
        'Oceniany jest pracownikiem służby cywilnej: odpowiedź na pytanie o wniosek o kolejny stopień służbowy to „NIE DOTYCZY”, a części III się nie dołącza. Stopnie służbowe przysługują urzędnikom służby cywilnej (art. 89 ust. 1 ustawy).',
      );
    } else if (!employee && patch.attached === 'NOT_APPLICABLE') {
      errors.push(
        '„NIE DOTYCZY” zaznacza się tylko, gdy oceniany jest pracownikiem służby cywilnej. Oceniany jest urzędnikiem służby cywilnej: wybierz TAK albo NIE.',
      );
    } else if (patch.attached === 'YES' && evaluation?.result === 'NEGATIVE') {
      errors.push(
        `Ocena jest negatywna: wniosek o przyznanie kolejnego stopnia służbowego można dołączyć tylko do oceny pozytywnej (${PROMOTION_LEGAL_BASIS}).`,
      );
    } else next.attached = patch.attached;
  }

  const given = PART_III_FIELDS.filter((key) => patch[key] !== undefined);
  if (given.length > 0 && next.attached !== 'YES') {
    errors.push(
      'Część III (wniosek o kolejny stopień służbowy) wypełnia się tylko, gdy do oceny dołączono wniosek: najpierw zaznacz odpowiedź TAK.',
    );
  }

  if (next.attached !== 'YES') {
    // The footnote to part III: not attached, so nothing of it is kept.
    return {
      ...emptyPromotionRequest(record.person.employment),
      attached: next.attached,
    };
  }

  if (patch.appointedYear !== undefined)
    next.appointedYear = patch.appointedYear;
  if (patch.currentGrade !== undefined) next.currentGrade = patch.currentGrade;
  if (patch.gradeGrantedOn !== undefined)
    next.gradeGrantedOn = patch.gradeGrantedOn;
  if (patch.requestedGrade !== undefined)
    next.requestedGrade = patch.requestedGrade;
  if (patch.motivation !== undefined) next.motivation = patch.motivation;

  const year = Number(today.slice(0, 4));
  if (next.appointedYear !== null && next.appointedYear > year) {
    errors.push(`Rok mianowania nie może być późniejszy niż ${year}.`);
  }
  if (next.gradeGrantedOn !== null) {
    if (next.gradeGrantedOn > today) {
      errors.push(
        'Data przyznania stopnia służbowego nie może być z przyszłości.',
      );
    } else if (
      next.appointedYear !== null &&
      Number(next.gradeGrantedOn.slice(0, 4)) < next.appointedYear
    ) {
      errors.push(
        `Stopień służbowy przyznaje się od dnia mianowania (art. 51 ust. 1 ${USC}), więc data jego przyznania nie może być wcześniejsza niż rok mianowania (${next.appointedYear}).`,
      );
    }
  }
  if (next.currentGrade !== null && next.requestedGrade !== null) {
    const expected = nextGrade(next.currentGrade);
    if (expected === null) {
      errors.push(
        `Stopień ${next.currentGrade} jest najwyższym stopniem służbowym: nie można wnioskować o kolejny.`,
      );
    } else if (next.requestedGrade !== expected) {
      errors.push(
        `Wniosek dotyczy kolejnego stopnia służbowego (art. 89 ust. 1 ${USC}): po stopniu ${next.currentGrade} jest stopień ${expected}.`,
      );
    }
  }
  return next;
}

/** Formal-check item of the periodic sheet: the question answered, part III complete. */
export function promotionRequestCheck(
  record: CaseRecord,
  evaluation: EvaluateResult | null,
): FormalCheckItem {
  const request = promotionRequestOf(record);
  const item = (ok: boolean, message: string): FormalCheckItem => ({
    id: 'PROMOTION_REQUEST',
    ok,
    message,
    legalBasis: PROMOTION_LEGAL_BASIS,
  });
  switch (request.attached) {
    case 'NOT_APPLICABLE':
      return item(
        true,
        'Oceniany jest pracownikiem służby cywilnej: wniosek o kolejny stopień służbowy nie dotyczy, części III się nie dołącza.',
      );
    case 'NO':
      return item(
        true,
        'Do oceny nie dołączono wniosku o przyznanie kolejnego stopnia służbowego; części III się nie dołącza.',
      );
    case null:
      return item(
        false,
        'Zaznacz, czy do oceny dołączono wniosek o przyznanie kolejnego stopnia służbowego (TAK albo NIE).',
      );
    case 'YES': {
      if (evaluation?.result === 'NEGATIVE') {
        return item(
          false,
          'Ocena jest negatywna: wniosek o kolejny stopień służbowy można dołączyć tylko do oceny pozytywnej. Zmień odpowiedź na NIE.',
        );
      }
      const missing = PART_III_FIELDS.filter((key) =>
        key === 'motivation'
          ? request.motivation.trim() === ''
          : request[key] === null,
      );
      return missing.length > 0
        ? item(
            false,
            `Uzupełnij część III (wniosek o kolejny stopień służbowy): ${missing.map((k) => PART_III_LABELS[k]).join(', ')}.`,
          )
        : item(
            true,
            `Część III jest wypełniona: umotywowany wniosek o przyznanie stopnia ${request.requestedGrade}.`,
          );
    }
  }
}
