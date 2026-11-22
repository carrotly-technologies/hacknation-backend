import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { DATABASE, type Database } from '../database/database.js';
import { InMemoryRequestLogRepository } from './in-memory-request-log.repository.js';
import { MonitorTokenGuard } from './monitor-token.guard.js';
import { MonitorController } from './monitor.controller.js';
import { MonitorService } from './monitor.service.js';
import { PostgresRequestLogRepository } from './postgres-request-log.repository.js';
import { RequestLogMiddleware } from './request-log.middleware.js';
import { RequestLogRepository } from './request-log.repository.js';
import { TelemetryController } from './telemetry.controller.js';

/** Activity log of every /api call and frontend pageview, and its viewer. */
@Module({
  controllers: [MonitorController, TelemetryController],
  providers: [
    {
      provide: RequestLogRepository,
      inject: [DATABASE],
      useFactory: (db: Database | null): RequestLogRepository =>
        db
          ? new PostgresRequestLogRepository(db)
          : new InMemoryRequestLogRepository(),
    },
    MonitorService,
    MonitorTokenGuard,
    RequestLogMiddleware,
  ],
})
export class MonitorModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLogMiddleware).forRoutes('*');
  }
}
