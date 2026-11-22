import { SetMetadata, type ExecutionContext } from '@nestjs/common';

const LOGIN_RATE_LIMIT = Symbol('loginRateLimit');

/** 429 answer of the routes under the general limit. */
export const RATE_LIMIT_MESSAGE =
  'Zbyt wiele żądań w krótkim czasie. Odczekaj chwilę i spróbuj ponownie.';

/**
 * A route that guesses a secret (a password, a link token): it gets the
 * sign-in limit (`RATE_LIMIT_LOGIN_PER_MINUTE` per IP), not the general one,
 * and answers 429 with `message`.
 */
export const LoginRateLimit = (message: string) =>
  SetMetadata(LOGIN_RATE_LIMIT, message);

/** The 429 message of a `@LoginRateLimit()` route, or undefined for others. */
export function loginRateLimitMessage(
  context: ExecutionContext,
): string | undefined {
  return (
    (Reflect.getMetadata(LOGIN_RATE_LIMIT, context.getHandler()) as
      string | undefined) ??
    (Reflect.getMetadata(LOGIN_RATE_LIMIT, context.getClass()) as
      string | undefined)
  );
}
