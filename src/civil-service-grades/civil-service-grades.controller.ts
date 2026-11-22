import { Can } from '@nestjs/authorization';
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CIVIL_SERVICE_GRADES,
  type CivilServiceGrade,
  GRADES_LEGAL_BASIS,
} from './data/grades.data.js';

export interface CivilServiceGrades {
  grades: readonly CivilServiceGrade[];
  legalBasis: string;
}

/** Grades for part III of sheets A, B and C (the request for the next grade). */
@ApiTags('civil-service-grades')
@Can.Anyone()
@Controller('civil-service-grades')
export class CivilServiceGradesController {
  @Get()
  @ApiOperation({ summary: 'Stopnie służbowe I–IX (art. 86 ust. 1 ustawy)' })
  @ApiOkResponse({ description: 'Stopnie od najniższego i podstawa prawna.' })
  findAll(): CivilServiceGrades {
    return { grades: CIVIL_SERVICE_GRADES, legalBasis: GRADES_LEGAL_BASIS };
  }
}
