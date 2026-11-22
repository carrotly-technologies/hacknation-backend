import { ACTION_LABELS } from '../cases/actions.rules.js';
import { CASE_ACTIONS, type CaseAction } from '../cases/case.types.js';
import type { AuditActorRole } from './audit.types.js';

/** Methods that change data; reads are not logged (issue #70: out of scope). */
export const MUTATING_METHODS: ReadonlySet<string> = new Set([
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
]);

type Params = Record<string, string | undefined>;

export interface RouteAudit {
  /** A fixed action, or one read from the request body (case actions). */
  action: string | ((body: unknown) => string);
  resourceType: string | null;
  /** From the route params, or from the response for a created record. */
  resourceId?: (params: Params, response: unknown) => string | null;
  /** Who acts when nobody is signed in (the public ack link). */
  actor?: AuditActorRole;
}

/**
 * `SKIP`: a POST that changes nothing (a computation, an assistant question).
 * `EXPLICIT`: the controller writes the entry itself (sign-in).
 */
export type RouteSpec = RouteAudit | 'SKIP' | 'EXPLICIT';

const param =
  (name: string) =>
  (params: Params): string | null =>
    params[name] ?? null;

const createdId = (_params: Params, response: unknown): string | null => {
  const id = (response as { id?: unknown } | null | undefined)?.id;
  return typeof id === 'string' ? id : null;
};

const caseAction = (body: unknown): string => {
  const action = (body as { action?: unknown } | null | undefined)?.action;
  // Only a known action name goes into the log, never free input.
  return CASE_ACTIONS.includes(action as CaseAction)
    ? `CASE_ACTION:${action as string}`
    : 'CASE_ACTION';
};

/**
 * Every data-changing route, keyed by `METHOD /path` as Nest declares it
 * (without the global `/api` prefix). A route missing here is still logged,
 * as `HTTP:METHOD /path` (see `describeRoute`).
 */
export const AUDITED_ROUTES: Readonly<Record<string, RouteSpec>> = {
  'POST /auth/login': 'EXPLICIT',
  // Tokens are stateless: logout changes nothing on the server.
  'POST /auth/logout': 'SKIP',
  'POST /assessments/suggest-level': 'SKIP',
  'POST /assessments/evaluate': 'SKIP',
  'POST /assistant/ask': 'SKIP',

  'POST /cases': {
    action: 'CASE_CREATE',
    resourceType: 'CASE',
    resourceId: createdId,
  },
  'PATCH /cases/:id': {
    action: 'CASE_PATCH',
    resourceType: 'CASE',
    resourceId: param('id'),
  },
  'POST /cases/:id/observations': {
    action: 'CASE_OBSERVATION_ADD',
    resourceType: 'CASE',
    resourceId: param('id'),
  },
  'POST /cases/:id/actions': {
    action: caseAction,
    resourceType: 'CASE',
    resourceId: param('id'),
  },
  'POST /hr/reminders': { action: 'HR_REMINDERS', resourceType: 'CASE' },
  'POST /demo/reset': { action: 'DEMO_RESET', resourceType: 'DEMO' },
  'PATCH /people/:personId': {
    action: 'PERSON_UPDATE',
    resourceType: 'PERSON',
    resourceId: param('personId'),
  },
  'PATCH /admin/users/:id': {
    action: 'USER_ROLE_CHANGED',
    resourceType: 'USER',
    resourceId: param('id'),
  },

  'POST /people/:personId/notes': {
    action: 'JOURNAL_NOTE_ADD',
    resourceType: 'NOTE',
    resourceId: createdId,
  },
  'PATCH /notes/:id': {
    action: 'JOURNAL_NOTE_UPDATE',
    resourceType: 'NOTE',
    resourceId: param('id'),
  },
  'DELETE /notes/:id': {
    action: 'JOURNAL_NOTE_DELETE',
    resourceType: 'NOTE',
    resourceId: param('id'),
  },
  'POST /people/:personId/observations': {
    action: 'JOURNAL_OBSERVATION_ADD',
    resourceType: 'OBSERVATION',
    resourceId: createdId,
  },
  'PATCH /observations/:id': {
    action: 'JOURNAL_OBSERVATION_UPDATE',
    resourceType: 'OBSERVATION',
    resourceId: param('id'),
  },
  'DELETE /observations/:id': {
    action: 'JOURNAL_OBSERVATION_DELETE',
    resourceType: 'OBSERVATION',
    resourceId: param('id'),
  },

  // The token is a secret and never logged: the controller names the case.
  'POST /ack/:token': {
    action: 'ACK_CONFIRM',
    resourceType: 'CASE',
    actor: 'ASSESSED_VIA_LINK',
  },
  'POST /ack/:token/objection': {
    action: 'ACK_OBJECTION',
    resourceType: 'CASE',
    actor: 'ASSESSED_VIA_LINK',
  },
};

/** `/api/cases/:id` → `/cases/:id`. */
export function routeKey(method: string, routePath: string): string {
  const path = routePath.replace(/^\/api(?=\/|$)/, '') || '/';
  return `${method.toUpperCase()} ${path}`;
}

/** The spec of a route; unknown mutating routes get a generic entry. */
export function describeRoute(method: string, routePath: string): RouteSpec {
  const key = routeKey(method, routePath);
  return (
    AUDITED_ROUTES[key] ?? {
      action: `HTTP:${key}`,
      resourceType: null,
    }
  );
}

const FIELD_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const MAX_FIELDS = 30;

/**
 * Names of the top-level fields sent, never their values. Only
 * identifier-like names (the API's own), so free text sent as a key does not
 * end up in the log; never `password`.
 */
export function changedFieldsOf(body: unknown): string[] {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return [];
  }
  return Object.keys(body)
    .filter((key) => FIELD_NAME.test(key) && key !== 'password')
    .sort()
    .slice(0, MAX_FIELDS);
}

const FIXED_LABELS: Readonly<Record<string, string>> = {
  LOGIN: 'Logowanie',
  LOGIN_FAILED: 'Nieudane logowanie',
  CASE_CREATE: 'Rozpoczęcie nowej oceny',
  CASE_PATCH: 'Zmiana danych w ocenie',
  CASE_OBSERVATION_ADD: 'Dodanie obserwacji do oceny',
  CASE_ACTION: 'Akcja w ocenie (nieznana)',
  HR_REMINDERS: 'Wysłanie przypomnień (kadry)',
  DEMO_RESET: 'Przywrócenie danych demonstracyjnych',
  PERSON_UPDATE: 'Zmiana danych pracownika',
  USER_ROLE_CHANGED: 'Zmiana roli użytkownika',
  JOURNAL_NOTE_ADD: 'Dodanie notatki przełożonego',
  JOURNAL_NOTE_UPDATE: 'Zmiana notatki przełożonego',
  JOURNAL_NOTE_DELETE: 'Usunięcie notatki przełożonego',
  JOURNAL_OBSERVATION_ADD: 'Dodanie obserwacji przełożonego',
  JOURNAL_OBSERVATION_UPDATE: 'Zmiana obserwacji przełożonego',
  JOURNAL_OBSERVATION_DELETE: 'Usunięcie obserwacji przełożonego',
  ACK_CONFIRM: 'Oceniany potwierdził zapoznanie się z oceną (link)',
  ACK_OBJECTION: 'Oceniany zgłosił sprzeciw od oceny (link)',
};

/** Every known action with its Polish name, for the filter of the admin page. */
export const AUDIT_ACTIONS: readonly { action: string; label: string }[] = [
  ...Object.entries(FIXED_LABELS)
    .filter(([action]) => action !== 'CASE_ACTION')
    .map(([action, label]) => ({ action, label })),
  ...CASE_ACTIONS.map((a) => ({
    action: `CASE_ACTION:${a}`,
    label: `Akcja w ocenie: ${ACTION_LABELS[a]}`,
  })),
];

const LABELS = new Map(AUDIT_ACTIONS.map((a) => [a.action, a.label]));

/** The Polish name of an action, for the table of the admin page. */
export function auditActionLabel(action: string): string {
  const known = LABELS.get(action) ?? FIXED_LABELS[action];
  if (known) return known;
  if (action.startsWith('HTTP:')) return `Inna zmiana (${action.slice(5)})`;
  return action;
}

const RESOURCE_LABELS: Readonly<Record<string, string>> = {
  CASE: 'Ocena',
  PERSON: 'Pracownik',
  USER: 'Konto użytkownika',
  NOTE: 'Notatka przełożonego',
  OBSERVATION: 'Obserwacja przełożonego',
  DEMO: 'Dane demonstracyjne',
};

export function auditResourceLabel(type: string | null): string | null {
  return type ? (RESOURCE_LABELS[type] ?? type) : null;
}
