import type { ConfigService } from '@nestjs/config';

export interface Features {
  assistant: boolean;
}

const OFF_VALUES = new Set(['false', '0', 'off', 'no']);

/** Parses a boolean flag; unset or unrecognised values fall back to the default. */
export function parseFlag(
  value: string | undefined,
  fallback: boolean,
): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  return !OFF_VALUES.has(value.trim().toLowerCase());
}

/** Feature flags from env. `FEATURE_ASSISTANT` defaults to `true`. */
export function readFeatures(config: ConfigService): Features {
  return {
    assistant: parseFlag(config.get<string>('FEATURE_ASSISTANT'), true),
  };
}
