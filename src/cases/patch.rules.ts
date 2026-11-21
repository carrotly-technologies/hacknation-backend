import { listPoints, RO_2016 } from '../assessments/assessment.format.js';
import {
  allDecided,
  caseCriteria,
  criterionName,
  effectiveStage,
  findCompetency,
  sheetOf,
  STAGE_NAMES,
} from './case.rules.js';
import { CaseRuleError, CaseValidationError } from './case-rule.error.js';
import type {
  CaseRecord,
  Observation,
  RatingPoints,
  StageId,
} from './case.types.js';
import type { ObservationInput, PatchCase } from './cases.schemas.js';
import { formatDatePl } from './dates.js';

const PART_II: readonly StageId[] = [
  'ASSESSMENT',
  'JUSTIFICATION',
  'FIRST_ASSESSMENT',
  'FIRST_CONDITIONS',
];
const LOCKED_NOTE =
  'Zmiana zablokowanego pola jest możliwa tylko w trybie korekty błędów przez administratora.';

function partIIGuard(record: CaseRecord, field: string): void {
  const stage = effectiveStage(record);
  if (PART_II.includes(stage)) return;
  if (record.signedByEvaluatorOn) {
    throw new CaseRuleError(
      `Pole „${field}” jest zablokowane: ocenę zatwierdzono ${formatDatePl(record.signedByEvaluatorOn)}. ${LOCKED_NOTE}`,
    );
  }
  throw new CaseRuleError(
    `Pole „${field}” wypełnia się na etapie rozmowy oceniającej i oceny; sprawa jest na etapie „${STAGE_NAMES[stage]}”. ${record.path === 'PERIODIC' ? 'Rozpocznij ocenę akcją „Rozpocznij rozmowę oceniającą”.' : 'Etap otwiera złożenie sprawozdania albo upływ terminu na jego złożenie.'}`,
  );
}

/**
 * Applies PATCH /cases/:id: checks which parts are editable at the current
 * stage (CaseRuleError -> 409) and validates values (CaseValidationError ->
 * 400). Returns the updated copy.
 */
export function applyPatch(
  record: CaseRecord,
  patch: PatchCase,
  today: string,
): CaseRecord {
  const next = structuredClone(record);
  const stage = effectiveStage(record);
  const errors: string[] = [];
  const partIOpen =
    record.path === 'PERIODIC' &&
    (stage === 'OSP_ANALYSIS' ||
      stage === 'SHEET_PROPOSAL' ||
      (stage === 'OPENING_TALK' && !record.partI.confirmedByEvaluatorOn));

  if (patch.sheetId !== undefined && patch.sheetId !== record.sheetId) {
    if (record.path === 'FIRST' || patch.sheetId === 'FIRST') {
      errors.push(
        record.path === 'FIRST'
          ? 'Pierwsza ocena zawsze używa arkusza pierwszej oceny (FIRST).'
          : 'Arkusz pierwszej oceny (FIRST) nie dotyczy oceny okresowej: wybierz A, B albo C.',
      );
    } else if (!partIOpen) {
      throw new CaseRuleError(
        `Arkusza nie można już zmienić: część I zatwierdzono${record.partI.confirmedByEvaluatorOn ? ` ${formatDatePl(record.partI.confirmedByEvaluatorOn)}` : ''}. ${LOCKED_NOTE}`,
      );
    } else {
      next.sheetId = patch.sheetId;
    }
  }

  if (patch.partI) {
    if (record.path === 'FIRST') {
      throw new CaseRuleError(
        'Pierwsza ocena nie ma części I z kryteriami dodatkowymi i terminem oceny (rozp. PRM z 23.07.2015).',
      );
    }
    if (!partIOpen) {
      throw new CaseRuleError(
        `Część I jest zablokowana: oceniający zatwierdził ją ${formatDatePl(record.partI.confirmedByEvaluatorOn!)}. ${LOCKED_NOTE}`,
      );
    }
    const { additionalCriteria, assessmentDue, topics, expectations } =
      patch.partI;
    if (additionalCriteria !== undefined) {
      next.partI.additionalCriteria = additionalCriteria;
    }
    if (assessmentDue !== undefined) {
      if (assessmentDue !== null && assessmentDue <= today) {
        errors.push(
          'Termin sporządzenia oceny musi przypadać po dniu dzisiejszym.',
        );
      }
      next.partI.assessmentDue = assessmentDue;
    }
    if (topics) next.partI.topics = { ...next.partI.topics, ...topics };
    if (expectations) {
      for (const id of Object.keys(expectations)) {
        if (!findCompetency(id))
          errors.push(`Nieznane kryterium „${id}” w oczekiwaniach.`);
      }
      next.partI.expectations = { ...next.partI.expectations, ...expectations };
    }
  }

  // Additional criteria vs the (possibly new) sheet.
  if (
    patch.partI?.additionalCriteria !== undefined ||
    patch.sheetId !== undefined
  ) {
    const sheet = sheetOf(next);
    const list = next.partI.additionalCriteria;
    if (list.length > 3) {
      errors.push(
        `Można wybrać najwyżej 3 kryteria dodatkowe (podano ${list.length}; §2 ust. 2 ${RO_2016}).`,
      );
    }
    const seen = new Set<string>();
    for (const id of list) {
      if (!findCompetency(id)) errors.push(`Nieznane kryterium „${id}”.`);
      else if (seen.has(id))
        errors.push(`Kryterium „${criterionName(id)}” podano więcej niż raz.`);
      else if (sheet?.mandatoryCriteria.includes(id)) {
        errors.push(
          `Kryterium „${criterionName(id)}” jest obowiązkowe w arkuszu ${sheet.id}, więc nie może być kryterium dodatkowym.`,
        );
      }
      seen.add(id);
    }
  }

  const criteria = new Set(caseCriteria(next));
  const unknownCriterion = (id: string) =>
    `Kryterium „${criterionName(id)}” nie jest oceniane w tej sprawie (kryteria z części I: ${[...criteria].map((c) => `„${criterionName(c)}”`).join(', ')}).`;

  if (patch.ratings) {
    partIIGuard(record, 'ratings');
    for (const [criterionId, indicators] of Object.entries(patch.ratings)) {
      if (!criteria.has(criterionId)) {
        errors.push(unknownCriterion(criterionId));
        continue;
      }
      const known = new Set(
        findCompetency(criterionId)!.indicators.map((i) => i.id),
      );
      for (const indicatorId of Object.keys(indicators)) {
        if (!known.has(indicatorId)) {
          errors.push(
            `Wskaźnik „${indicatorId}” nie należy do kryterium „${criterionName(criterionId)}”.`,
          );
        }
      }
      next.ratings[criterionId] = {
        ...next.ratings[criterionId],
        ...(indicators as Record<string, RatingPoints | null>),
      };
    }
  }

  if (patch.decisions) {
    partIIGuard(record, 'decisions');
    const scale = sheetOf(next)?.scale ?? [];
    for (const [criterionId, points] of Object.entries(patch.decisions)) {
      if (points === null) {
        delete next.decisions[criterionId];
        continue;
      }
      if (!criteria.has(criterionId))
        errors.push(unknownCriterion(criterionId));
      else if (!scale.includes(points)) {
        errors.push(
          `Ocena cząstkowa kryterium „${criterionName(criterionId)}” musi wynosić ${listPoints(scale)} pkt (podano ${points}).`,
        );
      } else next.decisions[criterionId] = points;
    }
  }

  if (patch.deviationNotes) {
    partIIGuard(record, 'deviationNotes');
    for (const [criterionId, note] of Object.entries(patch.deviationNotes)) {
      if (note === null) delete next.deviationNotes[criterionId];
      else if (!criteria.has(criterionId))
        errors.push(unknownCriterion(criterionId));
      else next.deviationNotes[criterionId] = note;
    }
  }

  if (patch.justification !== undefined) {
    partIIGuard(record, 'justification');
    next.justification = patch.justification;
  }
  if (patch.iprz !== undefined) {
    partIIGuard(record, 'iprz');
    next.iprz = patch.iprz;
  }

  if (patch.firstConditions) {
    if (record.path !== 'FIRST') {
      throw new CaseRuleError(
        'Warunki pierwszej oceny (egzamin, sprawozdanie) dotyczą tylko pierwszej oceny.',
      );
    }
    if (record.signedByEvaluatorOn) {
      throw new CaseRuleError(
        `Warunki pierwszej oceny są zablokowane: ocenę zatwierdzono ${formatDatePl(record.signedByEvaluatorOn)}. ${LOCKED_NOTE}`,
      );
    }
    const conditions = next.firstConditions ?? {
      examPassed: null,
      reportSubmittedOn: null,
      reportDue: null,
    };
    const { examPassed, reportDue } = patch.firstConditions;
    if (examPassed !== undefined) conditions.examPassed = examPassed;
    if (reportDue !== undefined) {
      if (stage !== 'INTRO_TALK' && stage !== 'REPORT') {
        throw new CaseRuleError(
          'Termin na złożenie sprawozdania można zmienić tylko przed jego złożeniem (§5 rozp. PRM z 23.07.2015).',
        );
      }
      conditions.reportDue = reportDue;
    }
    next.firstConditions = conditions;
  }

  if (errors.length > 0) throw new CaseValidationError(errors);
  return syncPartII(next, today);
}

/** Records when every criterion got a decision (end of the ASSESSMENT stage). */
export function syncPartII(record: CaseRecord, today: string): CaseRecord {
  const key =
    record.stage === 'ASSESSMENT'
      ? 'ASSESSMENT'
      : record.stage === 'FIRST_ASSESSMENT'
        ? 'FIRST_ASSESSMENT'
        : null;
  if (!key) return record;
  if (allDecided(record)) record.completedOn[key] ??= today;
  else delete record.completedOn[key];
  return record;
}

/** Validates and adds an observation; returns the updated copy. */
export function addObservation(
  record: CaseRecord,
  input: ObservationInput,
  id: string,
  today: string,
): CaseRecord {
  const stage = effectiveStage(record);
  const open =
    !record.signedByEvaluatorOn &&
    (record.path === 'PERIODIC'
      ? record.partI.confirmedByEvaluatorOn !== null
      : stage !== 'INTRO_TALK');
  if (!open) {
    throw new CaseRuleError(
      record.signedByEvaluatorOn
        ? `Ocena została zatwierdzona ${formatDatePl(record.signedByEvaluatorOn)}; obserwacje dotyczą okresu oceny i nie można ich już dodawać.`
        : record.path === 'PERIODIC'
          ? 'Obserwacje zapisuje się w okresie oceny: najpierw zatwierdź część I (kryteria), aby było wiadomo, do których kryteriów je przypinać.'
          : 'Obserwacje zapisuje się po rozmowie wstępnej.',
    );
  }
  const errors: string[] = [];
  const criteria = caseCriteria(record);
  if (!criteria.includes(input.criterionId)) {
    errors.push(
      `Kryterium „${criterionName(input.criterionId)}” nie jest oceniane w tej sprawie.`,
    );
  } else if (
    input.indicatorId !== null &&
    !findCompetency(input.criterionId)!.indicators.some(
      (i) => i.id === input.indicatorId,
    )
  ) {
    errors.push(
      `Wskaźnik „${input.indicatorId}” nie należy do kryterium „${criterionName(input.criterionId)}”.`,
    );
  }
  if (input.date > today)
    errors.push('Data obserwacji nie może być z przyszłości.');
  if (errors.length > 0) throw new CaseValidationError(errors);

  const next = structuredClone(record);
  const observation: Observation = { id, ...input };
  next.observations.push(observation);
  next.observations.sort((a, b) => a.date.localeCompare(b.date));
  return next;
}
