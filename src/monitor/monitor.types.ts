/** `API`: a call to /api/*; `PAGEVIEW`: a screen of the frontend (POST /api/telemetry/pageview). */
export const LOG_KINDS = ['API', 'PAGEVIEW'] as const;
export type LogKind = (typeof LOG_KINDS)[number];

/**
 * One row of `request_log`. Never carries a request or response body, a
 * password or a token: only what is needed to see who used the app and how.
 */
export interface RequestLogEntry {
  id: string;
  /** ISO 8601 (UTC), when the response was sent (pageview: when it was reported). */
  at: string;
  /** UUID from `X-Session-Id` (one browser tab of the frontend), else null. */
  sessionId: string | null;
  kind: LogKind;
  /** HTTP method; null for a pageview. */
  method: string | null;
  /** Path with the query string (secret link tokens masked). */
  path: string;
  /** HTTP status; null for a pageview. */
  status: number | null;
  /** Time to the response in ms; null for a pageview. */
  durationMs: number | null;
  ip: string | null;
  userAgent: string | null;
  /** The signed-in account, when the route authenticated one. */
  userId: string | null;
  /** Its login (not the person's name: data minimisation). */
  userName: string | null;
}

export interface SessionUser {
  id: string;
  name: string | null;
}

/** A session in GET /api/monitor/sessions. */
export interface SessionSummary {
  /** The `X-Session-Id`, or `anon-…` for calls without one (grouped by IP, browser and day). */
  sessionId: string;
  anonymous: boolean;
  users: SessionUser[];
  ips: string[];
  /** The most recent User-Agent of the session. */
  userAgent: string | null;
  firstAt: string;
  lastAt: string;
  pageviews: number;
  apiCalls: number;
  /** API calls answered with 4xx or 5xx. */
  errors: number;
}

export interface SessionPage {
  items: SessionSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SessionDetail {
  session: SessionSummary;
  /** Every entry of the session, oldest first. */
  entries: RequestLogEntry[];
}
