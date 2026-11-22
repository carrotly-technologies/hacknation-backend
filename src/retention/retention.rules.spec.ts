import { ConfigService } from '@nestjs/config';
import { CaseStore } from '../cases/case-store.service.js';
import type { CaseRecord } from '../cases/case.types.js';
import {
  ANONYMIZED_HISTORY_TEXT,
  anonymizeCase,
  caseEndedOn,
  isAnonymized,
  isPastRetention,
  parseRetentionYears,
  retentionCutoff,
} from './retention.rules.js';

const seed = () =>
  new CaseStore(new ConfigService({ DEMO_TODAY: '2026-11-21' })).all();
const acknowledged = (path: CaseRecord['path']) => {
  const record = seed().find((c) => c.acknowledgedOn && c.path === path);
  if (!record) throw new Error(`no acknowledged ${path} case in the seed`);
  return record;
};

describe('retention rules', () => {
  it('RETENTION_YEARS defaults to 10 and accepts whole years only', () => {
    expect(parseRetentionYears(undefined)).toBe(10);
    expect(parseRetentionYears(' ')).toBe(10);
    expect(parseRetentionYears('0')).toBe(0);
    expect(parseRetentionYears('5')).toBe(5);
    expect(() => parseRetentionYears('-1')).toThrow(/RETENTION_YEARS/);
    expect(() => parseRetentionYears('2.5')).toThrow(/RETENTION_YEARS/);
    expect(() => parseRetentionYears('dziesięć')).toThrow(/RETENTION_YEARS/);
  });

  it('the cutoff is the same day RETENTION_YEARS earlier', () => {
    expect(retentionCutoff('2026-11-21', 10)).toBe('2016-11-21');
    expect(retentionCutoff('2028-02-29', 1)).toBe('2027-02-28');
    expect(retentionCutoff('2026-11-21', 0)).toBe('2026-11-21');
  });

  it('a periodic case ends with the objection term, a first one at the acknowledgement', () => {
    const periodic = acknowledged('PERIODIC');
    expect(caseEndedOn(periodic)! > periodic.acknowledgedOn!).toBe(true);
    expect(caseEndedOn({ ...periodic, acknowledgedOn: null })).toBeNull();
    const first = {
      ...periodic,
      path: 'FIRST' as const,
      acknowledgedOn: '2015-03-02',
    };
    expect(caseEndedOn(first)).toBe('2015-03-02');
  });

  it('only cases that ended before the cutoff are past retention', () => {
    const record = acknowledged('PERIODIC');
    const old = { ...record, acknowledgedOn: '2016-01-04' };
    expect(isPastRetention(old, '2016-11-21')).toBe(true);
    expect(isPastRetention(record, '2016-11-21')).toBe(false);
    expect(
      isPastRetention({ ...old, acknowledgedOn: null }, '2030-01-01'),
    ).toBe(false);
    expect(
      isPastRetention(anonymizeCase(old, '2026-11-21'), '2016-11-21'),
    ).toBe(false);
  });

  it('anonymizes the person and every free text, keeping scores and dates', () => {
    const record: CaseRecord = {
      ...acknowledged('PERIODIC'),
      justification: 'Uzasadnienie o ocenianym',
      iprz: 'Plan rozwoju',
      deviationNotes: { komunikacja: 'Notatka' },
      objection: { text: 'Treść sprzeciwu', submittedOn: '2026-11-01' },
    };
    const anon = anonymizeCase(record, '2026-11-21');
    expect(isAnonymized(anon)).toBe(true);
    expect(anon.person).toMatchObject({
      id: `anon-${record.id}`,
      firstName: 'Osoba',
      lastName: 'zanonimizowana',
      position: '',
      unit: '',
    });
    expect(anon).toMatchObject({
      observations: [],
      deviationNotes: {},
      justification: '',
      iprz: '',
      objection: { text: '', submittedOn: '2026-11-01' },
      ackToken: null,
      history: [{ date: '2026-11-21', text: ANONYMIZED_HISTORY_TEXT }],
    });
    expect(anon.partI.topics).toEqual({
      duties: '',
      criteria: '',
      expectations: '',
      goals: '',
    });
    expect(anon.promotionRequest.motivation).toBe('');
    const text = JSON.stringify(anon);
    for (const value of [
      record.person.firstName,
      record.person.lastName,
      'Uzasadnienie o ocenianym',
      'Treść sprzeciwu',
    ]) {
      expect(text).not.toContain(value);
    }
    // Kept for statistics and the stage rules.
    expect(anon.decisions).toEqual(record.decisions);
    expect(anon.ratings).toEqual(record.ratings);
    expect(anon.acknowledgedOn).toBe(record.acknowledgedOn);
    expect(anon.completedOn).toEqual(record.completedOn);
    expect(anon.evaluatorId).toBe(record.evaluatorId);
  });
});
