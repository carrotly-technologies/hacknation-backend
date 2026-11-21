import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { CaseRecord } from './case.types.js';
import { addDays } from './dates.js';

/**
 * The link the evaluator hands to the assessed person, who reads the signed
 * sheet and confirms "zapoznałem(-łam) się z oceną" (art. 83 ust. 1 ustawy:
 * the objection term runs from that day). Not a legal term: a product choice
 * of hacknation-backend#31 (one link, valid 14 days, a new one revokes it).
 */
export const ACK_LINK_VALID_DAYS = 14;

/** Frontend path of the public page; the API never builds the full URL. */
export const ACK_LINK_PATH = '/zapoznanie/';

/** 256 random bits, URL-safe: the only protection of the public page. */
export function newAckToken(): string {
  return randomBytes(32).toString('base64url');
}

export function ackTokenExpiresOn(today: string): string {
  return addDays(today, ACK_LINK_VALID_DAYS);
}

export function ackLinkOf(record: CaseRecord): string | null {
  return record.ackToken && !record.acknowledgedOn
    ? `${ACK_LINK_PATH}${record.ackToken}`
    : null;
}

/** Constant-time comparison (hashes first, so lengths never differ). */
export function ackTokenMatches(
  stored: string | null,
  candidate: string,
): boolean {
  if (!stored) return false;
  const digest = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(digest(stored), digest(candidate));
}

/** Expired the day after `ackTokenExpiresOn`. */
export function ackTokenExpired(record: CaseRecord, today: string): boolean {
  return !record.ackTokenExpiresOn || today > record.ackTokenExpiresOn;
}
