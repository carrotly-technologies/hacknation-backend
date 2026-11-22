import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import { MUTATING_METHODS } from './audit-actions.js';
import {
  type AuditableRequest,
  isAudited,
  resultOfStatus,
} from './audit-request.js';
import { AuditService } from './audit.service.js';

/**
 * Records a data-changing request that a guard refused before any
 * interceptor ran (a signed-in user calling a route of another role), once
 * the response is sent. Anonymous refusals (401) are not logged: failed
 * sign-ins are recorded by the login route, the rest is noise.
 */
@Injectable()
export class AuditMiddleware implements NestMiddleware {
  constructor(private readonly audit: AuditService) {}

  use(req: AuditableRequest, res: Response, next: NextFunction): void {
    if (MUTATING_METHODS.has(req.method)) {
      res.on('finish', () => {
        if (isAudited(req) || !req.user || res.statusCode < 400) return;
        void this.audit.recordRequest(req, resultOfStatus(res.statusCode));
      });
    }
    next();
  }
}
