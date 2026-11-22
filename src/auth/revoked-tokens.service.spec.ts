import { RevokedTokens } from './revoked-tokens.service.js';

describe('RevokedTokens', () => {
  afterEach(() => vi.useRealTimers());

  it('refuses a signed-out token until it would have expired', () => {
    vi.useFakeTimers({ now: new Date('2026-11-21T10:00:00Z') });
    const revoked = new RevokedTokens();
    const exp = Date.now() / 1000 + 3600;
    revoked.revoke('a', exp);
    expect(revoked.isRevoked('a')).toBe(true);
    expect(revoked.isRevoked('b')).toBe(false);
    vi.advanceTimersByTime(3600 * 1000);
    expect(revoked.isRevoked('a')).toBe(false);
  });

  it('drops expired entries as new ones come', () => {
    vi.useFakeTimers({ now: new Date('2026-11-21T10:00:00Z') });
    const revoked = new RevokedTokens();
    revoked.revoke('old', Date.now() / 1000 + 1);
    vi.advanceTimersByTime(2000);
    revoked.revoke('new', Date.now() / 1000 + 60);
    expect(
      (revoked as unknown as { revoked: Map<string, number> }).revoked.size,
    ).toBe(1);
  });
});
