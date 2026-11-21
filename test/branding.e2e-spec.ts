import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { loginAs, withToken } from './auth.helpers.js';

describe('Branding: the accepted logo (e2e)', () => {
  let app: INestApplication<App>;
  let supervisor: string;
  let hr: string;

  beforeAll(async () => {
    delete process.env.DATABASE_URL;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    supervisor = await loginAs(app, 'j.kaminska');
    hr = await loginAs(app, 'a.lis');
  });

  afterAll(async () => {
    await app.close();
  });

  const anonymous = () => request(app.getHttpServer());

  it('GET is public and has no logo before anyone accepts one', async () => {
    await anonymous()
      .get('/api/branding/logo')
      .expect(200)
      .expect({ logoId: null, acceptedAt: null, acceptedBy: null });
  });

  it('PUT without a token is rejected (401) and changes nothing', async () => {
    await anonymous()
      .put('/api/branding/logo')
      .send({ logoId: '01-igla-w-kole' })
      .expect(401);
    const res = await anonymous().get('/api/branding/logo').expect(200);
    expect(res.body.logoId).toBeNull();
  });

  it('PUT saves the logo with who and when; GET (without a token) returns it', async () => {
    const put = await withToken(app, supervisor)
      .put('/api/branding/logo')
      .send({ logoId: '10-plakietka-z-roza' })
      .expect(200);
    expect(put.body).toEqual({
      logoId: '10-plakietka-z-roza',
      acceptedAt: expect.any(String),
      acceptedBy: { id: 'u-kaminska', name: 'Joanna Kamińska' },
    });
    const get = await anonymous().get('/api/branding/logo').expect(200);
    expect(get.body).toEqual(put.body);
    // the app sends its token with every call: the public GET accepts it too
    const signedIn = await withToken(app, hr)
      .get('/api/branding/logo')
      .expect(200);
    expect(signedIn.body).toEqual(put.body);
  });

  it('any signed-in role may accept; the last choice wins', async () => {
    await withToken(app, hr)
      .put('/api/branding/logo')
      .send({ logoId: '03-roza-wiatrow' })
      .expect(200);
    const get = await anonymous().get('/api/branding/logo').expect(200);
    expect(get.body).toMatchObject({
      logoId: '03-roza-wiatrow',
      acceptedBy: { id: 'u-lis' },
    });
  });

  it.each([
    ['an unknown id', { logoId: '99-nie-ma' }, 'Nie ma propozycji logo'],
    ['no id', {}, 'Wybierz logo'],
    ['a non-string id', { logoId: 1 }, 'Nie ma propozycji logo'],
  ])('400 with a Polish message for %s', async (_name, body, message) => {
    const res = await withToken(app, supervisor)
      .put('/api/branding/logo')
      .send(body)
      .expect(400);
    expect(JSON.stringify(res.body)).toContain(message);
  });

  it('the logo is not demo data: POST /api/demo/reset keeps it', async () => {
    await withToken(app, supervisor)
      .put('/api/branding/logo')
      .send({ logoId: '05-skala-1-9' })
      .expect(200);
    await withToken(app, supervisor).post('/api/demo/reset').expect(200);
    const get = await anonymous().get('/api/branding/logo').expect(200);
    expect(get.body.logoId).toBe('05-skala-1-9');
  });
});
