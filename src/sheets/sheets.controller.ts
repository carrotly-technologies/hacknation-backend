import { Can } from '@nestjs/authorization';
import { Controller, Get } from '@nestjs/common';
import { SheetsService } from './sheets.service.js';
import type { Sheet } from './sheet.types.js';

@Can.Anyone()
@Controller('sheets')
export class SheetsController {
  constructor(private readonly sheets: SheetsService) {}

  @Get()
  findAll(): readonly Sheet[] {
    return this.sheets.findAll();
  }
}
