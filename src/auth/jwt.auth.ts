import { Injectable } from '@nestjs/common';
import {
  AuthenticationRegistry,
  JwtBearerProvider,
  type JwtClaims,
} from '@nestjs/authentication';
import type { User } from './user.types.js';
import { UsersRepository } from './users.repository.js';

/**
 * `Authorization: Bearer <JWT>`. Loads the account on every request, so the
 * role always comes from the repository, never from the token.
 */
@Injectable()
export class JwtAuth extends JwtBearerProvider<User> {
  constructor(
    private readonly users: UsersRepository,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerProvider(this);
  }

  protected validate({ sub }: JwtClaims): Promise<User | null> | null {
    return sub ? this.users.findById(sub) : null;
  }
}
