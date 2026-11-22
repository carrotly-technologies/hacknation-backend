import { Module } from '@nestjs/common';
import { CasesModule } from '../cases/cases.module.js';
import { JournalModule } from '../journal/journal.module.js';
import { RetentionService } from './retention.service.js';

@Module({
  imports: [CasesModule, JournalModule],
  providers: [RetentionService],
  exports: [RetentionService],
})
export class RetentionModule {}
