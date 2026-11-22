import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  anonymousKeyDay,
  chronological,
  groupSessions,
  retentionCutoff,
  sessionKey,
  summarize,
  timeOrderedId,
} from './monitor.rules.js';
import type { SessionsQuery } from './monitor.schemas.js';
import type {
  RequestLogEntry,
  SessionDetail,
  SessionPage,
} from './monitor.types.js';
import { RequestLogRepository } from './request-log.repository.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Activity log: who used the app, from where and what they did. Writing never
 * delays or changes a response: a failed write is only logged (without the
 * entry, which may carry an IP).
 */
@Injectable()
export class MonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MonitorService.name);
  private retentionTimer?: NodeJS.Timeout;

  constructor(
    @Inject(RequestLogRepository) private readonly repo: RequestLogRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.purge();
    this.retentionTimer = setInterval(() => void this.purge(), DAY_MS);
    this.retentionTimer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.retentionTimer);
  }

  /** Deletes entries past the retention period. */
  async purge(now = new Date()): Promise<void> {
    try {
      const removed = await this.repo.deleteOlderThan(
        retentionCutoff(now).toISOString(),
      );
      if (removed > 0)
        this.logger.log(`Usunięto ${removed} starych wpisów aktywności.`);
    } catch (err) {
      this.logger.warn(`Nie udało się usunąć starych wpisów: ${String(err)}`);
    }
  }

  /** Fire and forget: the caller never waits for or sees a failed write. */
  record(entry: Omit<RequestLogEntry, 'id' | 'at'> & { at?: string }): void {
    const row: RequestLogEntry = {
      ...entry,
      id: timeOrderedId(),
      at: entry.at ?? new Date().toISOString(),
    };
    this.repo.insert(row).catch((err: unknown) => {
      this.logger.warn(`Nie udało się zapisać aktywności: ${String(err)}`);
    });
  }

  /** Deletes the whole activity log (the team clears it after the demo). */
  async clear(): Promise<{ removed: number }> {
    const removed = await this.repo.deleteAll();
    this.logger.log(`Wyczyszczono dziennik aktywności (${removed} wpisów).`);
    return { removed };
  }

  async sessions(query: SessionsQuery): Promise<SessionPage> {
    const entries = await this.repo.list({ from: query.from, to: query.to });
    return groupSessions(entries, query);
  }

  async session(sessionId: string): Promise<SessionDetail> {
    const entries = await this.sessionEntries(sessionId);
    if (entries.length === 0)
      throw new NotFoundException('Nie znaleziono takiej sesji.');
    return {
      session: summarize(sessionId, entries),
      entries: chronological(entries),
    };
  }

  private async sessionEntries(sessionId: string): Promise<RequestLogEntry[]> {
    const day = anonymousKeyDay(sessionId);
    if (!day) return this.repo.listBySession(sessionId.toLowerCase());
    const rows = await this.repo.listWithoutSession({
      from: `${day}T00:00:00.000Z`,
      to: `${day}T23:59:59.999Z`,
    });
    return rows.filter((e) => sessionKey(e) === sessionId);
  }
}
