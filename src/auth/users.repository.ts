import type { Role, User } from './user.types.js';

export interface UserCredentials {
  user: User;
  passwordHash: string;
}

/**
 * Where accounts live. Auth depends only on this contract: the in-memory
 * implementation (users.in-memory.repository.ts) can be swapped for a
 * database one in AuthModule without touching anything else. Async on
 * purpose, as a database implementation will be.
 */
export abstract class UsersRepository {
  abstract findById(id: string): Promise<User | null>;
  /** The account and its hash, for sign-in only. Login is case-insensitive. */
  abstract findCredentials(login: string): Promise<UserCredentials | null>;
  /** The account of this PESEL (login.gov.pl sign-in), or null. */
  abstract findByPesel(pesel: string): Promise<User | null>;
  abstract list(): Promise<User[]>;
  /** The updated user, or null when there is no such user. */
  abstract updateRole(id: string, role: Role): Promise<User | null>;
}
