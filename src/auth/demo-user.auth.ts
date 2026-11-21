import {
  BadRequestException,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import {
  AuthenticationProvider,
  AuthenticationRegistry,
  type AuthenticationResult,
} from '@nestjs/authentication';
import type { User } from './user.types.js';
import { UsersRepository } from './users.repository.js';

/** Header with the id of the demo account the caller acts as. */
export const USER_ID_HEADER = 'x-user-id';

/** The account used when the request names none (a SUPERVISOR). */
export const DEFAULT_USER_ID = 'u-kaminska';

/**
 * No sign-in: the caller picks a demo account with `X-User-Id` (an id from
 * users.seed.ts), the default one without the header, and 400 for an unknown
 * id. The account is loaded on every request, so its role always comes from
 * the repository and the policies see the same `User` as before.
 */
@Injectable()
export class DemoUserAuth extends AuthenticationProvider<User> {
  constructor(
    private readonly users: UsersRepository,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerProvider(this);
  }

  async authenticate(
    context: ExecutionContext,
  ): Promise<AuthenticationResult<User>> {
    const id = this.header(context, USER_ID_HEADER)?.trim() || DEFAULT_USER_ID;
    const user = await this.users.findById(id);
    if (!user) {
      throw new BadRequestException(
        `Nie ma konta demo „${id}”. Wybierz konto z listy w nagłówku aplikacji.`,
      );
    }
    return { user };
  }
}
