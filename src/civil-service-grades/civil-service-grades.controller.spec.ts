import { CivilServiceGradesController } from './civil-service-grades.controller.js';

describe('CivilServiceGradesController', () => {
  it('returns the nine grades of art. 86 ust. 1, lowest first', () => {
    const { grades, legalBasis } = new CivilServiceGradesController().findAll();
    expect(grades).toHaveLength(9);
    expect(grades[0]).toEqual({ id: 'I', label: 'I stopień służbowy' });
    expect(grades.at(-1)?.id).toBe('IX');
    expect(legalBasis).toContain('art. 86 ust. 1');
  });
});
