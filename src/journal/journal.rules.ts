import { criterionName, findCompetency } from '../cases/case.rules.js';
import type { ObservationFields } from './journal.types.js';

/**
 * Checks of an observation against the competency model and "today"
 * (DEMO_TODAY). Returns Polish messages; empty = valid. Unlike a case
 * observation, any criterion of the model is allowed: the journal is kept
 * before the case's criteria are chosen.
 */
export function observationErrors(
  input: ObservationFields,
  today: string,
): string[] {
  const errors: string[] = [];
  const competency = findCompetency(input.criterionId);
  if (!competency) {
    errors.push(
      `Kryterium „${input.criterionId}” nie istnieje w modelu kompetencji.`,
    );
  } else if (
    input.indicatorId !== null &&
    !competency.indicators.some((i) => i.id === input.indicatorId)
  ) {
    errors.push(
      `Wskaźnik „${input.indicatorId}” nie należy do kryterium „${criterionName(input.criterionId)}”.`,
    );
  }
  if (input.date > today)
    errors.push('Data obserwacji nie może być z przyszłości.');
  return errors;
}
