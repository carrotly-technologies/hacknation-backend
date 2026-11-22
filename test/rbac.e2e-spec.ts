import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { ROLES, type Role } from './../src/auth/user.types.js';
import { USER_SEED } from './../src/auth/users.seed.js';
import { SWAGGER_PATH } from './../src/common/openapi.js';
import { configureApp } from './../src/configure-app.js';
import { loginAs, resetDemo } from './auth.helpers.js';

/** Who may call a route: anyone, any signed-in role, or the listed roles. */
type Access = 'PUBLIC' | 'SIGNED_IN' | readonly Role[];

const SUPERVISOR = ['SUPERVISOR'] as const;
const SUPERVISOR_HR = ['SUPERVISOR', 'HR'] as const;

/**
 * Every route of the API with its roles (the role table in README.md). The
 * test fails when a route is added without a row here, so a new endpoint
 * cannot skip the 401/403 checks.
 */
const MATRIX: Record<string, Access> = {
  'GET /api/health': 'PUBLIC',
  'GET /api/config': 'PUBLIC',
  'POST /api/auth/login': 'PUBLIC',
  'POST /api/auth/logout': 'PUBLIC',
  'POST /api/auth/login-gov/start': 'PUBLIC',
  'POST /api/auth/login-gov/mock-authorize': 'PUBLIC',
  'POST /api/auth/login-gov': 'PUBLIC',
  'POST /api/telemetry/pageview': 'PUBLIC',
  // Behind X-Monitor-Token (MonitorTokenGuard), not a role: 404 without it.
  'GET /api/monitor/sessions': 'PUBLIC',
  'DELETE /api/monitor/sessions': 'PUBLIC',
  'GET /api/monitor/sessions/:sessionId': 'PUBLIC',
  'GET /api/docs/*path': 'PUBLIC',
  'GET /api/ack/:token': 'PUBLIC',
  'POST /api/ack/:token': 'PUBLIC',
  'POST /api/ack/:token/objection': 'PUBLIC',

  'GET /api/me': 'SIGNED_IN',
  'GET /api/docs': 'SIGNED_IN',
  'GET /api/competency-model': 'SIGNED_IN',
  'GET /api/sheets': 'SIGNED_IN',
  'GET /api/civil-service-grades': 'SIGNED_IN',
  'GET /api/osp': 'SIGNED_IN',
  'POST /api/assessments/suggest-level': 'SIGNED_IN',
  'POST /api/assessments/evaluate': 'SIGNED_IN',
  'POST /api/assistant/ask': 'SIGNED_IN',
  'GET /api/assistant/documents': 'SIGNED_IN',
  'GET /api/assistant/suggestions': 'SIGNED_IN',

  'GET /api/team': SUPERVISOR,
  'GET /api/cases': SUPERVISOR_HR,
  'POST /api/cases': SUPERVISOR_HR,
  'GET /api/cases/:id': SUPERVISOR_HR,
  'PATCH /api/cases/:id': SUPERVISOR,
  'POST /api/cases/:id/observations': SUPERVISOR,
  'POST /api/cases/:id/actions': SUPERVISOR,
  'GET /api/cases/:id/sheet.pdf': SUPERVISOR_HR,
  'GET /api/cases/:id/sheet.docx': SUPERVISOR_HR,
  'GET /api/people/:personId': SUPERVISOR_HR,
  'PATCH /api/people/:personId': SUPERVISOR_HR,
  'GET /api/people/:personId/notes': SUPERVISOR,
  'POST /api/people/:personId/notes': SUPERVISOR,
  'PATCH /api/notes/:id': SUPERVISOR,
  'DELETE /api/notes/:id': SUPERVISOR,
  'GET /api/people/:personId/observations': SUPERVISOR,
  'POST /api/people/:personId/observations': SUPERVISOR,
  'PATCH /api/observations/:id': SUPERVISOR,
  'DELETE /api/observations/:id': SUPERVISOR,
  'GET /api/hr/overview': ['HR'],
  'POST /api/hr/reminders': ['HR'],
  'GET /api/admin/users': ['ADMIN'],
  'PATCH /api/admin/users/:id': ['ADMIN'],
  'GET /api/admin/audit': ['ADMIN'],
  'GET /api/admin/audit/actions': ['ADMIN'],
  'GET /api/admin/audit/verify': ['ADMIN'],
  'POST /api/demo/reset': ['ADMIN', 'HR'],
};

/** The method and path of every route the app serves, e.g. `GET /api/cases/:id`. */
function registeredRoutes(app: INestApplication): string[] {
  const express = app.getHttpAdapter().getInstance() as {
    router: {
      stack: {
        route?: { path: string; methods: Record<string, boolean> };
      }[];
    };
  };
  return express.router.stack.flatMap(({ route }) =>
    // Swagger UI and its files (src/common/openapi.ts) are public static pages served outside Nest's router;
    // `/api` with every method is the audit middleware (AuditModule, forRoutes('{*path}')), not a route.
    route &&
    route.path !== '/api' &&
    !route.path.startsWith(`/api/${SWAGGER_PATH}`)
      ? Object.keys(route.methods)
          .filter((m) => m !== '_all')
          .map((m) => `${m.toUpperCase()} ${route.path}`)
      : [],
  );
}

/** A concrete URL for a route pattern; the ids need not exist. */
const urlOf = (path: string) =>
  path
    .replace('*path', 'nie-ma/takiego.pdf')
    .replace(/:(id|personId|token|sessionId)/g, 'nieistniejacy-1');

const send = (
  app: INestApplication<App>,
  route: string,
  token?: string,
): request.Test => {
  const [method, path] = route.split(' ');
  const req = request(app.getHttpServer())[
    method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete'
  ](urlOf(path));
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
};

describe('RBAC: 401 and 403 on every protected route (e2e)', () => {
  let app: INestApplication<App>;
  const tokens = {} as Record<Role, string>;

  beforeAll(async () => {
    process.env.DEMO_TODAY = '2026-11-21';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    // One demo account per role, from the seed (logins may be renamed).
    for (const role of ROLES) {
      const user = USER_SEED.find((u) => u.role === role)!;
      tokens[role] = await loginAs(app, user.login);
    }
  });

  afterAll(async () => {
    await resetDemo(app);
    await app.close();
  });

  const routes = Object.entries(MATRIX);
  const isProtected = ([, access]: [string, Access]) => access !== 'PUBLIC';

  it('lists every route the app serves (add new routes to MATRIX)', () => {
    expect(registeredRoutes(app).sort()).toEqual(Object.keys(MATRIX).sort());
  });

  describe('401 without a token', () => {
    it.each(routes.filter(isProtected))('%s', async (route) => {
      await send(app, route).expect(401);
    });
  });

  describe('401 with a malformed token', () => {
    it.each(routes.filter(isProtected))('%s', async (route) => {
      await send(app, route, 'not.a.jwt').expect(401);
    });
  });

  describe('public routes need no token', () => {
    it.each(routes.filter((r) => !isProtected(r)))('%s', async (route) => {
      const res = await send(app, route);
      expect([401, 403]).not.toContain(res.status);
    });
  });

  const cases = routes.filter(isProtected).flatMap(([route, access]) =>
    ROLES.map((role) => {
      const allowed = access === 'SIGNED_IN' || access.includes(role);
      return [route, role, allowed] as const;
    }),
  );

  describe('403 for a role without access', () => {
    it.each(cases.filter(([, , allowed]) => !allowed))(
      '%s as %s',
      async (route, role) => {
        await send(app, route, tokens[role]).expect(403);
      },
    );
  });

  describe('a permitted role gets past the role check', () => {
    it.each(cases.filter(([, , allowed]) => allowed))(
      '%s as %s',
      async (route, role) => {
        const res = await send(app, route, tokens[role]);
        // 404 / 400 for the made-up ids and empty bodies; never 401 or 403.
        expect([401, 403]).not.toContain(res.status);
      },
    );
  });
});
