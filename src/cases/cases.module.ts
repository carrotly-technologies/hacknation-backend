import { Module } from '@nestjs/common';
import { DemoModule } from '../demo/demo.module.js';
import { CaseStore } from './case-store.service.js';
import { CasesController } from './cases.controller.js';
import { CasesService } from './cases.service.js';

@Module({
  imports: [DemoModule],
  controllers: [CasesController],
  providers: [CaseStore, CasesService],
  exports: [CasesService],
})
export class CasesModule {}
