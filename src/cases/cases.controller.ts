import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Can } from '@nestjs/authorization';
import { Roles } from '../auth/roles.decorator.js';
import type { CaseAction, CaseDetail, CaseSummary } from './case.types.js';
import {
  type ActionInput,
  actionSchema,
  type CreateCase,
  createCaseSchema,
  type ObservationInput,
  observationSchema,
  type PatchCase,
  patchCaseSchema,
} from './cases.schemas.js';
import { DemoReset } from '../demo/demo-reset.service.js';
import { CasesService } from './cases.service.js';

@Controller()
export class CasesController {
  constructor(
    private readonly cases: CasesService,
    private readonly demoReset: DemoReset,
  ) {}

  @Get('me')
  @Can.Anyone()
  me() {
    return this.cases.me();
  }

  @Get('team')
  @Roles('SUPERVISOR')
  team() {
    return this.cases.team();
  }

  @Get('cases')
  @Roles('SUPERVISOR', 'HR')
  list(): CaseSummary[] {
    return this.cases.visibleCases();
  }

  /** New case for a person: their supervisor or HR (`{ personId }`). */
  @Post('cases')
  @Roles('SUPERVISOR', 'HR')
  create(
    @Body({ schema: createCaseSchema }) body: CreateCase,
  ): Promise<CaseDetail> {
    return this.cases.create(body.personId);
  }

  @Get('cases/:id')
  @Roles('SUPERVISOR', 'HR')
  findOne(@Param('id') id: string): Promise<CaseDetail> {
    return this.cases.view(id);
  }

  @Patch('cases/:id')
  @Roles('SUPERVISOR')
  patch(
    @Param('id') id: string,
    @Body({ schema: patchCaseSchema }) body: PatchCase,
  ): Promise<CaseDetail> {
    return this.cases.patch(id, body);
  }

  @Post('cases/:id/observations')
  @Roles('SUPERVISOR')
  addObservation(
    @Param('id') id: string,
    @Body({ schema: observationSchema }) body: ObservationInput,
  ): Promise<CaseDetail> {
    return this.cases.addObservation(id, body);
  }

  @Post('cases/:id/actions')
  @Roles('SUPERVISOR')
  @HttpCode(200)
  action(
    @Param('id') id: string,
    @Body({ schema: actionSchema }) body: ActionInput,
  ): Promise<CaseDetail> {
    return this.cases.action(id, body.action as CaseAction, {
      date: body.date,
    });
  }

  /** Demo tool: only ADMIN and HR may restore the seed (403 for supervisors). */
  @Post('demo/reset')
  @Roles('ADMIN', 'HR')
  @HttpCode(200)
  async reset() {
    this.cases.reset();
    await this.demoReset.run();
    return { ok: true, today: this.cases.today };
  }
}
