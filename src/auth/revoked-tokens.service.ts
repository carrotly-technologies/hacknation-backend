import { Injectable } from '@nestjs/common';

/**
 * Access tokens ended by sign-out before they expire (`jti` → expiry). An
 * entry is dropped once its token would have expired anyway, so the set stays
 * as small as the number of sign-outs in the last 8 hours.
 *
 * In this process's memory, like the accounts (users.in-memory.repository.ts):
 * with several instances, move both to the database together.
 */
@Injectable()
export class RevokedTokens {
  private readonly revoked = new Map<string, number>();

  /** `expiresAt` in epoch seconds (the token's `exp`). */
  revoke(jti: string, expiresAt: number): void {
    this.sweep();
    this.revoked.set(jti, expiresAt * 1000);
  }

  isRevoked(jti: string): boolean {
    const until = this.revoked.get(jti);
    return until !== undefined && until > Date.now();
  }

  private sweep(): void {
    const now = Date.now();
    for (const [jti, until] of this.revoked) {
      if (until <= now) this.revoked.delete(jti);
    }
  }
}
