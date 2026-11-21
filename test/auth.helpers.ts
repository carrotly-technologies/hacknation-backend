import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';

/** A supertest agent acting as this demo account (`X-User-Id`, src/auth/users.seed.ts). */
export function asUser(app: INestApplication<App>, userId: string) {
  return request.agent(app.getHttpServer()).set('X-User-Id', userId);
}
