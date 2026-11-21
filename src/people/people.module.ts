import { Module } from '@nestjs/common';
import { CasesModule } from '../cases/cases.module.js';
import { PeopleController } from './people.controller.js';
import { PeopleService } from './people.service.js';

@Module({
  imports: [CasesModule],
  controllers: [PeopleController],
  providers: [PeopleService],
})
export class PeopleModule {}
