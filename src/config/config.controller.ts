import { Public } from '@nestjs/authentication';
import { Controller, Get } from '@nestjs/common';

export interface AppConfigResponse {
  features: { assistant: boolean };
}

/**
 * Kept for older frontends that read it on start. The FEATURE_ASSISTANT flag
 * was removed: the AI assistant is always on (without an LLM it answers
 * extractively), so `assistant` is always `true`.
 */
const APP_CONFIG: AppConfigResponse = { features: { assistant: true } };

@Public()
@Controller('config')
export class AppConfigController {
  @Get()
  get(): AppConfigResponse {
    return APP_CONFIG;
  }
}
