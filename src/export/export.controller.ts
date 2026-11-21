import { Controller, Get, Param, StreamableFile } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import { ExportService, type SheetFile } from './export.service.js';
import type { SheetFormat } from './sheet-filename.js';

/** The filled periodic sheet to download or print: who may read the case may download it. */
@Controller('cases/:id')
export class ExportController {
  constructor(private readonly exports: ExportService) {}

  @Get('sheet.pdf')
  @Roles('SUPERVISOR', 'HR')
  pdf(@Param('id') id: string): Promise<StreamableFile> {
    return this.file(id, 'pdf');
  }

  @Get('sheet.docx')
  @Roles('SUPERVISOR', 'HR')
  docx(@Param('id') id: string): Promise<StreamableFile> {
    return this.file(id, 'docx');
  }

  private async file(id: string, format: SheetFormat): Promise<StreamableFile> {
    const file: SheetFile = await this.exports.sheet(id, format);
    return new StreamableFile(file.body, {
      type: file.contentType,
      disposition: file.disposition,
      length: file.body.length,
    });
  }
}
