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
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
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
  @ApiTags('auth')
  @ApiOperation({ summary: 'Zalogowany użytkownik' })
  @ApiOkResponse({ description: 'Dane zalogowanego użytkownika.' })
  me() {
    return this.cases.me();
  }

  @Get('team')
  @Roles('SUPERVISOR')
  @ApiTags('cases')
  @ApiOperation({
    summary: 'Sprawy zespołu przełożonego i lista zadań według terminów',
  })
  @ApiOkResponse({ description: 'Sprawy (`CaseSummary[]`) i `todo`.' })
  team() {
    return this.cases.team();
  }

  @Get('cases')
  @Roles('SUPERVISOR', 'HR')
  @ApiTags('cases')
  @ApiOperation({
    summary:
      'Sprawy widoczne dla użytkownika (przełożony: własne, HR: wszystkie)',
  })
  @ApiOkResponse({ description: 'Sprawy (`CaseSummary[]`).' })
  list(): CaseSummary[] {
    return this.cases.visibleCases();
  }

  /** New case for a person: their supervisor or HR (`{ personId }`). */
  @Post('cases')
  @Roles('SUPERVISOR', 'HR')
  @ApiTags('cases')
  @ApiOperation({ summary: 'Nowa sprawa oceny dla pracownika' })
  @ApiCreatedResponse({ description: 'Nowa sprawa (`CaseDetail`).' })
  @ApiNotFoundResponse({
    description: 'Nieznany pracownik albo spoza zespołu.',
  })
  @ApiConflictResponse({ description: 'Pracownik ma już sprawę w toku.' })
  create(
    @Body({ schema: createCaseSchema }) body: CreateCase,
  ): Promise<CaseDetail> {
    return this.cases.create(body.personId);
  }

  @Get('cases/:id')
  @Roles('SUPERVISOR', 'HR')
  @ApiTags('cases')
  @ApiOperation({
    summary:
      'Szczegóły sprawy: etapy, terminy, OSP, część I, obserwacje, oceny',
  })
  @ApiOkResponse({ description: 'Sprawa (`CaseDetail`).' })
  @ApiNotFoundResponse({
    description: 'Nie ma takiej sprawy (albo jest niedostępna).',
  })
  findOne(@Param('id') id: string): Promise<CaseDetail> {
    return this.cases.view(id);
  }

  @Patch('cases/:id')
  @Roles('SUPERVISOR')
  @ApiTags('cases')
  @ApiOperation({
    summary: 'Częściowa zmiana sprawy (arkusz, część I, oceny, wnioski)',
  })
  @ApiOkResponse({ description: 'Sprawa po zmianie (`CaseDetail`).' })
  @ApiNotFoundResponse({ description: 'Nie ma takiej sprawy.' })
  @ApiConflictResponse({ description: 'Część zablokowana na bieżącym etapie.' })
  patch(
    @Param('id') id: string,
    @Body({ schema: patchCaseSchema }) body: PatchCase,
  ): Promise<CaseDetail> {
    return this.cases.patch(id, body);
  }

  @Post('cases/:id/observations')
  @Roles('SUPERVISOR')
  @ApiTags('cases')
  @ApiOperation({ summary: 'Dodanie obserwacji S-D-R do sprawy' })
  @ApiCreatedResponse({
    description: 'Sprawa z nową obserwacją (`CaseDetail`).',
  })
  @ApiNotFoundResponse({ description: 'Nie ma takiej sprawy.' })
  @ApiConflictResponse({
    description: 'Obserwacje zablokowane na bieżącym etapie.',
  })
  addObservation(
    @Param('id') id: string,
    @Body({ schema: observationSchema }) body: ObservationInput,
  ): Promise<CaseDetail> {
    return this.cases.addObservation(id, body);
  }

  @Post('cases/:id/actions')
  @Roles('SUPERVISOR')
  @HttpCode(200)
  @ApiTags('cases')
  @ApiOperation({
    summary: 'Akcja w procesie oceny (przejście etapu, np. podpisanie oceny)',
  })
  @ApiOkResponse({ description: 'Sprawa po akcji (`CaseDetail`).' })
  @ApiBadRequestResponse({ description: 'Nieprawidłowa akcja albo data.' })
  @ApiNotFoundResponse({ description: 'Nie ma takiej sprawy.' })
  @ApiConflictResponse({
    description:
      'Akcja niedozwolona na bieżącym etapie (z wyjaśnieniem po polsku).',
  })
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
  @ApiTags('demo')
  @ApiOperation({ summary: 'Przywrócenie danych demo (sprawy i dziennik)' })
  @ApiOkResponse({
    description: 'Dane przywrócone.',
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        today: { type: 'string', format: 'date' },
      },
    },
  })
  async reset() {
    this.cases.reset();
    await this.demoReset.run();
    return { ok: true, today: this.cases.today };
  }
}
