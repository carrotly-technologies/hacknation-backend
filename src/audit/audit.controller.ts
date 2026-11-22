import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator.js';
import { AUDIT_ACTIONS } from './audit-actions.js';
import { type AuditQuery, auditQuerySchema } from './audit.schemas.js';
import { type AuditEntryView, AuditService } from './audit.service.js';
import type { AuditVerification } from './audit.types.js';

export interface AuditListResponse {
  items: AuditEntryView[];
  total: number;
  page: number;
  pageSize: number;
}

/** The event log, read only: there is no route that changes or removes an entry. */
@ApiTags('admin')
@Controller('admin/audit')
@Roles('ADMIN')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({
    summary:
      'Dziennik zdarzeń (kto, co, kiedy): filtry actorId, action, from, to, stronicowanie page/pageSize',
  })
  @ApiOkResponse({
    description: '`{ items, total, page, pageSize }`, najnowsze najpierw.',
  })
  async list(
    @Query({ schema: auditQuerySchema }) query: AuditQuery,
  ): Promise<AuditListResponse> {
    const { page, pageSize, ...filter } = query;
    const { items, total } = await this.audit.list({
      ...filter,
      offset: (page - 1) * pageSize,
      limit: pageSize,
    });
    return { items, total, page, pageSize };
  }

  /** Every action with its Polish name (for the filter). */
  @Get('actions')
  @ApiOperation({
    summary: 'Wszystkie akcje dziennika z polskimi nazwami (do filtra)',
  })
  actions(): readonly { action: string; label: string }[] {
    return AUDIT_ACTIONS;
  }

  @Get('verify')
  @ApiOperation({
    summary:
      'Sprawdzenie integralności łańcucha skrótów: { ok: true, count } albo { ok: false, count, firstBrokenId }',
  })
  verify(): Promise<AuditVerification> {
    return this.audit.verify();
  }
}
