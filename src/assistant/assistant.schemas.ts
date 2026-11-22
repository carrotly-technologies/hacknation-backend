import { z } from 'zod';
import { FIRST_STAGES, PERIODIC_STAGES } from '../cases/case.types.js';
import { HISTORY_FIELD_MAX, MAX_HISTORY } from './followup.rules.js';

export const STAGE_IDS = [...PERIODIC_STAGES, ...FIRST_STAGES] as const;

/** Longer text is cut, not rejected: the chat may send a long earlier answer. */
const historyText = z
  .string()
  .trim()
  .transform((s) => s.slice(0, HISTORY_FIELD_MAX));

export const historySchema = z
  .array(z.strictObject({ question: historyText, answer: historyText }))
  .max(50)
  // Only the last exchanges are used; empty questions are dropped.
  .transform((h) => h.filter((x) => x.question).slice(-MAX_HISTORY));
export type ChatHistory = z.infer<typeof historySchema>;

export const askSchema = z.strictObject({
  question: z.string().trim().min(3).max(2000),
  /**
   * Deprecated and ignored: there is one assistant now. Still accepted (and
   * validated) so that older clients keep working.
   */
  assistant: z.enum(['FORMAL', 'CONVERSATION']).optional(),
  caseId: z.string().min(1).optional(),
  stageId: z.enum(STAGE_IDS).optional(),
  /** Earlier exchanges of the same chat, oldest first; never stored or logged. */
  history: historySchema.optional(),
});
export type AskInput = z.infer<typeof askSchema>;

export const suggestionsQuerySchema = z.enum(STAGE_IDS).optional();
