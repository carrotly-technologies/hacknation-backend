import {
  DEFAULT_BODY_LIMIT,
  DEFAULT_TRUST_PROXY,
  readBodyLimit,
  readRateLimits,
  readTrustProxy,
} from './security.config.js';

const env = (values: Record<string, string | undefined>) => ({
  get: <T>(name: string) => values[name] as T,
});

describe('security config', () => {
  it('defaults: 100/min, 5 sign-ins/min, 1mb, private-network proxies', () => {
    expect(readRateLimits(env({}))).toEqual({
      perMinute: 100,
      loginPerMinute: 5,
    });
    expect(readBodyLimit(env({}))).toBe(DEFAULT_BODY_LIMIT);
    expect(readTrustProxy(env({}))).toBe(DEFAULT_TRUST_PROXY);
  });

  it('reads the limits from the environment', () => {
    expect(
      readRateLimits(
        env({
          RATE_LIMIT_PER_MINUTE: '300',
          RATE_LIMIT_LOGIN_PER_MINUTE: ' 20 ',
        }),
      ),
    ).toEqual({ perMinute: 300, loginPerMinute: 20 });
    expect(readRateLimits(env({ RATE_LIMIT_PER_MINUTE: '' })).perMinute).toBe(
      100,
    );
  });

  it.each(['0', '-1', '1.5', 'dużo'])(
    'stops at startup on a wrong limit (%s)',
    (value) => {
      expect(() =>
        readRateLimits(env({ RATE_LIMIT_LOGIN_PER_MINUTE: value })),
      ).toThrow(/RATE_LIMIT_LOGIN_PER_MINUTE musi być dodatnią liczbą/);
    },
  );

  it('reads BODY_LIMIT and refuses nonsense', () => {
    expect(readBodyLimit(env({ BODY_LIMIT: '500kb' }))).toBe('500kb');
    expect(() => readBodyLimit(env({ BODY_LIMIT: 'duży' }))).toThrow(
      /BODY_LIMIT/,
    );
  });

  it.each([
    ['true', true],
    ['FALSE', false],
    ['1', 1],
    ['10.0.0.0/8', '10.0.0.0/8'],
  ] as const)('TRUST_PROXY=%s', (value, expected) => {
    expect(readTrustProxy(env({ TRUST_PROXY: value }))).toBe(expected);
  });
});
