import { observationErrors } from './journal.rules.js';

const valid = {
  date: '2026-11-20',
  criterionId: 'komunikacja',
  indicatorId: 'komunikacja.1',
  kind: 'STRENGTH' as const,
  situation: 'S',
  action: 'D',
  result: 'R',
};

describe('observationErrors', () => {
  it('accepts any criterion of the model, with or without an indicator', () => {
    expect(observationErrors(valid, '2026-11-21')).toEqual([]);
    expect(
      observationErrors({ ...valid, indicatorId: null }, '2026-11-21'),
    ).toEqual([]);
    expect(
      observationErrors({ ...valid, date: '2026-11-21' }, '2026-11-21'),
    ).toEqual([]);
  });

  it('rejects an unknown criterion', () => {
    expect(
      observationErrors({ ...valid, criterionId: 'nie-ma' }, '2026-11-21'),
    ).toEqual(['Kryterium „nie-ma” nie istnieje w modelu kompetencji.']);
  });

  it('rejects an indicator of another criterion', () => {
    const [error] = observationErrors(
      { ...valid, indicatorId: 'rzetelnosc.1' },
      '2026-11-21',
    );
    expect(error).toMatch(/Wskaźnik „rzetelnosc\.1” nie należy do kryterium/);
  });

  it('rejects a date after today', () => {
    expect(
      observationErrors({ ...valid, date: '2026-11-22' }, '2026-11-21'),
    ).toEqual(['Data obserwacji nie może być z przyszłości.']);
  });
});
