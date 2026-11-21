import { Can } from '@nestjs/authorization';
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  type EvaluateRequest,
  evaluateSchema,
  type SuggestLevelRequest,
  suggestLevelSchema,
} from './assessments.schemas.js';
import { AssessmentsService } from './assessments.service.js';
import type { EvaluateResult } from './evaluate.rules.js';
import type { SuggestLevelResult } from './suggest-level.rules.js';

@Can.Anyone()
@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly assessments: AssessmentsService) {}

  @Post('suggest-level')
  @HttpCode(200)
  suggestLevel(
    @Body({ schema: suggestLevelSchema }) body: SuggestLevelRequest,
  ): SuggestLevelResult {
    return this.assessments.suggestLevel(body);
  }

  @Post('evaluate')
  @HttpCode(200)
  evaluate(
    @Body({ schema: evaluateSchema }) body: EvaluateRequest,
  ): EvaluateResult {
    return this.assessments.evaluate(body);
  }
}
