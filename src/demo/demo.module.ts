import { Module } from '@nestjs/common';
import { DemoReset } from './demo-reset.service.js';

@Module({
  providers: [DemoReset],
  exports: [DemoReset],
})
export class DemoModule {}
