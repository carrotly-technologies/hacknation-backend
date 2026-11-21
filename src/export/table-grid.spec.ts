import type { Cell } from './sheet-content.js';
import { cellColumns, toGrid } from './table-grid.js';

const c = (content: string, span: Partial<Cell> = {}): Cell => ({
  content,
  ...span,
});

describe('toGrid / cellColumns', () => {
  it('fills the cells covered by colSpan and rowSpan with null', () => {
    const a = c('a', { colSpan: 3 });
    const b = c('b');
    const due = c('due', { rowSpan: 2 });
    const date = c('date', { rowSpan: 2 });
    const d = c('d');
    const rows = [[a], [b, due, date], [d]];
    expect(toGrid(rows)).toEqual([
      [a, null, null],
      [b, due, date],
      [d, null, null],
    ]);
    expect(cellColumns(rows).map((row) => row.map((x) => x.column))).toEqual([
      [0],
      [0, 1, 2],
      [0],
    ]);
  });
});
