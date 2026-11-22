import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication, Type } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import {
  DocumentBuilder,
  type OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger';

/** Swagger UI under the global prefix: /api/swagger, the spec: /api/swagger.json. */
export const SWAGGER_PATH = 'swagger';
export const SWAGGER_JSON_PATH = 'swagger.json';

/** Name of the security scheme of `Authorization: Bearer <JWT>`. */
export const BEARER = 'bearer';

/** Written by `@Public()` of @nestjs/authentication (a registry symbol). */
const AUTHENTICATION_PUBLIC = Symbol.for('@nestjs/authentication:public');

/** Tags of the modules, in the order of the Swagger UI. */
const TAGS: ReadonlyArray<[name: string, description: string]> = [
  ['auth', 'Logowanie i bieżący użytkownik'],
  ['cases', 'Sprawy oceny okresowej i pierwszej (etapy, arkusz, akcje)'],
  ['export', 'Pobieranie wypełnionego arkusza (PDF, DOCX)'],
  ['ack', 'Publiczna strona ocenianego: zapoznanie się z oceną i sprzeciw'],
  ['people', 'Profil pracownika'],
  ['journal', 'Prywatny dziennik przełożonego: notatki i obserwacje S-D-R'],
  ['hr', 'Monitoring HR: przegląd spraw i przypomnienia'],
  ['admin', 'Administracja kontami i rolami'],
  ['assessments', 'Obliczenia oceny: sugestia poziomu i wynik'],
  ['assistant', 'Asystent AI oparty na dokumentach źródłowych'],
  ['docs', 'Dokumenty źródłowe (ustawa, rozporządzenia, poradniki)'],
  ['competency-model', 'Model kompetencji: kompetencje, wskaźniki, skala'],
  ['sheets', 'Arkusze ocen A, B, C i FIRST'],
  ['civil-service-grades', 'Stopnie służbowe I–IX'],
  ['osp', 'Opisy stanowisk pracy (OSP)'],
  ['demo', 'Narzędzia demo'],
  ['config', 'Konfiguracja dla frontendu'],
  ['health', 'Stan aplikacji'],
];

const HTTP_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
] as const;

/** Version of the app, from package.json (next to dist/ and src/). */
function appVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(
        join(import.meta.dirname, '..', '..', 'package.json'),
        'utf8',
      ),
    ) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** Operation ids (`Controller_method`, Swagger's default) of the `@Public()` routes. */
function publicOperationIds(app: INestApplication): Set<string> {
  const ids = new Set<string>();
  for (const module of app.get(ModulesContainer).values()) {
    for (const wrapper of module.controllers.values()) {
      const controller = wrapper.metatype as Type | null;
      if (!controller?.prototype) continue;
      const classPublic = Reflect.getMetadata(
        AUTHENTICATION_PUBLIC,
        controller,
      ) as boolean | undefined;
      for (const key of Object.getOwnPropertyNames(controller.prototype)) {
        if (key === 'constructor') continue;
        const handler: unknown = (
          controller.prototype as Record<string, unknown>
        )[key];
        if (typeof handler !== 'function') continue;
        const methodPublic = Reflect.getMetadata(
          AUTHENTICATION_PUBLIC,
          handler,
        ) as boolean | undefined;
        if (methodPublic ?? classPublic) ids.add(`${controller.name}_${key}`);
      }
    }
  }
  return ids;
}

/**
 * Conventions every route shares, derived from the same metadata the app
 * runs on, so a new route is documented right without extra decorators:
 * - a Bearer token is required, except on `@Public()` routes (the method's
 *   value wins over the class's, as in the guard);
 * - a body validated with `@Body({ schema })` answers 400 when invalid.
 */
function applyConventions(
  document: OpenAPIObject,
  publicIds: ReadonlySet<string>,
): void {
  for (const item of Object.values(document.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = item[method];
      if (!operation) continue;
      const responses = { ...operation.responses };
      if (operation.requestBody && !responses[400]) {
        responses[400] = {
          description: 'Nieprawidłowe dane (komunikaty po polsku w `message`).',
        };
      }
      if (operation.operationId && publicIds.has(operation.operationId)) {
        delete operation.security;
      } else {
        operation.security = [{ [BEARER]: [] }];
        responses[401] ??= {
          description:
            'Brak ważnego tokenu (zaloguj się: POST /api/auth/login, potem „Authorize”).',
        };
      }
      operation.responses = responses;
    }
  }
}

/** The OpenAPI 3 document of the whole API. */
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const builder = new DocumentBuilder()
    .setTitle('Kompas kompetencji API')
    .setDescription(
      'API aplikacji wspierającej ocenę okresową i pierwszą w służbie cywilnej. ' +
        'Zaloguj się przez `POST /api/auth/login` (konta demo w README), skopiuj ' +
        '`accessToken` i wklej go w „Authorize”.',
    )
    .setVersion(appVersion())
    .addBearerAuth(
      {
        type: 'http',
        description: 'Token z POST /api/auth/login (accessToken).',
      },
      BEARER,
    );
  for (const [name, description] of TAGS) builder.addTag(name, description);
  const document = SwaggerModule.createDocument(app, builder.build(), {
    // Tags come from @ApiTags (module names), not from class names.
    autoTagControllers: false,
  });
  applyConventions(document, publicOperationIds(app));
  return document;
}

/** Serves Swagger UI at /api/swagger and the spec at /api/swagger.json. */
export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup(SWAGGER_PATH, app, () => createOpenApiDocument(app), {
    useGlobalPrefix: true,
    jsonDocumentUrl: SWAGGER_JSON_PATH,
    raw: ['json'],
    customSiteTitle: 'Kompas kompetencji API',
    swaggerOptions: { persistAuthorization: true },
  });
}
