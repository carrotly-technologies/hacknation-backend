import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CaseRecord, Evaluator } from './case.types.js';
import { isIsoDate } from './dates.js';
import { buildSeed, EVALUATORS } from './seed/seed.data.js';

export const DEFAULT_DEMO_TODAY = '2026-11-21';

/**
 * In-memory store, seeded on startup and by POST /api/demo/reset. "Today" is
 * DEMO_TODAY (config), so every deadline is computed against a fixed date.
 */
@Injectable()
export class CaseStore {
  readonly today: string;
  private cases = new Map<string, CaseRecord>();
  private observationSeq = 0;

  constructor(config: ConfigService) {
    const today = config.get<string>('DEMO_TODAY', DEFAULT_DEMO_TODAY);
    if (!isIsoDate(today)) {
      throw new Error(`DEMO_TODAY must be YYYY-MM-DD (got "${today}").`);
    }
    this.today = today;
    this.reset();
  }

  reset(): void {
    this.cases = new Map(buildSeed(this.today).map((c) => [c.id, c]));
    this.observationSeq = 0;
  }

  all(): CaseRecord[] {
    return [...this.cases.values()];
  }

  find(id: string): CaseRecord | undefined {
    return this.cases.get(id);
  }

  save(record: CaseRecord): void {
    this.cases.set(record.id, record);
  }

  /** Next free id in the seed's pattern (c-001, c-002, …). */
  nextCaseId(): string {
    const max = Math.max(
      0,
      ...this.all().map((c) => Number(/^c-(\d+)$/.exec(c.id)?.[1] ?? 0)),
    );
    return `c-${String(max + 1).padStart(3, '0')}`;
  }

  evaluator(id: string): Evaluator {
    const evaluator = EVALUATORS.find((e) => e.id === id);
    if (!evaluator) throw new Error(`Unknown evaluator ${id}`);
    return evaluator;
  }

  nextObservationId(caseId: string): string {
    this.observationSeq += 1;
    return `${caseId}-obs-new-${this.observationSeq}`;
  }
}
