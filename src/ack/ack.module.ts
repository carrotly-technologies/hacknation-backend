import { Module } from '@nestjs/common';
import { CasesModule } from '../cases/cases.module.js';
import { CompetencyModelModule } from '../competency-model/competency-model.module.js';
import { SheetsModule } from '../sheets/sheets.module.js';
import { AckController } from './ack.controller.js';
import { AckService } from './ack.service.js';

@Module({
  imports: [CasesModule, SheetsModule, CompetencyModelModule],
  controllers: [AckController],
  providers: [AckService],
})
export class AckModule {}
