import { Can } from '@nestjs/authorization';
import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import type { StageId } from '../cases/case.types.js';
import {
  type AskInput,
  askSchema,
  suggestionsQuerySchema,
} from './assistant.schemas.js';
import { AssistantService } from './assistant.service.js';
import type { AskResponse } from './assistant.types.js';
import { type DocumentListItem, listDocuments } from './documents.js';

@Can.Anyone()
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('ask')
  @HttpCode(200)
  ask(@Body({ schema: askSchema }) body: AskInput): Promise<AskResponse> {
    return this.assistant.ask(body);
  }

  /** The source documents: linked, and whether the assistant answers from them. */
  @Get('documents')
  documents(): DocumentListItem[] {
    return listDocuments();
  }

  @Get('suggestions')
  suggestions(
    @Query('stageId', { schema: suggestionsQuerySchema }) stageId?: StageId,
  ): string[] {
    return this.assistant.suggestions(stageId);
  }
}
