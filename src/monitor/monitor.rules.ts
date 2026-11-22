import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type {
  RequestLogEntry,
  SessionPage,
  SessionSummary,
  SessionUser,
} from './monitor.types.js';

/** Entries older than this are deleted at startup and once a day (product decision). */
export const RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Longest path (with the query) kept in the log. */
export const PATH_MAX = 500;

let lastMs = 0;
let counter = 0;

/**
 * A UUIDv7: time-ordered (48-bit ms timestamp, then a 12-bit counter within the
 * same ms), so entries of the same millisecond keep their order when sorted by
 * `(at, id)`.
 */
export function timeOrderedId(now = Date.now()): string {
  if (now <= lastMs) {
    counter = (counter + 1) & 0xfff;
    if (counter === 0) lastMs++;
  } else {
    lastMs = now;
    counter = 0;
  }
  const bytes = randomBytes(16);
  bytes.writeUIntBE(lastMs, 0, 6);
  bytes[6] = 0x70 | (counter >> 8);
  bytes[7] = counter & 0xff;
  bytes[8] = 0x80 | (bytes[8] & 0x3f);
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The oldest moment still kept at `now`. */
export function retentionCutoff(now: Date): Date {
  return new Date(now.getTime() - RETENTION_DAYS * DAY_MS);
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** `X-Session-Id` when it is a UUID (lower case), else null. */
export function parseSessionId(header: unknown): string | null {
  const value = Array.isArray(header) ? (header[0] as unknown) : header;
  return typeof value === 'string' && UUID.test(value.trim())
    ? value.trim().toLowerCase()
    : null;
}

/**
 * The client's address: the first one of `X-Forwarded-For` (set by the proxy
 * in front of the app, Coolify/Traefik), else the socket's. IPv4-mapped IPv6
 * (`::ffff:1.2.3.4`) is shown as IPv4.
 */
export function clientIp(
  forwardedFor: unknown,
  remoteAddress: string | undefined,
): string | null {
  const header = Array.isArray(forwardedFor)
    ? (forwardedFor[0] as unknown)
    : forwardedFor;
  const first =
    typeof header === 'string' ? header.split(',')[0]?.trim() : undefined;
  const ip = first || remoteAddress || null;
  return ip ? ip.replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/, '') : null;
}

/**
 * Whether an API call is logged: everything under /api except the monitor
 * itself, the health check (polled by the frontend and Docker), the pageview
 * route (logged as a PAGEVIEW instead), Swagger UI (served outside Nest's
 * middleware anyway) and CORS preflights.
 */
export function shouldLogApiCall(method: string, url: string): boolean {
  if (method === 'OPTIONS') return false;
  const path = url.split('?')[0];
  if (path !== '/api' && !path.startsWith('/api/')) return false;
  const under = (base: string) => path === base || path.startsWith(`${base}/`);
  return !(
    under('/api/monitor') ||
    under('/api/health') ||
    under('/api/telemetry') ||
    under('/api/swagger') ||
    path === '/api/swagger.json'
  );
}

/** Query parameters whose values are secrets or personal data (sign-in callbacks, PESEL). */
const SECRET_QUERY =
  /([?&](?:code|state|token|access_token|id_token|password|pesel)=)[^&#]*/gi;

/**
 * The path as stored: the secret token of the assessed person's link (API
 * `/api/ack/<token>`, frontend `/zapoznanie/<token>`) is masked, so the log
 * never opens someone's sheet, secret query values (sign-in `code`, `state`,
 * tokens, PESEL) are masked too, and the length is capped.
 */
export function maskPath(path: string): string {
  return path
    .replace(/^(\/api\/ack\/)[^/?#]+/, '$1***')
    .replace(/^(\/zapoznanie\/)[^/?#]+/, '$1***')
    .replace(SECRET_QUERY, '$1***')
    .slice(0, PATH_MAX);
}

/** Key of the entries without a session id: same IP, browser and day. */
export function anonymousSessionKey(
  entry: Pick<RequestLogEntry, 'at' | 'ip' | 'userAgent'>,
): string {
  const day = entry.at.slice(0, 10);
  const hash = createHash('sha256')
    .update(`${entry.ip ?? ''}|${entry.userAgent ?? ''}|${day}`)
    .digest('hex')
    .slice(0, 12);
  return `anon-${day}-${hash}`;
}

/** Day (YYYY-MM-DD) of an anonymous key, else null. */
export function anonymousKeyDay(sessionId: string): string | null {
  return /^anon-(\d{4}-\d{2}-\d{2})-[0-9a-f]{12}$/.exec(sessionId)?.[1] ?? null;
}

export function sessionKey(entry: RequestLogEntry): string {
  return entry.sessionId ?? anonymousSessionKey(entry);
}

const byTime = (a: RequestLogEntry, b: RequestLogEntry) =>
  a.at.localeCompare(b.at) || a.id.localeCompare(b.id);

/** The summary of one session's entries (any order, at least one). */
export function summarize(
  key: string,
  entries: RequestLogEntry[],
): SessionSummary {
  const sorted = [...entries].sort(byTime);
  const users = new Map<string, SessionUser>();
  const ips: string[] = [];
  let userAgent: string | null = null;
  let pageviews = 0;
  let apiCalls = 0;
  let errors = 0;
  for (const e of sorted) {
    if (e.userId && !users.has(e.userId))
      users.set(e.userId, { id: e.userId, name: e.userName });
    if (e.ip && !ips.includes(e.ip)) ips.push(e.ip);
    if (e.userAgent) userAgent = e.userAgent;
    if (e.kind === 'PAGEVIEW') pageviews++;
    else {
      apiCalls++;
      if (e.status !== null && e.status >= 400) errors++;
    }
  }
  return {
    sessionId: key,
    anonymous: !sorted[0].sessionId,
    users: [...users.values()],
    ips,
    userAgent,
    firstAt: sorted[0].at,
    lastAt: sorted[sorted.length - 1].at,
    pageviews,
    apiCalls,
    errors,
  };
}

export interface SessionFilter {
  /** Part of an IP address. */
  ip?: string;
  /** Part of an account id or login, any case. */
  userId?: string;
  page: number;
  pageSize: number;
}

/** Groups entries into sessions, filters them, newest activity first, one page. */
export function groupSessions(
  entries: RequestLogEntry[],
  filter: SessionFilter,
): SessionPage {
  const groups = new Map<string, RequestLogEntry[]>();
  for (const e of entries) {
    const key = sessionKey(e);
    const group = groups.get(key);
    if (group) group.push(e);
    else groups.set(key, [e]);
  }
  const ip = filter.ip?.trim();
  const user = filter.userId?.trim().toLowerCase();
  const sessions = [...groups]
    .map(([key, group]) => summarize(key, group))
    .filter((s) => !ip || s.ips.some((i) => i.includes(ip)))
    .filter(
      (s) =>
        !user ||
        s.users.some(
          (u) =>
            u.id.toLowerCase().includes(user) ||
            !!u.name?.toLowerCase().includes(user),
        ),
    )
    .sort(
      (a, b) =>
        b.lastAt.localeCompare(a.lastAt) ||
        a.sessionId.localeCompare(b.sessionId),
    );
  const start = (filter.page - 1) * filter.pageSize;
  return {
    items: sessions.slice(start, start + filter.pageSize),
    total: sessions.length,
    page: filter.page,
    pageSize: filter.pageSize,
  };
}

/** Oldest first, for a session's timeline. */
export function chronological(entries: RequestLogEntry[]): RequestLogEntry[] {
  return [...entries].sort(byTime);
}

/**
 * Whether `given` equals `expected`, in constant time (both hashed first, so
 * the length leaks nothing either). An unset or empty `expected` never matches.
 */
export function tokenMatches(
  given: unknown,
  expected: string | undefined,
): boolean {
  if (!expected || typeof given !== 'string' || !given) return false;
  const digest = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(digest(given), digest(expected));
}
