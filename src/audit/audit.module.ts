import {
  Global,
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DATABASE, type Database } from '../database/database.js';
import { AuditController } from './audit.controller.js';
import { AuditInterceptor } from './audit.interceptor.js';
import { AuditMiddleware } from './audit.middleware.js';
import { AuditRepository } from './audit.repository.js';
import { AuditService } from './audit.service.js';
import { InMemoryAuditRepository } from './in-memory-audit.repository.js';
import { PostgresAuditRepository } from './postgres-audit.repository.js';

/**
 * Append-only event log (who, what, when) of every data change and sign-in.
 * Global: controllers that write an entry themselves (sign-in) inject
 * AuditService. Not registered with DemoReset: a demo reset adds an entry,
 * it never clears the log.
 */
@Global()
@Module({
  controllers: [AuditController],
  providers: [
    {
      provide: AuditRepository,
      inject: [DATABASE],
      useFactory: (db: Database | null): AuditRepository =>
        db ? new PostgresAuditRepository(db) : new InMemoryAuditRepository(),
    },
    AuditService,
    AuditMiddleware,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditService],
})
export class AuditModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuditMiddleware).forRoutes('{*path}');
  }
}
