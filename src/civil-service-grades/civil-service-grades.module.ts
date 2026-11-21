import { Module } from '@nestjs/common';
import { CivilServiceGradesController } from './civil-service-grades.controller.js';

@Module({ controllers: [CivilServiceGradesController] })
export class CivilServiceGradesModule {}
