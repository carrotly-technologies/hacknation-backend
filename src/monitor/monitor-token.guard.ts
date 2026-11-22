import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { tokenMatches } from './monitor.rules.js';

/**
 * The monitor opens only with `X-Monitor-Token` equal to MONITOR_TOKEN
 * (compared in constant time). Otherwise, and whenever MONITOR_TOKEN is not
 * set, the route answers like one that does not exist (404). Accounts and
 * roles play no part: a signed-in ADMIN gets 404 too.
 */
@Injectable()
export class MonitorTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const expected = this.config.get<string>('MONITOR_TOKEN')?.trim();
    if (tokenMatches(req.headers['x-monitor-token'], expected)) return true;
    throw new NotFoundException(`Cannot ${req.method} ${req.originalUrl}`);
  }
}
