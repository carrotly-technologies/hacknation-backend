import { INestApplication, StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { setupSwagger } from './common/openapi.js';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { BodyErrorsFilter } from './security/body-errors.filter.js';
import { readBodyLimit, readTrustProxy } from './security/security.config.js';

export const DEFAULT_FRONTEND_URL = 'http://localhost:5173';

/** Shared app setup, used by main.ts and the e2e tests. */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  const express = app as NestExpressApplication;

  // Behind a reverse proxy the client IP (rate limits, audit and activity
  // logs) comes from X-Forwarded-For, trusted only from TRUST_PROXY.
  express.set('trust proxy', readTrustProxy(config));
  // Bodies over the limit answer 413 before any handler runs.
  const limit = readBodyLimit(config);
  express.useBodyParser('json', { limit });
  express.useBodyParser('urlencoded', { limit, extended: true });

  // Security headers (OWASP ASVS V14.4). No CSP: the API serves JSON and the
  // source documents, not pages; the frontend's nginx sets the CSP.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      // The frontend on another origin opens the document files.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      frameguard: { action: 'deny' },
    }),
  );
  // Answers with personal data are never kept by browsers or proxies
  // (ASVS V8.2.1). The public source documents may be cached.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/api/docs/')) {
      res.setHeader('Cache-Control', 'no-store');
    }
    next();
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.useGlobalFilters(new BodyErrorsFilter(app.getHttpAdapter(), limit));
  app.enableCors({
    origin: config.get<string>('FRONTEND_URL', DEFAULT_FRONTEND_URL),
    // The frontend reads the file name of a downloaded sheet (export module).
    exposedHeaders: ['Content-Disposition'],
  });
  // Swagger UI: /api/swagger, OpenAPI spec: /api/swagger.json (on in production too).
  setupSwagger(app);
}
