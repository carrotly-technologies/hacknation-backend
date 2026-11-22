import { Can } from '@nestjs/authorization';
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CompetencyModelService } from './competency-model.service.js';
import type { CompetencyModel } from './competency-model.types.js';

@ApiTags('competency-model')
@Can.Anyone()
@Controller('competency-model')
export class CompetencyModelController {
  constructor(private readonly competencyModel: CompetencyModelService) {}

  @Get()
  @ApiOperation({
    summary:
      'Model kompetencji: kompetencje, wskaźniki z opisami poziomów, skala',
  })
  @ApiOkResponse({ description: 'Model kompetencji.' })
  get(): CompetencyModel {
    return this.competencyModel.getModel();
  }
}
