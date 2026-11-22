import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';

/** Password of every demo account (README, src/auth/users.seed.ts). */
export const DEMO_PASSWORD = 'Kompas2026!';

/** Signs in through the real route and returns the bearer token. */
export async function loginAs(
  app: INestApplication<App>,
  login: string,
  password = DEMO_PASSWORD,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ login, password })
    .expect(200);
  return (res.body as { accessToken: string }).accessToken;
}

/** A supertest agent that sends the token with every request. */
export function withToken(app: INestApplication<App>, token: string) {
  return request
    .agent(app.getHttpServer())
    .set('Authorization', `Bearer ${token}`);
}

/** Restores the demo seed as the admin (POST /api/demo/reset is ADMIN/HR only). */
export async function resetDemo(app: INestApplication<App>): Promise<void> {
  const admin = await loginAs(app, 'admin');
  await withToken(app, admin).post('/api/demo/reset').expect(200);
}
