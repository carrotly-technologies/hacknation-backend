import type { LogoId } from './logos.js';

/** The accepted logo of the app; all null until someone accepts one. */
export interface LogoChoice {
  logoId: LogoId | null;
  /** ISO 8601 timestamp (UTC). */
  acceptedAt: string | null;
  acceptedBy: { id: string; name: string } | null;
}
