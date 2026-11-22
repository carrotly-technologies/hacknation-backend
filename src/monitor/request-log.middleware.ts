import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { User } from '../auth/user.types.js';
import { maskPath, shouldLogApiCall } from './monitor.rules.js';
import { MonitorService } from './monitor.service.js';
import { requestMeta } from './request-meta.js';

/**
 * Logs every /api call (at the time it arrived) once its response is sent (`finish`), so the response
 * is never delayed or changed. The user is the one the authentication guard
 * put on the request (`request.user`); public routes have none.
 */
@Injectable()
export class RequestLogMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLogMiddleware.name);

  constructor(private readonly monitor: MonitorService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const url = req.originalUrl;
    if (shouldLogApiCall(req.method, url)) {
      const at = new Date().toISOString();
      const started = performance.now();
      res.once('finish', () => {
        try {
          const user = (req as Request & { user?: User | null }).user ?? null;
          this.monitor.record({
            ...requestMeta(req),
            at,
            kind: 'API',
            method: req.method,
            path: maskPath(url),
            status: res.statusCode,
            durationMs: Math.round(performance.now() - started),
            userId: user?.id ?? null,
            userName: user?.login ?? null,
          });
        } catch (err) {
          this.logger.warn(`Nie udało się zapisać aktywności: ${String(err)}`);
        }
      });
    }
    next();
  }
}
