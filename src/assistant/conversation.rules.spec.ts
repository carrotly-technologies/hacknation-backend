import { describe, expect, it } from 'vitest';
import { toDetail } from '../cases/case-view.js';
import { buildSeed, EVALUATORS } from '../cases/seed/seed.data.js';
import { caseContext, conversationTemplate } from './conversation.rules.js';

const TODAY = '2026-11-21';
const record = buildSeed(TODAY).find((c) => c.id === 'c-007')!;
const detail = toDetail(record, TODAY, EVALUATORS[0], 'Urząd (demo)');

describe('stage names in the assistant text', () => {
  it('uses the Polish stage name, never the API enum', () => {
    const context = caseContext(detail, 'ASSESSMENT_TALK');
    expect(context).toContain('etap: Rozmowa oceniająca');
    expect(context).not.toContain('ASSESSMENT_TALK');
    const template = conversationTemplate(detail, 'ASSESSMENT_TALK');
    expect(template).toContain('etap: rozmowa oceniająca');
    expect(template).not.toContain('ASSESSMENT_TALK');
  });
});
