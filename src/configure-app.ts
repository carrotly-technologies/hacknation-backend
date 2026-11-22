import { INestApplication, StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { setupSwagger } from './common/openapi.js';

export const DEFAULT_FRONTEND_URL = 'http://localhost:5173';

/** Shared app setup, used by main.ts and the e2e tests. */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.enableCors({
    origin: config.get<string>('FRONTEND_URL', DEFAULT_FRONTEND_URL),
    // The frontend reads the file name of a downloaded sheet (export module).
    exposedHeaders: ['Content-Disposition'],
  });
  // Swagger UI: /api/swagger, OpenAPI spec: /api/swagger.json (on in production too).
  setupSwagger(app);
}
