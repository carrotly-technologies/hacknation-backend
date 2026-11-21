import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFeatures } from '../config/features.js';

/** Hides every /api/assistant/* route (404) when FEATURE_ASSISTANT=false. */
@Injectable()
export class AssistantEnabledGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(): boolean {
    if (!readFeatures(this.config).assistant) throw new NotFoundException();
    return true;
  }
}
