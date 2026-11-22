import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { catchError, concatMap, from, type Observable } from 'rxjs';
import { MUTATING_METHODS } from './audit-actions.js';
import {
  type AuditableRequest,
  markAudited,
  resultOfStatus,
  statusOf,
} from './audit-request.js';
import { AuditService } from './audit.service.js';

/**
 * Global (APP_INTERCEPTOR): writes one entry per POST/PUT/PATCH/DELETE that
 * reached its handler, after the handler and before the response, so a
 * change the client saw is already in the log. Guard refusals (403 for the
 * wrong role) never reach an interceptor: AuditMiddleware records those.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<AuditableRequest>();
    if (!MUTATING_METHODS.has(req.method)) return next.handle();
    markAudited(req);
    const res = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      concatMap((body) =>
        from(
          this.audit
            .recordRequest(req, resultOfStatus(res.statusCode), body)
            .then(() => body),
        ),
      ),
      catchError((error: unknown) =>
        from(
          this.audit
            .recordRequest(req, resultOfStatus(statusOf(error)))
            .then(() => {
              throw error;
            }),
        ),
      ),
    );
  }
}
