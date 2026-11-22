import { inflateRawSync } from 'node:zlib';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { loginAs, withToken } from './auth.helpers.js';

/** Collects a binary response body into a Buffer. */
function binary(
  res: request.Response,
  done: (err: Error | null, body: Buffer) => void,
) {
  const stream = res as unknown as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  stream.on('data', (c: Buffer) => chunks.push(c));
  stream.on('end', () => done(null, Buffer.concat(chunks)));
}

/** Reads one entry of a ZIP file through its central directory. */
function zipEntry(zip: Buffer, name: string): string | null {
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) return null;
  const entries = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  for (let i = 0; i < entries; i++) {
    const method = zip.readUInt16LE(p + 10);
    const size = zip.readUInt32LE(p + 20);
    const nameLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30);
    const commentLen = zip.readUInt16LE(p + 32);
    const offset = zip.readUInt32LE(p + 42);
    const entry = zip.toString('utf8', p + 46, p + 46 + nameLen);
    if (entry === name) {
      const start =
        offset +
        30 +
        zip.readUInt16LE(offset + 26) +
        zip.readUInt16LE(offset + 28);
      const data = zip.subarray(start, start + size);
      return (method === 8 ? inflateRawSync(data) : data).toString('utf8');
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

describe('Sheet files: GET /api/cases/:id/sheet.pdf|docx (e2e)', () => {
  let app: INestApplication<App>;
  let supervisor: string;
  let otherSupervisor: string;
  let hr: string;

  beforeAll(async () => {
    process.env.DEMO_TODAY = '2026-11-21';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    supervisor = await loginAs(app, 'j.kaminska');
    otherSupervisor = await loginAs(app, 'r.sikora');
    hr = await loginAs(app, 'a.lis');
    await withToken(app, supervisor).post('/api/demo/reset').expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (token: string, path: string) =>
    withToken(app, token).get(path).buffer(true).parse(binary);

  it('PDF of a signed sheet C: 200, application/pdf, file name, %PDF', async () => {
    const res = await get(supervisor, '/api/cases/c-006/sheet.pdf').expect(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe(
      `attachment; filename="Arkusz-C-Dabrowska-Ewa-2026-11-21.pdf"; filename*=UTF-8''Arkusz-C-D%C4%85browska-Ewa-2026-11-21.pdf`,
    );
    const body = res.body as Buffer;
    expect(body.length).toBeGreaterThan(1000);
    expect(body.subarray(0, 4).toString('latin1')).toBe('%PDF');
    // Tinos (metric-compatible with Times New Roman) is embedded, so Polish
    // letters do not depend on the viewer; a subset font is named XXXXXX+Tinos-*.
    const pdf = body.toString('latin1');
    expect(pdf).toMatch(/\/FontName \/[A-Z]{6}\+Tinos-Regular/);
    expect(pdf).toMatch(/\/FontName \/[A-Z]{6}\+Tinos-Bold/);
    expect(pdf).toMatch(/\/FontFile2 /);
    expect(pdf).not.toContain('OpenSans');
  });

  it('DOCX of a signed sheet C: a ZIP with word/document.xml and the filled data', async () => {
    const res = await get(supervisor, '/api/cases/c-006/sheet.docx').expect(
      200,
    );
    expect(res.headers['content-type']).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(res.headers['content-disposition']).toContain(
      'filename="Arkusz-C-Dabrowska-Ewa-2026-11-21.docx"',
    );
    const body = res.body as Buffer;
    expect(body.subarray(0, 2).toString('latin1')).toBe('PK');
    const xml = zipEntry(body, 'word/document.xml');
    expect(xml).not.toBeNull();
    // Times New Roman everywhere: 12 pt text by default, no other font.
    expect(xml).toContain('w:rFonts w:ascii="Times New Roman"');
    expect(xml).not.toMatch(/w:ascii="(?!Times New Roman")/);
    expect(xml).toContain('<w:sz w:val="24"/>');
    const styles = zipEntry(body, 'word/styles.xml');
    expect(styles).toContain('w:ascii="Times New Roman"');
    expect(styles).toContain('<w:sz w:val="24"/>');
    const detail = await withToken(app, supervisor)
      .get('/api/cases/c-006')
      .expect(200);
    const [y, m, d] = (detail.body.assessmentTalkOn as string).split('-');
    for (const text of [
      'ARKUSZ C',
      'Załącznik nr 4',
      'NAZWA URZĘDU',
      'Dąbrowska',
      'Kamińska',
      'DATA PRZEPROWADZENIA ROZMOWY OCENIAJĄCEJ',
      `${d}.${m}.${y}`, // the assessment talk (assessmentTalkOn)
      'Średnia arytmetyczna',
      '6,33',
      'powyżej oczekiwań',
      'POZYTYWNA',
      'UZASADNIENIE PRZYZNANEJ OCENY OKRESOWEJ',
      'WNIOSKI DOTYCZĄCE INDYWIDUALNEGO PROGRAMU ROZWOJU ZAWODOWEGO',
      'Pouczenie',
      'art. 83 ust. 1',
      '/podpisano elektronicznie/',
    ]) {
      expect(xml).toContain(text);
    }
    // Part III is not printed without the request (attached: NO).
    expect(xml).not.toContain('CZĘŚĆ III');
    expect(xml).not.toContain('WERSJA ROBOCZA');
  });

  it('before the evaluator signs: "-wersja-robocza" in the name and "WERSJA ROBOCZA" in the header', async () => {
    const pdf = await get(supervisor, '/api/cases/c-001/sheet.pdf').expect(200);
    expect(pdf.headers['content-disposition']).toContain(
      'filename="Arkusz-C-Nowak-Anna-2026-11-21-wersja-robocza.pdf"',
    );
    const docx = await get(supervisor, '/api/cases/c-001/sheet.docx').expect(
      200,
    );
    expect(docx.headers['content-disposition']).toContain(
      'filename="Arkusz-C-Nowak-Anna-2026-11-21-wersja-robocza.docx"',
    );
    expect(zipEntry(docx.body as Buffer, 'word/header1.xml')).toContain(
      'WERSJA ROBOCZA',
    );
  });

  it('HR reads every case, so it downloads too', async () => {
    await get(hr, '/api/cases/c-006/sheet.pdf').expect(200);
  });

  it('403 for another supervisor’s case, 404 for an unknown case, 401 without sign-in', async () => {
    await withToken(app, otherSupervisor)
      .get('/api/cases/c-006/sheet.pdf')
      .expect(403);
    await withToken(app, otherSupervisor)
      .get('/api/cases/c-006/sheet.docx')
      .expect(403);
    const missing = await withToken(app, supervisor)
      .get('/api/cases/c-999/sheet.docx')
      .expect(404);
    expect(missing.body.message).toContain('c-999');
    await request(app.getHttpServer())
      .get('/api/cases/c-006/sheet.pdf')
      .expect(401);
  });

  it('409 with a Polish explanation for the first assessment (no file yet)', async () => {
    const res = await withToken(app, supervisor)
      .get('/api/cases/c-004/sheet.pdf')
      .expect(409);
    expect(res.body.message).toContain('arkusza oceny okresowej');
  });
});
