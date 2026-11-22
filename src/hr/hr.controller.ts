import { Roles } from '../auth/roles.decorator.js';
import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  type RemindersInput,
  remindersSchema,
} from '../cases/cases.schemas.js';
import { HrService } from './hr.service.js';

@ApiTags('hr')
@Controller('hr')
@Roles('HR')
export class HrController {
  constructor(private readonly hr: HrService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Przegląd HR: liczniki i wszystkie sprawy w urzędzie',
  })
  @ApiOkResponse({
    description: 'Liczniki i sprawy z oceniającym i przypomnieniami.',
  })
  overview() {
    return this.hr.overview();
  }

  @Post('reminders')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Przypomnienia o terminach (symulowane, zapisane w historii sprawy)',
  })
  @ApiOkResponse({ description: 'Wysłane przypomnienia.' })
  @ApiNotFoundResponse({ description: 'Nieznane sprawy.' })
  remind(@Body({ schema: remindersSchema }) body: RemindersInput) {
    return this.hr.remind(body.caseIds);
  }
}
