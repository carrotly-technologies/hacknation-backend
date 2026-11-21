import { Roles } from '../auth/roles.decorator.js';
import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  type RemindersInput,
  remindersSchema,
} from '../cases/cases.schemas.js';
import { HrService } from './hr.service.js';

@Controller('hr')
@Roles('HR')
export class HrController {
  constructor(private readonly hr: HrService) {}

  @Get('overview')
  overview() {
    return this.hr.overview();
  }

  @Post('reminders')
  @HttpCode(200)
  remind(@Body({ schema: remindersSchema }) body: RemindersInput) {
    return this.hr.remind(body.caseIds);
  }
}
