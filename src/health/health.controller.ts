import { Public } from '@nestjs/authentication';
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

export interface HealthResponse {
  status: 'ok';
}

/** Probed by Docker and the proxy: never rate limited. */
@ApiTags('health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Sprawdzenie, czy aplikacja działa' })
  @ApiOkResponse({
    description: 'Aplikacja działa.',
    schema: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['ok'] } },
      required: ['status'],
    },
  })
  check(): HealthResponse {
    return { status: 'ok' };
  }
}
