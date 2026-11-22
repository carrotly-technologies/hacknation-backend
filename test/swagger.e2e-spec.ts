import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { loginAs } from './auth.helpers.js';

interface Operation {
  tags?: string[];
  summary?: string;
  security?: Record<string, string[]>[];
  responses: Record<string, { description: string }>;
  requestBody?: {
    content: {
      'application/json': {
        schema: { properties: Record<string, unknown>; required?: string[] };
      };
    };
  };
}

interface Spec {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, Operation>>;
  components: { securitySchemes: Record<string, { scheme: string }> };
}

describe('Swagger (e2e)', () => {
  let app: INestApplication<App>;
  let spec: Spec;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication<INestApplication<App>>();
    configureApp(app);
    await app.init();
    const res = await request(app.getHttpServer())
      .get('/api/swagger.json')
      .expect(200)
      .expect('Content-Type', /json/);
    spec = res.body as Spec;
  });

  afterAll(async () => {
    await app.close();
  });

  const operations = () =>
    Object.entries(spec.paths).flatMap(([path, item]) =>
      Object.entries(item).map(([method, op]) => ({ path, method, op })),
    );

  it('GET /api/swagger.json is OpenAPI 3 with the API routes', () => {
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info.title).toBe('Kompas kompetencji API');
    expect(spec.paths['/api/auth/login']?.post).toBeDefined();
    expect(spec.paths['/api/cases']?.get).toBeDefined();
    expect(spec.paths['/api/cases']?.post).toBeDefined();
  });

  it('documents the login body from the zod schema', () => {
    const schema =
      spec.paths['/api/auth/login'].post.requestBody?.content[
        'application/json'
      ].schema;
    expect(Object.keys(schema?.properties ?? {})).toEqual(
      expect.arrayContaining(['login', 'password']),
    );
    expect(schema?.required).toEqual(
      expect.arrayContaining(['login', 'password']),
    );
  });

  it('gives every route a tag and a summary', () => {
    for (const { path, method, op } of operations()) {
      expect(op.tags?.length, `${method} ${path}`).toBeGreaterThan(0);
      expect(op.summary, `${method} ${path}`).toBeTruthy();
    }
  });

  it('requires the bearer token except on public routes', () => {
    expect(spec.components.securitySchemes.bearer.scheme).toBe('bearer');
    expect(spec.paths['/api/me'].get.security).toEqual([{ bearer: [] }]);
    expect(spec.paths['/api/me'].get.responses['401']).toBeDefined();
    for (const [path, method] of [
      ['/api/health', 'get'],
      ['/api/config', 'get'],
      ['/api/auth/login', 'post'],
      ['/api/auth/login-gov/start', 'post'],
      ['/api/auth/login-gov/mock-authorize', 'post'],
      ['/api/auth/login-gov', 'post'],
      ['/api/ack/{token}', 'get'],
      ['/api/ack/{token}', 'post'],
      ['/api/docs/{path}', 'get'],
    ] as const) {
      expect(
        spec.paths[path][method].security,
        `${method} ${path}`,
      ).toBeUndefined();
    }
    // GET /api/docs (the list) needs sign-in, only the files are public.
    expect(spec.paths['/api/docs'].get.security).toEqual([{ bearer: [] }]);
  });

  it('documents 400 for a validated body and 403 for a role', () => {
    const create = spec.paths['/api/cases'].post;
    expect(create.responses['400']).toBeDefined();
    expect(create.responses['403']).toBeDefined();
  });

  it('serves Swagger UI at /api/swagger', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/swagger')
      .expect(200)
      .expect('Content-Type', /html/);
    expect(res.text).toContain('swagger-ui');
  });

  it('the token from POST /api/auth/login opens a protected route', async () => {
    const token = await loginAs(app, 'admin');
    await request(app.getHttpServer()).get('/api/me').expect(401);
    await request(app.getHttpServer())
      .get('/api/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
