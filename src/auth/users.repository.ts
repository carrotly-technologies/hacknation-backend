import type { Role, User } from './user.types.js';

/**
 * Where accounts live. Auth depends only on this contract: the in-memory
 * implementation (users.in-memory.repository.ts) can be swapped for a
 * database one in AuthModule without touching anything else. Async on
 * purpose, as a database implementation will be.
 */
export abstract class UsersRepository {
  abstract findById(id: string): Promise<User | null>;
  abstract list(): Promise<User[]>;
  /** The updated user, or null when there is no such user. */
  abstract updateRole(id: string, role: Role): Promise<User | null>;
}
