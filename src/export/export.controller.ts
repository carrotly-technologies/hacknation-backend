import { Controller, Get, Param, StreamableFile } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator.js';
import { ExportService, type SheetFile } from './export.service.js';
import type { SheetFormat } from './sheet-filename.js';

/** The filled periodic sheet to download or print: who may read the case may download it. */
@ApiTags('export')
@ApiNotFoundResponse({
  description: 'Nie ma takiej sprawy (albo jest niedostępna).',
})
@ApiConflictResponse({
  description: 'Ocena pierwsza nie ma arkusza do pobrania.',
})
@Controller('cases/:id')
export class ExportController {
  constructor(private readonly exports: ExportService) {}

  @Get('sheet.pdf')
  @Roles('SUPERVISOR', 'HR')
  @ApiOperation({
    summary: 'Wypełniony arkusz oceny okresowej (A/B/C) jako PDF',
  })
  @ApiProduces('application/pdf')
  @ApiOkResponse({
    description: 'Plik PDF.',
    schema: { type: 'string', format: 'binary' },
  })
  pdf(@Param('id') id: string): Promise<StreamableFile> {
    return this.file(id, 'pdf');
  }

  @Get('sheet.docx')
  @Roles('SUPERVISOR', 'HR')
  @ApiOperation({ summary: 'Ten sam arkusz jako DOCX (Word, LibreOffice)' })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  )
  @ApiOkResponse({
    description: 'Plik DOCX.',
    schema: { type: 'string', format: 'binary' },
  })
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
