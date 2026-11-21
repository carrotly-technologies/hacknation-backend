import { Module } from '@nestjs/common';
import { DATABASE, type Database } from '../database/database.js';
import { AppSettingsRepository } from './app-settings.repository.js';
import { BrandingController } from './branding.controller.js';
import { BrandingService } from './branding.service.js';
import { InMemoryAppSettingsRepository } from './in-memory-app-settings.repository.js';
import { PostgresAppSettingsRepository } from './postgres-app-settings.repository.js';

@Module({
  controllers: [BrandingController],
  providers: [
    {
      provide: AppSettingsRepository,
      inject: [DATABASE],
      useFactory: (db: Database | null): AppSettingsRepository =>
        db
          ? new PostgresAppSettingsRepository(db)
          : new InMemoryAppSettingsRepository(),
    },
    BrandingService,
  ],
})
export class BrandingModule {}
