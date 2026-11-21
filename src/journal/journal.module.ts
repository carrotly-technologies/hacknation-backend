import { Module } from '@nestjs/common';
import { CasesModule } from '../cases/cases.module.js';
import { DemoModule } from '../demo/demo.module.js';
import { DATABASE, type Database } from '../database/database.js';
import { InMemoryJournalRepository } from './in-memory-journal.repository.js';
import { JournalController } from './journal.controller.js';
import { JournalRepository } from './journal.repository.js';
import { JournalService } from './journal.service.js';
import { PostgresJournalRepository } from './postgres-journal.repository.js';

@Module({
  imports: [CasesModule, DemoModule],
  controllers: [JournalController],
  providers: [
    {
      provide: JournalRepository,
      inject: [DATABASE],
      useFactory: (db: Database | null): JournalRepository =>
        db
          ? new PostgresJournalRepository(db)
          : new InMemoryJournalRepository(),
    },
    JournalService,
  ],
})
export class JournalModule {}
