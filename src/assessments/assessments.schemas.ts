import { z } from 'zod';
import { SHEET_IDS } from '../sheets/sheet.types.js';

// Zod's own messages (wrong type, missing field, ...) in Polish.
z.config(z.locales.pl());

const sheetId = z.enum(SHEET_IDS, {
  error: 'sheetId musi mieć jedną z wartości: A, B, C, FIRST.',
});

const indicatorPoints = z
  .union(
    [1, 3, 5, 7, 9].map((p) => z.literal(p)),
    {
      error:
        'Ocena wskaźnika musi wynosić 1, 3, 5, 7 lub 9 pkt albo null (brak podstaw do oceny).',
    },
  )
  .nullable();

export const suggestLevelSchema = z.strictObject({
  sheetId,
  competencyId: z.string().min(1),
  indicatorRatings: z.array(
    z.strictObject({
      indicatorId: z.string().min(1),
      points: indicatorPoints,
    }),
  ),
});
export type SuggestLevelRequest = z.infer<typeof suggestLevelSchema>;

export const evaluateSchema = z.strictObject({
  sheetId,
  scores: z.array(
    z.strictObject({
      criterionId: z.string().min(1),
      points: z.number(),
    }),
  ),
  firstAssessment: z
    .strictObject({
      examPassed: z.enum(['YES', 'NO', 'NOT_APPLICABLE'], {
        error:
          'examPassed musi mieć jedną z wartości: YES, NO, NOT_APPLICABLE.',
      }),
      reportSubmittedOnTime: z.boolean(),
    })
    .optional(),
});
export type EvaluateRequest = z.infer<typeof evaluateSchema>;
