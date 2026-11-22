import { Public } from '@nestjs/authentication';
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

export interface AppConfigResponse {
  features: { assistant: boolean };
}

/**
 * Kept for older frontends that read it on start. The FEATURE_ASSISTANT flag
 * was removed: the AI assistant is always on (without an LLM it answers
 * extractively), so `assistant` is always `true`.
 */
const APP_CONFIG: AppConfigResponse = { features: { assistant: true } };

@ApiTags('config')
@Public()
@Controller('config')
export class AppConfigController {
  @Get()
  @ApiOperation({
    summary: 'Konfiguracja dla starszych frontendów (asystent zawsze włączony)',
  })
  @ApiOkResponse({
    description: 'Zawsze `{ features: { assistant: true } }`.',
    schema: {
      type: 'object',
      properties: {
        features: {
          type: 'object',
          properties: { assistant: { type: 'boolean' } },
        },
      },
    },
  })
  get(): AppConfigResponse {
    return APP_CONFIG;
  }
}
