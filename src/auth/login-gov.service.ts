import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { LoginGovMethod } from './auth.schemas.js';
import type { User } from './user.types.js';
import { UsersRepository } from './users.repository.js';

/** How long a started sign-in (state) is valid. */
export const LOGIN_GOV_STATE_TTL_MS = 5 * 60_000;
/** How long the one-time artifact from the identity provider is valid. */
export const LOGIN_GOV_ARTIFACT_TTL_MS = 60_000;
/** Upper bound of pending entries per map, so spamming `start` can't exhaust memory. */
export const LOGIN_GOV_MAX_PENDING = 10_000;

interface PendingState {
  expiresAt: number;
  /** The identity provider already answered this state (one artifact per state). */
  authorized: boolean;
}

interface PendingArtifact {
  expiresAt: number;
  state: string;
  pesel: string;
  method: LoginGovMethod;
}

const BAD_STATE =
  'Sesja logowania przez login.gov.pl wygasła albo jest nieprawidłowa. Zacznij logowanie od nowa.';
const BAD_ARTIFACT =
  'Ten link logowania został już użyty albo wygasł. Zaloguj się ponownie.';
const NO_ACCOUNT = 'Brak konta dla tej osoby.';

/**
 * Simulated sign-in through Węzeł Krajowy (login.gov.pl): the app starts a
 * flow (random `state`), the identity provider redirects back with a one-time
 * `artifact`, and the app exchanges the artifact for the person's PESEL. Here
 * the provider is a mock (`mockAuthorize`); a real integration replaces it
 * with SAML 2.0 (ArtifactResolve), see README.
 *
 * In-process memory on purpose (one instance, hackathon demo): expired
 * entries are swept on every call and each map is capped.
 */
@Injectable()
export class LoginGovService {
  private readonly states = new Map<string, PendingState>();
  private readonly artifacts = new Map<string, PendingArtifact>();

  constructor(private readonly users: UsersRepository) {}

  start(): { state: string; expiresAt: number } {
    const now = Date.now();
    this.sweep(now);
    const state = randomToken();
    const expiresAt = now + LOGIN_GOV_STATE_TTL_MS;
    put(this.states, state, { expiresAt, authorized: false });
    return { state, expiresAt };
  }

  /** The mock identity provider: the person "signed in", issue an artifact. */
  mockAuthorize(state: string, pesel: string, method: LoginGovMethod): string {
    const now = Date.now();
    this.sweep(now);
    const pending = this.states.get(state);
    if (!pending || pending.authorized) {
      throw new BadRequestException(BAD_STATE);
    }
    pending.authorized = true;
    const artifact = randomToken();
    put(this.artifacts, artifact, {
      expiresAt: now + LOGIN_GOV_ARTIFACT_TTL_MS,
      state,
      pesel,
      method,
    });
    return artifact;
  }

  /** Burns the artifact (also on failure) and returns the matching account. */
  async exchange(artifact: string, state: string): Promise<User> {
    const now = Date.now();
    // Read before sweeping: an expired artifact still answers 401, not 400.
    const found = this.artifacts.get(artifact);
    this.artifacts.delete(artifact);
    this.sweep(now);
    if (!this.states.has(state)) throw new BadRequestException(BAD_STATE);
    if (!found || found.expiresAt <= now) {
      throw new UnauthorizedException(BAD_ARTIFACT);
    }
    if (!sameToken(found.state, state)) {
      throw new BadRequestException(BAD_STATE);
    }
    const user = await this.users.findByPesel(found.pesel);
    if (!user) throw new UnauthorizedException(NO_ACCOUNT);
    return user;
  }

  /** Pending entries, for tests. */
  get size(): { states: number; artifacts: number } {
    return { states: this.states.size, artifacts: this.artifacts.size };
  }

  private sweep(now: number): void {
    for (const map of [this.states, this.artifacts]) {
      for (const [key, entry] of map) {
        if (entry.expiresAt <= now) map.delete(key);
      }
    }
  }
}

function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

function sameToken(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Map keeps insertion order: past the cap, the oldest entry goes first. */
function put<T>(map: Map<string, T>, key: string, value: T): void {
  if (map.size >= LOGIN_GOV_MAX_PENDING) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(key, value);
}
