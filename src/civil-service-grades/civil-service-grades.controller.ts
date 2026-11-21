import { Can } from '@nestjs/authorization';
import { Controller, Get } from '@nestjs/common';
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
@Can.Anyone()
@Controller('civil-service-grades')
export class CivilServiceGradesController {
  @Get()
  findAll(): CivilServiceGrades {
    return { grades: CIVIL_SERVICE_GRADES, legalBasis: GRADES_LEGAL_BASIS };
  }
}
