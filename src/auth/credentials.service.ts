import { Injectable } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import type { User } from './user.types.js';
import { UsersRepository } from './users.repository.js';

@Injectable()
export class CredentialsService {
  constructor(
    private readonly users: UsersRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  /** The user, or null for a wrong login or password (same timing for both). */
  async verify(login: string, password: string): Promise<User | null> {
    const found = await this.users.findCredentials(login);
    const valid = await this.hasher.verify(password, found?.passwordHash);
    return valid && found ? found.user : null;
  }
}
