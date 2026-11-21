import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthorizationModule } from '@nestjs/authorization';
import { AckModule } from './ack/ack.module.js';
import { AdminModule } from './admin/admin.module.js';
import { AuthenticationRoot, AuthModule } from './auth/auth.module.js';
import { BrandingModule } from './branding/branding.module.js';
import { AppConfigModule } from './config/app-config.module.js';
import { AssistantModule } from './assistant/assistant.module.js';
import { AssessmentsModule } from './assessments/assessments.module.js';
import { CompetencyModelModule } from './competency-model/competency-model.module.js';
import { CasesModule } from './cases/cases.module.js';
import { CivilServiceGradesModule } from './civil-service-grades/civil-service-grades.module.js';
import { DatabaseModule } from './database/database.module.js';
import { DocsModule } from './docs/docs.module.js';
import { HealthModule } from './health/health.module.js';
import { HrModule } from './hr/hr.module.js';
import { JournalModule } from './journal/journal.module.js';
import { OspModule } from './osp/osp.module.js';
import { SheetsModule } from './sheets/sheets.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule.forRoot(),
    // Guard order: authentication (sets the user) before authorization.
    AuthenticationRoot,
    AuthorizationModule.forRoot(),
    AuthModule,
    HealthModule,
    AppConfigModule,
    CompetencyModelModule,
    SheetsModule,
    CivilServiceGradesModule,
    AssessmentsModule,
    OspModule,
    CasesModule,
    AckModule,
    HrModule,
    AssistantModule,
    DocsModule,
    AdminModule,
    JournalModule,
    BrandingModule,
  ],
})
export class AppModule {}
