import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

/** Dev-only fallback. Production must set JWT_SECRET (32+ bytes). */
export const DEV_JWT_SECRET = 'kompas-dev-only-secret-change-me-in-production';

export function readJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET')?.trim();
  if (!secret) {
    new Logger('Auth').warn(
      'JWT_SECRET is not set: signing tokens with the dev-only default secret. Set JWT_SECRET (32+ bytes) in production.',
    );
    return DEV_JWT_SECRET;
  }
  return secret;
}
