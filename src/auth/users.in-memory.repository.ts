import { Injectable } from '@nestjs/common';
import type { Role, User } from './user.types.js';
import { type UserCredentials, UsersRepository } from './users.repository.js';
import { USER_SEED } from './users.seed.js';

type Row = User & { passwordHash: string; pesel: string };

/** Accounts in memory, seeded on startup (until the database ticket lands). */
@Injectable()
export class InMemoryUsersRepository extends UsersRepository {
  private readonly rows = new Map<string, Row>(
    USER_SEED.map((row) => [row.id, { ...row }]),
  );

  findById(id: string): Promise<User | null> {
    const row = this.rows.get(id);
    return Promise.resolve(row ? publicUser(row) : null);
  }

  findCredentials(login: string): Promise<UserCredentials | null> {
    const wanted = login.trim().toLowerCase();
    const row = [...this.rows.values()].find(
      (r) => r.login.toLowerCase() === wanted,
    );
    return Promise.resolve(
      row ? { user: publicUser(row), passwordHash: row.passwordHash } : null,
    );
  }

  findByPesel(pesel: string): Promise<User | null> {
    const row = [...this.rows.values()].find((r) => r.pesel === pesel);
    return Promise.resolve(row ? publicUser(row) : null);
  }

  list(): Promise<User[]> {
    return Promise.resolve([...this.rows.values()].map(publicUser));
  }

  updateRole(id: string, role: Role): Promise<User | null> {
    const row = this.rows.get(id);
    if (!row) return Promise.resolve(null);
    row.role = role;
    return Promise.resolve(publicUser(row));
  }
}

function publicUser({
  passwordHash: _hash,
  pesel: _pesel,
  ...user
}: Row): User {
  return { ...user };
}
