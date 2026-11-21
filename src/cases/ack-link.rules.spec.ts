import {
  ackLinkOf,
  ackTokenExpired,
  ackTokenExpiresOn,
  ackTokenMatches,
  newAckToken,
} from './ack-link.rules.js';
import { applyAction } from './actions.rules.js';
import type { CaseRecord } from './case.types.js';
import { buildSeed } from './seed/seed.data.js';

const TODAY = '2026-11-21';
const signed = (): CaseRecord =>
  buildSeed(TODAY).find((c) => c.id === 'c-101')!;

describe('ack link rules', () => {
  it('tokens are 32 random bytes in base64url', () => {
    const a = newAckToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newAckToken()).not.toBe(a);
  });

  it('is valid 14 days, through the last day', () => {
    expect(ackTokenExpiresOn(TODAY)).toBe('2026-12-05');
    const r = { ...signed(), ackTokenExpiresOn: '2026-12-05' };
    expect(ackTokenExpired(r, '2026-12-05')).toBe(false);
    expect(ackTokenExpired(r, '2026-12-06')).toBe(true);
  });

  it('compares tokens exactly', () => {
    expect(ackTokenMatches('abc', 'abc')).toBe(true);
    expect(ackTokenMatches('abc', 'abd')).toBe(false);
    expect(ackTokenMatches('abc', 'abcd')).toBe(false);
    expect(ackTokenMatches(null, '')).toBe(false);
  });

  it('SEND_FOR_ACK again replaces the token while not acknowledged', () => {
    const first = applyAction(signed(), 'SEND_FOR_ACK', TODAY);
    const second = applyAction(first, 'SEND_FOR_ACK', TODAY);
    expect(second.ackToken).not.toBe(first.ackToken);
    expect(second.sentForAckOn).toBe(first.sentForAckOn);
    expect(second.history.at(-1)!.text).toContain('Poprzedni link');
    expect(ackLinkOf(second)).toBe(`/zapoznanie/${second.ackToken}`);

    const acked = applyAction(second, 'EMPLOYEE_ACK_ASSESSMENT', TODAY);
    expect(ackLinkOf(acked)).toBeNull();
    expect(() => applyAction(acked, 'SEND_FOR_ACK', TODAY)).toThrow(
      'Ocena jest zakończona',
    );
  });
});
