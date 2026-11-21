import { Public } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import { createReadStream } from 'node:fs';
import { basename } from 'node:path';
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  StreamableFile,
} from '@nestjs/common';
import {
  type DocumentListItem,
  listDocuments,
} from '../assistant/documents.js';
import { contentType, resolveDocFile } from './docs-files.js';

/**
 * GET /api/docs: the list of source documents; GET /api/docs/<path>: the
 * originals from docs/. Always on, also with FEATURE_ASSISTANT=false. The
 * list needs sign-in; the files are public legal documents linked from
 * answers and opened in a new tab, where no Bearer token can be sent.
 */
@Can.Anyone()
@Controller('docs')
export class DocsController {
  @Get()
  list(): DocumentListItem[] {
    return listDocuments();
  }

  @Get('*path')
  @Public()
  file(@Param('path') path: string | string[]): StreamableFile {
    const rel = Array.isArray(path) ? path.join('/') : path;
    const abs = resolveDocFile(rel);
    if (!abs) throw new NotFoundException('Nie ma takiego dokumentu');
    return new StreamableFile(createReadStream(abs), {
      type: contentType(abs),
      disposition: `inline; filename="${basename(abs)}"`,
    });
  }
}
