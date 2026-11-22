import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import {
  loginRateLimitMessage,
  RATE_LIMIT_MESSAGE,
} from './rate-limit.decorator.js';
import { readRateLimits } from './security.config.js';

/** Every limit counts requests in a one-minute window. */
const WINDOW_MS = 60_000;

/**
 * Rate limiting (OWASP ASVS V11.1.4, V2.2.1): 429 with `Retry-After`.
 *
 * - Counted per route and per client: the signed-in account, otherwise the IP
 *   (behind a proxy, from `X-Forwarded-For`, see `TRUST_PROXY`). Per account,
 *   so that a whole office behind one NAT address does not share one budget.
 * - `@LoginRateLimit()` routes (sign-in, the assessed person's confirmation)
 *   are public, so they always count per IP, with the lower limit.
 * - Counts live in this process's memory: with several instances each one
 *   counts on its own (docs/security/asvs-l2.md).
 *
 * Imported after the authentication module: global guards run in module
 * order, and the account must be known to count per account.
 */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const limits = readRateLimits(config);
        return {
          throttlers: [
            {
              ttl: WINDOW_MS,
              limit: (context) =>
                loginRateLimitMessage(context)
                  ? limits.loginPerMinute
                  : limits.perMinute,
            },
          ],
          getTracker: (req: { user?: { id: string } | null; ip?: string }) =>
            req.user ? `user:${req.user.id}` : `ip:${req.ip ?? 'unknown'}`,
          errorMessage: (context) =>
            loginRateLimitMessage(context) ?? RATE_LIMIT_MESSAGE,
        };
      },
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class RateLimitModule {}
