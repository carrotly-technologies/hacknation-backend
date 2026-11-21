import { Module } from '@nestjs/common';
import { CasesModule } from '../cases/cases.module.js';
import { CompetencyModelModule } from '../competency-model/competency-model.module.js';
import { SheetsModule } from '../sheets/sheets.module.js';
import { ExportController } from './export.controller.js';
import { ExportService } from './export.service.js';

/** Downloadable sheet files (PDF via pdfmake, DOCX via docx); no state of its own. */
@Module({
  imports: [CasesModule, SheetsModule, CompetencyModelModule],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
