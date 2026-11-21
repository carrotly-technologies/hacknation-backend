import { z } from 'zod';
import { GRADE_IDS } from '../civil-service-grades/data/grades.data.js';
import { SHEET_IDS } from '../sheets/sheet.types.js';
import { CASE_ACTIONS } from './case.types.js';
import { isIsoDate } from './dates.js';

// Zod's own messages in Polish (also set in assessments.schemas.ts).
z.config(z.locales.pl());

const isoDate = z
  .string()
  .refine(isIsoDate, { error: 'Data musi mieć format RRRR-MM-DD.' });

const ratingPoints = z
  .union(
    [1, 3, 5, 7, 9].map((p) => z.literal(p)),
    {
      error:
        'Ocena wskaźnika musi wynosić 1, 3, 5, 7 lub 9 pkt albo null (brak podstaw do oceny).',
    },
  )
  .nullable();

const grade = (what: string) =>
  z
    .enum(GRADE_IDS, {
      error: `${what} musi być jednym ze stopni służbowych: ${GRADE_IDS.join(', ')} (GET /api/civil-service-grades).`,
    })
    .nullable()
    .optional();

/** Longest motivation of the request in part III. */
const MOTIVATION_MAX = 4000;

/**
 * PATCH /cases/:id. Objects are merged one level deep (keys given replace
 * keys stored); ratings are merged per indicator. In `decisions` and
 * `deviationNotes` a null value removes the key. Dates confirmed by actions
 * (confirmedByEvaluatorOn, acknowledgedByEmployeeOn, reportSubmittedOn) are
 * set by actions only and ignored here.
 */
export const patchCaseSchema = z.object({
  sheetId: z
    .enum(SHEET_IDS, {
      error: 'sheetId musi mieć jedną z wartości: A, B, C, FIRST.',
    })
    .optional(),
  partI: z
    .object({
      additionalCriteria: z.array(z.string().min(1)).optional(),
      assessmentDue: isoDate.nullable().optional(),
      topics: z
        .object({
          duties: z.string(),
          criteria: z.string(),
          expectations: z.string(),
          goals: z.string(),
        })
        .partial()
        .optional(),
      expectations: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
  ratings: z.record(z.string(), z.record(z.string(), ratingPoints)).optional(),
  decisions: z.record(z.string(), z.number().nullable()).optional(),
  deviationNotes: z.record(z.string(), z.string().nullable()).optional(),
  justification: z.string().optional(),
  iprz: z.string().optional(),
  /** Part II item 10 of the sheet; null clears it. */
  previousAssessment: z
    .object({
      result: z
        .enum(['POSITIVE', 'NEGATIVE'], {
          error:
            'Wynik poprzedniej oceny musi mieć wartość POSITIVE, NEGATIVE albo null.',
        })
        .nullable(),
      level: z.string().max(100).nullable(),
      date: isoDate.nullable(),
    })
    .partial()
    .nullable()
    .optional(),
  /** Part II item 11 and part III of the sheet. */
  promotionRequest: z
    .object({
      attached: z
        .enum(['YES', 'NO', 'NOT_APPLICABLE'], {
          error:
            'attached musi mieć jedną z wartości: YES, NO, NOT_APPLICABLE albo null.',
        })
        .nullable(),
      appointedYear: z
        .number({ error: 'Rok mianowania musi być liczbą (rrrr).' })
        .int({ error: 'Rok mianowania musi być liczbą całkowitą (rrrr).' })
        .min(1000, { error: 'Rok mianowania musi mieć 4 cyfry (rrrr).' })
        .max(9999, { error: 'Rok mianowania musi mieć 4 cyfry (rrrr).' })
        .nullable(),
      currentGrade: grade('Posiadany stopień służbowy'),
      gradeGrantedOn: isoDate.nullable(),
      requestedGrade: grade('Wnioskowany stopień służbowy'),
      motivation: z.string().max(MOTIVATION_MAX, {
        error: `Umotywowanie wniosku może mieć najwyżej ${MOTIVATION_MAX} znaków.`,
      }),
    })
    .partial()
    .optional(),
  firstConditions: z
    .object({
      examPassed: z
        .enum(['YES', 'NO', 'NOT_APPLICABLE'], {
          error:
            'examPassed musi mieć jedną z wartości: YES, NO, NOT_APPLICABLE albo null.',
        })
        .nullable()
        .optional(),
      reportDue: isoDate.nullable().optional(),
    })
    .optional(),
});
export type PatchCase = z.infer<typeof patchCaseSchema>;

export const observationSchema = z.object({
  date: isoDate,
  criterionId: z.string().min(1),
  indicatorId: z.string().min(1).nullable(),
  kind: z.enum(['STRENGTH', 'DEVELOPMENT'], {
    error:
      'kind musi mieć wartość STRENGTH (mocna strona) albo DEVELOPMENT (do rozwoju).',
  }),
  situation: z.string().trim().min(1, { error: 'Opisz sytuację (S).' }),
  action: z.string().trim(),
  result: z.string().trim(),
});
export type ObservationInput = z.infer<typeof observationSchema>;

export const actionSchema = z.object({
  action: z.enum(CASE_ACTIONS as [string, ...string[]], {
    error: `action musi mieć jedną z wartości: ${CASE_ACTIONS.join(', ')}.`,
  }),
  /** RECORD_ASSESSMENT_TALK only: the day of the talk (today when missing). */
  date: isoDate.optional(),
});
export type ActionInput = z.infer<typeof actionSchema>;

export const remindersSchema = z.object({
  caseIds: z
    .array(z.string().min(1))
    .min(1, { error: 'Podaj co najmniej jedną sprawę.' }),
});
export type RemindersInput = z.infer<typeof remindersSchema>;
