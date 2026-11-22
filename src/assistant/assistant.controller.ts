import { Can } from '@nestjs/authorization';
import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { StageId } from '../cases/case.types.js';
import {
  type AskInput,
  askSchema,
  STAGE_IDS,
  suggestionsQuerySchema,
} from './assistant.schemas.js';
import { AssistantService } from './assistant.service.js';
import type { AskResponse } from './assistant.types.js';
import { type DocumentListItem, listDocuments } from './documents.js';

@ApiTags('assistant')
@Can.Anyone()
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('ask')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Pytanie do asystenta: odpowiedź na podstawie dokumentów, ze źródłami (opcjonalnie w kontekście sprawy)',
  })
  @ApiOkResponse({ description: 'Odpowiedź i źródła.' })
  ask(@Body({ schema: askSchema }) body: AskInput): Promise<AskResponse> {
    return this.assistant.ask(body);
  }

  /** The source documents: linked, and whether the assistant answers from them. */
  @Get('documents')
  @ApiOperation({ summary: 'Dokumenty źródłowe asystenta' })
  @ApiOkResponse({
    description: 'Dokumenty: tytuł, opis, adres, czy są w bazie wiedzy.',
  })
  documents(): DocumentListItem[] {
    return listDocuments();
  }

  @Get('suggestions')
  @ApiOperation({
    summary: 'Przykładowe pytania do asystenta (dla etapu sprawy)',
  })
  @ApiQuery({
    name: 'stageId',
    required: false,
    enum: STAGE_IDS,
    description: 'Etap sprawy; bez niego ogólne pytania.',
  })
  @ApiOkResponse({
    description: 'Pytania.',
    schema: { type: 'array', items: { type: 'string' } },
  })
  suggestions(
    @Query('stageId', { schema: suggestionsQuerySchema }) stageId?: StageId,
  ): string[] {
    return this.assistant.suggestions(stageId);
  }
}
