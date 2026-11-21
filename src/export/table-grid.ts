import type { Cell } from './sheet-content.js';

/**
 * HTML-like rows (covered cells left out) to the full grid pdfmake wants,
 * with `null` where a colSpan or rowSpan covers a cell.
 */
export function toGrid(rows: Cell[][]): (Cell | null)[][] {
  const grid: (Cell | null)[][] = rows.map(() => []);
  rows.forEach((row, r) => {
    let c = 0;
    for (const cell of row) {
      while (grid[r][c] !== undefined) c++;
      const colSpan = cell.colSpan ?? 1;
      const rowSpan = cell.rowSpan ?? 1;
      for (let dr = 0; dr < rowSpan; dr++) {
        for (let dc = 0; dc < colSpan; dc++) {
          if (!grid[r + dr]) continue;
          grid[r + dr][c + dc] = dr === 0 && dc === 0 ? cell : null;
        }
      }
      c += colSpan;
    }
  });
  const width = Math.max(...grid.map((row) => row.length));
  return grid.map((row) =>
    Array.from({ length: width }, (_, i) => row[i] ?? null),
  );
}

/** Each row's own cells with the grid column they start in. */
export function cellColumns(
  rows: Cell[][],
): { cell: Cell; column: number }[][] {
  const grid = toGrid(rows);
  return rows.map((row, r) =>
    row.map((cell) => ({ cell, column: grid[r].indexOf(cell) })),
  );
}
