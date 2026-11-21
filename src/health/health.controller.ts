import { Public } from '@nestjs/authentication';
import { Controller, Get } from '@nestjs/common';

export interface HealthResponse {
  status: 'ok';
}

@Public()
@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return { status: 'ok' };
  }
}
