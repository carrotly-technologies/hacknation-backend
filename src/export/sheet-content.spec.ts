import { toDetail } from '../cases/case-view.js';
import { buildSeed, EVALUATORS, OFFICE_NAME } from '../cases/seed/seed.data.js';
import { COMPETENCY_MODEL } from '../competency-model/data/model.data.js';
import { SHEETS } from '../sheets/sheets.data.js';
import {
  type Block,
  buildSheetContent,
  type Cell,
  type Inline,
  type SheetContent,
} from './sheet-content.js';

const TODAY = '2026-11-21';

function content(
  caseId: string,
  change: (d: ReturnType<typeof toDetail>) => void = () => {},
): SheetContent {
  const record = buildSeed(TODAY).find((c) => c.id === caseId)!;
  const evaluator = EVALUATORS.find((e) => e.id === record.evaluatorId)!;
  const detail = toDetail(record, TODAY, evaluator, OFFICE_NAME);
  change(detail);
  const sheet = SHEETS.find((s) => s.id === detail.sheetId)!;
  return buildSheetContent({
    detail,
    sheet,
    template: sheet.template!,
    competencyName: (id) =>
      COMPETENCY_MODEL.competencies.find((c) => c.id === id)?.name ?? id,
    scaleLabel: (p) =>
      COMPETENCY_MODEL.scale.find((s) => s.points === p)?.label ?? '',
    place: 'Miasto',
  });
}

const text = (inline: Inline) =>
  typeof inline === 'string' ? inline : inline.map((r) => r.text).join('');

/** Every text of the sheet, in order. */
function allText(sheet: SheetContent): string {
  const cell = (c: Cell) => text(c.content);
  const block = (b: Block): string[] => {
    switch (b.kind) {
      case 'annex':
      case 'part':
      case 'heading':
        return [b.text];
      case 'title':
        return b.lines;
      case 'paragraph':
        return [text(b.content)];
      case 'textBox':
        return [b.text];
      case 'table':
        return b.rows.flat().map(cell);
      case 'signatures':
        return b.cells.flatMap((c) => [c.value, c.caption]);
      case 'pageBreak':
        return [];
    }
  };
  return sheet.blocks.flatMap(block).join('\n');
}

describe('buildSheetContent', () => {
  it('a signed sheet C: template texts, data, X marks, signatures; no draft, no part III', () => {
    const sheet = content('c-006');
    const all = allText(sheet);
    expect(sheet.draft).toBe(false);
    expect(sheet.title).toBe('Arkusz C oceny okresowej: Ewa Dąbrowska');
    for (const expected of [
      'Załącznik nr 4',
      'ARKUSZ C',
      'CZĘŚĆ I',
      'CZĘŚĆ II',
      OFFICE_NAME,
      'Dąbrowska',
      'Wiśniewska',
      'DATA PRZEPROWADZENIA ROZMOWY OCENIAJĄCEJ',
      'Średnia arytmetyczna z ocen cząstkowych przyznanych za poszczególne kryteria oceny: 6,33',
      'powyżej 6 punktów do 8 punktów',
      'od 1 punktu do 2 punktów',
      'POZYTYWNA  [X]',
      'NEGATYWNA  [  ]',
      'NIE  [X]',
      'Pouczenie',
      'art. 83 ust. 1',
      'Miasto',
      '/podpisano elektronicznie/',
      'Ewa Dąbrowska',
    ]) {
      expect(all).toContain(expected);
    }
    expect(all).not.toContain('CZĘŚĆ III');
  });

  it('marks the level of the average with X in "PRZYZNANIE OCENY"', () => {
    const award = content('c-006').blocks.find(
      (b): b is Extract<Block, { kind: 'table' }> =>
        b.kind === 'table' && text(b.rows[0][0].content) === 'PRZYZNANIE OCENY',
    )!;
    const marked = award.rows
      .filter((row) => row.length === 3 && text(row[0].content) === 'X')
      .map((row) => text(row[2].content));
    expect(marked).toEqual(['powyżej oczekiwań']);
  });

  it('before the evaluator signs: draft, empty signature fields', () => {
    const sheet = content('c-001');
    expect(sheet.draft).toBe(true);
    const evaluatorSignature = sheet.blocks.filter(
      (b): b is Extract<Block, { kind: 'signatures' }> =>
        b.kind === 'signatures',
    )[2];
    expect(evaluatorSignature.cells.map((c) => c.value)).toEqual(['', '', '']);
  });

  it('prints part III with the request of art. 89 ust. 1 when it is attached', () => {
    const all = allText(
      content('c-006', (d) => {
        d.promotionRequest = {
          attached: 'YES',
          appointedYear: 2015,
          currentGrade: 'III',
          gradeGrantedOn: '2020-03-02',
          requestedGrade: 'IV',
          motivation: 'Uzasadnienie wniosku.',
        };
      }),
    );
    expect(all).toContain('CZĘŚĆ III');
    expect(all).toContain('art. 89 ust. 1');
    expect(all).toContain('02.03.2020');
    expect(all).toContain('Uzasadnienie wniosku.');
  });
});
