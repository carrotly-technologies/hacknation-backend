import {
  AUDIT_ACTIONS,
  auditActionLabel,
  changedFieldsOf,
  describeRoute,
  routeKey,
} from './audit-actions.js';

describe('audit actions', () => {
  it('keys routes without the /api prefix', () => {
    expect(routeKey('post', '/api/cases/:id/actions')).toBe(
      'POST /cases/:id/actions',
    );
    expect(routeKey('PATCH', '/cases/:id')).toBe('PATCH /cases/:id');
  });

  it('names case actions from the body, only for known actions', () => {
    const spec = describeRoute('POST', '/api/cases/:id/actions');
    if (typeof spec !== 'object' || typeof spec.action !== 'function')
      throw new Error('expected a case action spec');
    expect(spec.action({ action: 'SEND_FOR_ACK' })).toBe(
      'CASE_ACTION:SEND_FOR_ACK',
    );
    expect(spec.action({ action: 'Jan Kowalski' })).toBe('CASE_ACTION');
    expect(spec.resourceId?.({ id: 'c-001' }, null)).toBe('c-001');
  });

  it('logs an unmapped mutating route generically and skips computations', () => {
    expect(describeRoute('POST', '/api/new/:id')).toEqual({
      action: 'HTTP:POST /new/:id',
      resourceType: null,
    });
    expect(describeRoute('POST', '/api/assessments/evaluate')).toBe('SKIP');
    expect(describeRoute('POST', '/api/auth/login')).toBe('EXPLICIT');
  });

  it('keeps field names only, never values, passwords or free-text keys', () => {
    expect(
      changedFieldsOf({
        ratings: { komunikacja: { 'komunikacja.1': 5 } },
        justification: 'Bardzo dobra praca.',
        password: 'x',
        'Jan Kowalski': 1,
      }),
    ).toEqual(['justification', 'ratings']);
    expect(changedFieldsOf(null)).toEqual([]);
    expect(changedFieldsOf(['a'])).toEqual([]);
  });

  it('has a Polish name for every listed action', () => {
    expect(AUDIT_ACTIONS.length).toBeGreaterThan(20);
    for (const { action, label } of AUDIT_ACTIONS) {
      expect(auditActionLabel(action)).toBe(label);
    }
    expect(auditActionLabel('CASE_ACTION:SEND_FOR_ACK')).toBe(
      'Akcja w ocenie: Przekaż do zapoznania',
    );
    expect(auditActionLabel('HTTP:POST /x')).toBe('Inna zmiana (POST /x)');
  });
});
