import { contentDisposition, sheetFileName } from './sheet-filename.js';

describe('sheetFileName', () => {
  const base = {
    sheetId: 'B',
    lastName: 'Kowalski',
    firstName: 'Jan',
    date: '2026-11-21',
    draft: false,
    format: 'pdf' as const,
  };

  it('Arkusz-{sheet}-{Nazwisko}-{Imię}-{date}.{ext}', () => {
    expect(sheetFileName(base).ascii).toBe(
      'Arkusz-B-Kowalski-Jan-2026-11-21.pdf',
    );
  });

  it('drops Polish letters only in the ASCII name', () => {
    const name = sheetFileName({
      ...base,
      lastName: 'Żółć-Łękawska',
      firstName: 'Małgorzata Anna',
      format: 'docx',
    });
    expect(name.ascii).toBe(
      'Arkusz-B-Zolc-Lekawska-Malgorzata-Anna-2026-11-21.docx',
    );
    expect(name.utf8).toBe(
      'Arkusz-B-Żółć-Łękawska-Małgorzata-Anna-2026-11-21.docx',
    );
  });

  it('adds "-wersja-robocza" before the signature', () => {
    expect(sheetFileName({ ...base, draft: true }).ascii).toBe(
      'Arkusz-B-Kowalski-Jan-2026-11-21-wersja-robocza.pdf',
    );
  });

  it('Content-Disposition has both filename and filename*', () => {
    expect(
      contentDisposition(sheetFileName({ ...base, lastName: 'Dąb' })),
    ).toBe(
      `attachment; filename="Arkusz-B-Dab-Jan-2026-11-21.pdf"; filename*=UTF-8''Arkusz-B-D%C4%85b-Jan-2026-11-21.pdf`,
    );
  });
});
