import type { ConfigService } from '@nestjs/config';

/**
 * Security settings read from the environment (README, `.env.example`). Each
 * reader returns the default when the variable is unset and stops the app at
 * startup, with a message naming the variable, when it is set to nonsense.
 */

/** Requests per minute per route and client (signed-in account, else IP). */
export const DEFAULT_RATE_LIMIT_PER_MINUTE = 100;
/** Sign-in and the assessed person's confirmation: attempts per minute per IP. */
export const DEFAULT_RATE_LIMIT_LOGIN_PER_MINUTE = 5;
/** Largest accepted request body (JSON or form). */
export const DEFAULT_BODY_LIMIT = '1mb';
/**
 * Proxies whose `X-Forwarded-For` is trusted: the loopback and private
 * networks, where a reverse proxy in front of the container (Coolify,
 * nginx, Traefik) sits. A client connecting straight from the internet
 * cannot fake its IP with the header.
 */
export const DEFAULT_TRUST_PROXY = 'loopback, linklocal, uniquelocal';

type Env = Pick<ConfigService, 'get'>;

function raw(config: Env, name: string): string | undefined {
  const value = config.get<string | number | boolean>(name);
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text === '' ? undefined : text;
}

function positiveInt(config: Env, name: string, fallback: number): number {
  const text = raw(config, name);
  if (text === undefined) return fallback;
  const value = Number(text);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(
      `${name} musi być dodatnią liczbą całkowitą (jest: „${text}”).`,
    );
  }
  return value;
}

export interface RateLimits {
  perMinute: number;
  loginPerMinute: number;
}

export function readRateLimits(config: Env): RateLimits {
  return {
    perMinute: positiveInt(
      config,
      'RATE_LIMIT_PER_MINUTE',
      DEFAULT_RATE_LIMIT_PER_MINUTE,
    ),
    loginPerMinute: positiveInt(
      config,
      'RATE_LIMIT_LOGIN_PER_MINUTE',
      DEFAULT_RATE_LIMIT_LOGIN_PER_MINUTE,
    ),
  };
}

/** `BODY_LIMIT`: a size the `bytes` package reads, e.g. `1mb`, `500kb`. */
export function readBodyLimit(config: Env): string {
  const text = raw(config, 'BODY_LIMIT') ?? DEFAULT_BODY_LIMIT;
  if (!/^\d+(\.\d+)?\s*(b|kb|mb)?$/i.test(text)) {
    throw new Error(
      `BODY_LIMIT musi być rozmiarem, np. 1mb albo 500kb (jest: „${text}”).`,
    );
  }
  return text;
}

/**
 * Express `trust proxy`: `true`/`false`, a number of hops, or a list of
 * addresses, subnets and the names `loopback`, `linklocal`, `uniquelocal`.
 */
export function readTrustProxy(config: Env): boolean | number | string {
  const text = raw(config, 'TRUST_PROXY') ?? DEFAULT_TRUST_PROXY;
  if (/^(true|false)$/i.test(text)) return text.toLowerCase() === 'true';
  if (/^\d+$/.test(text)) return Number(text);
  return text;
}
