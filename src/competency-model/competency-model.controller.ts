import { Can } from '@nestjs/authorization';
import { Controller, Get } from '@nestjs/common';
import { CompetencyModelService } from './competency-model.service.js';
import type { CompetencyModel } from './competency-model.types.js';

@Can.Anyone()
@Controller('competency-model')
export class CompetencyModelController {
  constructor(private readonly competencyModel: CompetencyModelService) {}

  @Get()
  get(): CompetencyModel {
    return this.competencyModel.getModel();
  }
}
