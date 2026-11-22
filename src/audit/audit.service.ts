import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { UsersRepository } from '../auth/users.repository.js';
import {
  auditActionLabel,
  auditResourceLabel,
  changedFieldsOf,
  describeRoute,
} from './audit-actions.js';
import { verifyEntries, type ChainTip } from './audit-chain.js';
import { type AuditableRequest, auditResourceIdOf } from './audit-request.js';
import { AuditRepository } from './audit.repository.js';
import type {
  AuditDraft,
  AuditEntry,
  AuditFilter,
  AuditResult,
  AuditVerification,
} from './audit.types.js';

/** An entry as GET /api/admin/audit returns it: names resolved at read time. */
export interface AuditEntryView extends AuditEntry {
  /** Full name of the account now; null for no actor or a removed account. */
  actorName: string | null;
  actionLabel: string;
  resourceTypeLabel: string | null;
}

const VERIFY_BATCH = 1000;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly repo: AuditRepository,
    private readonly users: UsersRepository,
  ) {}

  /**
   * Appends an entry. A failed write is logged (without the entry: it holds
   * an IP) and does not fail the request, whose change is already done.
   */
  async record(fields: Omit<AuditDraft, 'id' | 'at'>): Promise<void> {
    const draft: AuditDraft = { id: randomUUID(), ...fields };
    try {
      await this.repo.append(draft);
    } catch (error) {
      this.logger.error(
        `Could not write the audit entry ${draft.action} (${(error as Error)?.name ?? 'Error'}).`,
      );
    }
  }

  /** The entry of a data-changing request, from its route (audit-actions.ts). */
  async recordRequest(
    req: AuditableRequest,
    result: AuditResult,
    response?: unknown,
  ): Promise<void> {
    const routePath = (req.route as { path?: string } | undefined)?.path;
    if (!routePath) return;
    const spec = describeRoute(req.method, routePath);
    if (spec === 'SKIP' || spec === 'EXPLICIT') return;
    const user = req.user ?? null;
    const viaLink = spec.actor === 'ASSESSED_VIA_LINK';
    const params = (req.params ?? {}) as Record<string, string | undefined>;
    await this.record({
      actorId: viaLink ? null : (user?.id ?? null),
      actorRole: viaLink ? 'ASSESSED_VIA_LINK' : (user?.role ?? null),
      action:
        typeof spec.action === 'function'
          ? spec.action(req.body as unknown)
          : spec.action,
      resourceType: spec.resourceType,
      resourceId:
        spec.resourceId?.(params, response) ?? auditResourceIdOf(req) ?? null,
      changedFields: changedFieldsOf(req.body as unknown),
      ip: req.ip ?? null,
      result,
    });
  }

  async list(
    filter: AuditFilter,
  ): Promise<{ items: AuditEntryView[]; total: number }> {
    const page = await this.repo.query(filter);
    const names = new Map(
      (await this.users.list()).map((u) => [
        u.id,
        `${u.firstName} ${u.lastName}`,
      ]),
    );
    return {
      total: page.total,
      items: page.items.map((e) => ({
        ...e,
        actorName: e.actorId ? (names.get(e.actorId) ?? null) : null,
        actionLabel: auditActionLabel(e.action),
        resourceTypeLabel: auditResourceLabel(e.resourceType),
      })),
    };
  }

  /** Walks the whole chain, page by page. */
  async verify(): Promise<AuditVerification> {
    let tip: ChainTip | null = null;
    let count = 0;
    for (;;) {
      const batch = await this.repo.chain(tip?.seq ?? 0, VERIFY_BATCH);
      if (batch.length === 0) return { ok: true, count };
      const checked = verifyEntries(batch, tip);
      if ('brokenId' in checked) {
        return {
          ok: false,
          count: count + checked.validBefore,
          firstBrokenId: checked.brokenId,
        };
      }
      count += batch.length;
      tip = checked.tip;
    }
  }
}
