import {
  anonymousKeyDay,
  anonymousSessionKey,
  clientIp,
  groupSessions,
  maskPath,
  parseSessionId,
  retentionCutoff,
  shouldLogApiCall,
  timeOrderedId,
  tokenMatches,
} from './monitor.rules.js';
import type { RequestLogEntry } from './monitor.types.js';

const entry = (over: Partial<RequestLogEntry>): RequestLogEntry => ({
  id: 'e1',
  at: '2026-11-22T10:00:00.000Z',
  sessionId: '6f1c2a4e-1b2c-4d3e-8f90-123456789abc',
  kind: 'API',
  method: 'GET',
  path: '/api/me',
  status: 200,
  durationMs: 3,
  ip: '203.0.113.7',
  userAgent: 'UA',
  userId: null,
  userName: null,
  ...over,
});

describe('parseSessionId', () => {
  it('accepts a UUID (lower-cased), else null', () => {
    expect(parseSessionId('6F1C2A4E-1B2C-4D3E-8F90-123456789ABC')).toBe(
      '6f1c2a4e-1b2c-4d3e-8f90-123456789abc',
    );
    expect(parseSessionId('abc')).toBeNull();
    expect(parseSessionId(undefined)).toBeNull();
    expect(parseSessionId(['6f1c2a4e-1b2c-4d3e-8f90-123456789abc'])).toBe(
      '6f1c2a4e-1b2c-4d3e-8f90-123456789abc',
    );
  });
});

describe('clientIp', () => {
  it('takes the first X-Forwarded-For address, else the socket', () => {
    expect(clientIp('203.0.113.7, 10.0.0.1', '10.0.0.2')).toBe('203.0.113.7');
    expect(clientIp(undefined, '::ffff:127.0.0.1')).toBe('127.0.0.1');
    expect(clientIp('', '::1')).toBe('::1');
    expect(clientIp(undefined, undefined)).toBeNull();
  });
});

describe('shouldLogApiCall', () => {
  it('logs /api calls except the monitor, health, telemetry, Swagger and preflights', () => {
    expect(shouldLogApiCall('GET', '/api/cases?x=1')).toBe(true);
    expect(shouldLogApiCall('GET', '/api/swagger')).toBe(false);
    expect(shouldLogApiCall('GET', '/api/swagger.json')).toBe(false);
    expect(shouldLogApiCall('GET', '/api/swagger/swagger-ui.css')).toBe(false);
    expect(shouldLogApiCall('GET', '/api/monitor/sessions')).toBe(false);
    expect(shouldLogApiCall('GET', '/api/health')).toBe(false);
    expect(shouldLogApiCall('POST', '/api/telemetry/pageview')).toBe(false);
    expect(shouldLogApiCall('OPTIONS', '/api/cases')).toBe(false);
    expect(shouldLogApiCall('GET', '/favicon.ico')).toBe(false);
    expect(shouldLogApiCall('GET', '/api/monitoring')).toBe(true);
  });
});

describe('maskPath', () => {
  it('masks the ack token in API and frontend paths and caps the length', () => {
    expect(maskPath('/api/ack/abc123/objection')).toBe(
      '/api/ack/***/objection',
    );
    expect(maskPath('/zapoznanie/abc123?x=1')).toBe('/zapoznanie/***?x=1');
    expect(maskPath('/teczka/c-001')).toBe('/teczka/c-001');
    expect(maskPath('/logowanie/gov?code=abc&state=xyz&x=1')).toBe(
      '/logowanie/gov?code=***&state=***&x=1',
    );
    expect(maskPath('/api/x?PESEL=90010112345')).toBe('/api/x?PESEL=***');
    expect(maskPath(`/${'a'.repeat(600)}`)).toHaveLength(500);
  });
});

describe('retentionCutoff', () => {
  it('is 30 days before now', () => {
    expect(
      retentionCutoff(new Date('2026-11-30T12:00:00.000Z')).toISOString(),
    ).toBe('2026-10-31T12:00:00.000Z');
  });
});

describe('timeOrderedId', () => {
  it('is a UUIDv7 that sorts in the order of creation, also within one ms', () => {
    const ids = [
      timeOrderedId(1_000),
      timeOrderedId(1_000),
      timeOrderedId(1_001),
    ];
    expect(ids[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab]/);
    expect([...ids].sort()).toEqual(ids);
  });
});

describe('tokenMatches', () => {
  it('matches only the configured, non-empty token', () => {
    expect(tokenMatches('secret', 'secret')).toBe(true);
    expect(tokenMatches('secreT', 'secret')).toBe(false);
    expect(tokenMatches('secret-longer', 'secret')).toBe(false);
    expect(tokenMatches(undefined, 'secret')).toBe(false);
    expect(tokenMatches('', '')).toBe(false);
    expect(tokenMatches('x', undefined)).toBe(false);
  });
});

describe('anonymous sessions', () => {
  it('group calls without a session id by IP, browser and day', () => {
    const a = entry({ sessionId: null });
    const key = anonymousSessionKey(a);
    expect(key).toMatch(/^anon-2026-11-22-[0-9a-f]{12}$/);
    expect(anonymousKeyDay(key)).toBe('2026-11-22');
    expect(anonymousKeyDay('6f1c2a4e-1b2c-4d3e-8f90-123456789abc')).toBeNull();
    expect(anonymousSessionKey({ ...a, at: '2026-11-22T23:00:00.000Z' })).toBe(
      key,
    );
    expect(anonymousSessionKey({ ...a, ip: '198.51.100.1' })).not.toBe(key);
    expect(
      anonymousSessionKey({ ...a, at: '2026-11-23T00:00:00.000Z' }),
    ).not.toBe(key);
  });
});

describe('groupSessions', () => {
  const s1 = '11111111-1111-4111-8111-111111111111';
  const s2 = '22222222-2222-4222-8222-222222222222';
  const entries = [
    entry({
      id: 'a',
      sessionId: s1,
      at: '2026-11-22T10:00:00.000Z',
      kind: 'PAGEVIEW',
      method: null,
      status: null,
    }),
    entry({
      id: 'b',
      sessionId: s1,
      at: '2026-11-22T10:01:00.000Z',
      userId: 'u-1',
      userName: 'j.kowalska',
      status: 404,
    }),
    entry({
      id: 'c',
      sessionId: s2,
      at: '2026-11-22T11:00:00.000Z',
      ip: '198.51.100.9',
      userAgent: 'UA2',
      userId: 'u-2',
      userName: 'admin',
    }),
    entry({
      id: 'd',
      sessionId: s1,
      at: '2026-11-22T10:02:00.000Z',
      ip: '198.51.100.1',
      userAgent: 'UA-new',
      status: 500,
    }),
  ];

  it('summarizes each session, newest activity first', () => {
    const page = groupSessions(entries, { page: 1, pageSize: 50 });
    expect(page.total).toBe(2);
    expect(page.items.map((s) => s.sessionId)).toEqual([s2, s1]);
    expect(page.items[1]).toEqual({
      sessionId: s1,
      anonymous: false,
      users: [{ id: 'u-1', name: 'j.kowalska' }],
      ips: ['203.0.113.7', '198.51.100.1'],
      userAgent: 'UA-new',
      firstAt: '2026-11-22T10:00:00.000Z',
      lastAt: '2026-11-22T10:02:00.000Z',
      pageviews: 1,
      apiCalls: 2,
      errors: 2,
    });
  });

  it('filters by part of an IP or of an account and pages', () => {
    const ids = (f: { ip?: string; userId?: string }) =>
      groupSessions(entries, { ...f, page: 1, pageSize: 50 }).items.map(
        (s) => s.sessionId,
      );
    expect(ids({ ip: '198.51.100.1' })).toEqual([s1]);
    expect(ids({ userId: 'KOWAL' })).toEqual([s1]);
    expect(ids({ userId: 'u-2' })).toEqual([s2]);
    const second = groupSessions(entries, { page: 2, pageSize: 1 });
    expect(second.items.map((s) => s.sessionId)).toEqual([s1]);
    expect(second.total).toBe(2);
  });
});
