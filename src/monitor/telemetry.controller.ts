import { Public } from '@nestjs/authentication';
import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { maskPath } from './monitor.rules.js';
import { type PageviewInput, pageviewSchema } from './monitor.schemas.js';
import { MonitorService } from './monitor.service.js';
import { requestMeta } from './request-meta.js';

/** The frontend reports every screen it shows (route change), without sign-in. */
@ApiTags('telemetry')
@Public()
@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly monitor: MonitorService) {}

  @Post('pageview')
  @HttpCode(204)
  @ApiOperation({ summary: 'Odsłona strony frontendu (dziennik aktywności)' })
  @ApiNoContentResponse({ description: 'Zapisano.' })
  pageview(
    @Body({ schema: pageviewSchema }) body: PageviewInput,
    @Req() req: Request,
  ): void {
    this.monitor.record({
      ...requestMeta(req),
      kind: 'PAGEVIEW',
      method: null,
      path: maskPath(body.path),
      status: null,
      durationMs: null,
      userId: null,
      userName: null,
    });
  }
}
