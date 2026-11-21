import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Features, readFeatures } from './features.js';

export interface AppConfigResponse {
  features: Features;
}

@Controller('config')
export class AppConfigController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  get(): AppConfigResponse {
    return { features: readFeatures(this.config) };
  }
}
