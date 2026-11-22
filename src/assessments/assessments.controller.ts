import { Can } from '@nestjs/authorization';
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type EvaluateRequest,
  evaluateSchema,
  type SuggestLevelRequest,
  suggestLevelSchema,
} from './assessments.schemas.js';
import { AssessmentsService } from './assessments.service.js';
import type { EvaluateResult } from './evaluate.rules.js';
import type { SuggestLevelResult } from './suggest-level.rules.js';

@ApiTags('assessments')
@Can.Anyone()
@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly assessments: AssessmentsService) {}

  @Post('suggest-level')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Sugerowana ocena kryterium z ocen wskaźników (tylko sugestia, decyduje przełożony)',
  })
  @ApiOkResponse({ description: 'Sugerowana liczba punktów i uzasadnienie.' })
  suggestLevel(
    @Body({ schema: suggestLevelSchema }) body: SuggestLevelRequest,
  ): SuggestLevelResult {
    return this.assessments.suggestLevel(body);
  }

  @Post('evaluate')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Średnia, poziom i wynik oceny (pozytywna / negatywna) z uzasadnieniem',
  })
  @ApiOkResponse({ description: 'Wynik oceny z powodami cytującymi przepisy.' })
  evaluate(
    @Body({ schema: evaluateSchema }) body: EvaluateRequest,
  ): EvaluateResult {
    return this.assessments.evaluate(body);
  }
}
