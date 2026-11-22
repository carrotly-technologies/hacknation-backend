import { Public } from '@nestjs/authentication';
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

export interface HealthResponse {
  status: 'ok';
}

@ApiTags('health')
@Public()
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
