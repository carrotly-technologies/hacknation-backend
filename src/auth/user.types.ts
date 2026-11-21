export const ROLES = ['SUPERVISOR', 'HR', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

/** A demo account the caller acts as (`X-User-Id`). */
export interface User {
  id: string;
  login: string;
  firstName: string;
  lastName: string;
  role: Role;
  position: string;
  unit: string;
  /** The EVALUATORS id whose cases a SUPERVISOR handles; null for others. */
  evaluatorId: string | null;
}

/** What the users API returns: the account without internal links. */
export interface UserView {
  id: string;
  login: string;
  name: string;
  firstName: string;
  lastName: string;
  role: Role;
  position: string;
  unit: string;
}

export function toUserView(user: User): UserView {
  return {
    id: user.id,
    login: user.login,
    name: `${user.firstName} ${user.lastName}`,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    position: user.position,
    unit: user.unit,
  };
}

declare module '@nestjs/authentication' {
  interface AuthenticationTypes {
    user: User;
    refreshTokens: false;
  }
}
