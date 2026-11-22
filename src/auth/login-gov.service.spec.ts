import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { isValidPesel } from './auth.schemas.js';
import {
  LOGIN_GOV_ARTIFACT_TTL_MS,
  LOGIN_GOV_MAX_PENDING,
  LOGIN_GOV_STATE_TTL_MS,
  LoginGovService,
} from './login-gov.service.js';
import { InMemoryUsersRepository } from './users.in-memory.repository.js';
import { USER_SEED } from './users.seed.js';

const KAMINSKA = '78031504123';

describe('LoginGovService', () => {
  let service: LoginGovService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new LoginGovService(new InMemoryUsersRepository());
  });
  afterEach(() => vi.useRealTimers());

  it('issues a 32-byte base64url state', () => {
    const { state } = service.start();
    expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(state, 'base64url')).toHaveLength(32);
    expect(service.start().state).not.toBe(state);
  });

  it('runs the flow once, then burns the artifact', async () => {
    const { state } = service.start();
    const artifact = service.mockAuthorize(state, KAMINSKA, 'mobywatel');
    await expect(service.exchange(artifact, state)).resolves.toMatchObject({
      id: 'u-kaminska',
    });
    await expect(service.exchange(artifact, state)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('gives one artifact per state', () => {
    const { state } = service.start();
    service.mockAuthorize(state, KAMINSKA, 'bank');
    expect(() => service.mockAuthorize(state, KAMINSKA, 'bank')).toThrow(
      BadRequestException,
    );
  });

  it('expires the artifact after 60 s and the state after 5 min', async () => {
    const { state } = service.start();
    const artifact = service.mockAuthorize(state, KAMINSKA, 'bank');
    vi.advanceTimersByTime(LOGIN_GOV_ARTIFACT_TTL_MS);
    await expect(service.exchange(artifact, state)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    vi.advanceTimersByTime(LOGIN_GOV_STATE_TTL_MS);
    expect(() => service.mockAuthorize(state, KAMINSKA, 'bank')).toThrow(
      BadRequestException,
    );
    expect(service.size).toEqual({ states: 0, artifacts: 0 });
  });

  it('rejects an artifact presented with another state', async () => {
    const a = service.start().state;
    const b = service.start().state;
    const artifact = service.mockAuthorize(a, KAMINSKA, 'bank');
    await expect(service.exchange(artifact, b)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('caps pending states', () => {
    for (let i = 0; i < LOGIN_GOV_MAX_PENDING + 5; i++) service.start();
    expect(service.size.states).toBe(LOGIN_GOV_MAX_PENDING);
  });
});

describe('demo PESELs', () => {
  it('are valid and unique', () => {
    const pesels = USER_SEED.map((u) => u.pesel);
    expect(pesels.every(isValidPesel)).toBe(true);
    expect(new Set(pesels).size).toBe(pesels.length);
  });

  it('isValidPesel checks the digit', () => {
    expect(isValidPesel(KAMINSKA)).toBe(true);
    expect(isValidPesel('78031504124')).toBe(false);
    expect(isValidPesel('7803150412')).toBe(false);
  });
});
