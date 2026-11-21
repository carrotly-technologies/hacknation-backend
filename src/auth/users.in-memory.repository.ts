import { Injectable } from '@nestjs/common';
import type { Role, User } from './user.types.js';
import { UsersRepository } from './users.repository.js';
import { USER_SEED } from './users.seed.js';

/** Accounts in memory, seeded on startup (until the database ticket lands). */
@Injectable()
export class InMemoryUsersRepository extends UsersRepository {
  private readonly rows = new Map<string, User>(
    USER_SEED.map((row) => [row.id, { ...row }]),
  );

  findById(id: string): Promise<User | null> {
    const row = this.rows.get(id);
    return Promise.resolve(row ? { ...row } : null);
  }

  list(): Promise<User[]> {
    return Promise.resolve([...this.rows.values()].map((row) => ({ ...row })));
  }

  updateRole(id: string, role: Role): Promise<User | null> {
    const row = this.rows.get(id);
    if (!row) return Promise.resolve(null);
    row.role = role;
    return Promise.resolve({ ...row });
  }
}
