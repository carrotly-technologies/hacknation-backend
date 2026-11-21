import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const DEFAULT_FRONTEND_URL = 'http://localhost:5173';

/** Shared app setup, used by main.ts and the e2e tests. */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config.get<string>('FRONTEND_URL', DEFAULT_FRONTEND_URL),
  });
}
