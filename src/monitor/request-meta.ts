import type { Request } from 'express';
import { clientIp, parseSessionId } from './monitor.rules.js';

/** Longest User-Agent kept in the log. */
const USER_AGENT_MAX = 500;

/** What the log takes from any request: session, address and browser. Never the body. */
export function requestMeta(req: Request) {
  const ua = req.headers['user-agent'];
  return {
    sessionId: parseSessionId(req.headers['x-session-id']),
    ip: clientIp(req.headers['x-forwarded-for'], req.socket?.remoteAddress),
    userAgent: ua ? ua.slice(0, USER_AGENT_MAX) : null,
  };
}
