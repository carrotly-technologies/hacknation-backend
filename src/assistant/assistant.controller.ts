import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { StageId } from '../cases/case.types.js';
import {
  type AskInput,
  askSchema,
  suggestionsQuerySchema,
} from './assistant.schemas.js';
import { AssistantEnabledGuard } from './assistant-enabled.guard.js';
import { AssistantService } from './assistant.service.js';
import type { AskResponse } from './assistant.types.js';

@Controller('assistant')
@UseGuards(AssistantEnabledGuard)
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('ask')
  @HttpCode(200)
  ask(@Body({ schema: askSchema }) body: AskInput): Promise<AskResponse> {
    return this.assistant.ask(body);
  }

  @Get('suggestions')
  suggestions(
    @Query('stageId', { schema: suggestionsQuerySchema }) stageId?: StageId,
  ): string[] {
    return this.assistant.suggestions(stageId);
  }
}
