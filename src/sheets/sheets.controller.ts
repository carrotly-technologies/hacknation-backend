import { Can } from '@nestjs/authorization';
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SheetsService } from './sheets.service.js';
import type { Sheet } from './sheet.types.js';

@ApiTags('sheets')
@Can.Anyone()
@Controller('sheets')
export class SheetsController {
  constructor(private readonly sheets: SheetsService) {}

  @Get()
  @ApiOperation({
    summary: 'Arkusze ocen: A, B, C (okresowa) i FIRST (pierwsza)',
  })
  @ApiOkResponse({ description: 'Arkusze z kryteriami.' })
  findAll(): readonly Sheet[] {
    return this.sheets.findAll();
  }
}
