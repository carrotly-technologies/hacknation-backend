import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CasesService } from '../cases/cases.service.js';
import { JournalRepository } from '../journal/journal.repository.js';
import {
  anonymizeCase,
  isPastRetention,
  parseRetentionYears,
  retentionCutoff,
} from './retention.rules.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RetentionReport {
  today: string;
  years: number;
  /** Data that ended before this day was removed. */
  cutoff: string;
  casesAnonymized: number;
  journalNotesDeleted: number;
  journalObservationsDeleted: number;
}

/**
 * Retention of personal data (RODO art. 5 ust. 1 lit. e): anonymizes cases
 * that ended more than RETENTION_YEARS ago and deletes journal entries older
 * than that. Runs at startup and every 24 h (`schedule`, from main.ts) and on
 * demand with `npm run retention`. Logs only counts, never personal data.
 */
@Injectable()
export class RetentionService implements OnApplicationShutdown {
  readonly years: number;
  private timer: NodeJS.Timeout | null = null;
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    config: ConfigService,
    private readonly cases: CasesService,
    @Inject(JournalRepository) private readonly journal: JournalRepository,
  ) {
    this.years = parseRetentionYears(config.get<string>('RETENTION_YEARS'));
  }

  async run(): Promise<RetentionReport> {
    const today = this.cases.today;
    const cutoff = retentionCutoff(today, this.years);
    let casesAnonymized = 0;
    for (const record of this.cases.all()) {
      if (!isPastRetention(record, cutoff)) continue;
      this.cases.save(anonymizeCase(record, today));
      casesAnonymized += 1;
    }
    const journal = await this.journal.deleteOlderThan(cutoff);
    const report: RetentionReport = {
      today,
      years: this.years,
      cutoff,
      casesAnonymized,
      journalNotesDeleted: journal.notes,
      journalObservationsDeleted: journal.observations,
    };
    this.logger.log(
      `Retention ${this.years} years (before ${cutoff}): ${casesAnonymized} cases anonymized, ${journal.notes} notes and ${journal.observations} observations deleted.`,
    );
    return report;
  }

  /** Runs now and then once a day while the app is up. */
  schedule(): void {
    const tick = () =>
      this.run().catch((error: unknown) =>
        this.logger.error(`Retention failed: ${String(error)}`),
      );
    void tick();
    this.timer = setInterval(tick, DAY_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
