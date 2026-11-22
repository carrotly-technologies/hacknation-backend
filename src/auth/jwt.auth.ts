import { Injectable } from '@nestjs/common';
import {
  AuthenticationRegistry,
  JwtBearerProvider,
  type JwtClaims,
} from '@nestjs/authentication';
import { RevokedTokens } from './revoked-tokens.service.js';
import type { User } from './user.types.js';
import { UsersRepository } from './users.repository.js';

/** The claim carrying `User.tokenVersion` (tokens issued without it count as 0). */
export const TOKEN_VERSION_CLAIM = 'tv';

/**
 * `Authorization: Bearer <JWT>`. The base class verifies the signature with
 * the module's key, accepts only HS256 (`alg: none` and every other algorithm
 * are refused) and checks `exp`. Here: the account is loaded on every request,
 * so the role always comes from the repository, never from the token; a token
 * signed out (`jti` revoked) or older than the account's `tokenVersion` is
 * refused with 401.
 */
@Injectable()
export class JwtAuth extends JwtBearerProvider<User> {
  constructor(
    private readonly users: UsersRepository,
    private readonly revoked: RevokedTokens,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerProvider(this);
  }

  protected async validate(claims: JwtClaims): Promise<User | null> {
    if (!claims.sub || !claims.jti || this.revoked.isRevoked(claims.jti)) {
      return null;
    }
    const user = await this.users.findById(claims.sub);
    const version = claims[TOKEN_VERSION_CLAIM] ?? 0;
    return user && version === user.tokenVersion ? user : null;
  }
}
