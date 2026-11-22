import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pdfmake from 'pdfmake';
import type {
  Content,
  TableCell,
  TDocumentDefinitions,
} from 'pdfmake/interfaces.js';
import {
  type Block,
  type Cell,
  DRAFT_HEADER,
  type Inline,
  SHEET_FONT_SIZE as SIZE,
  type SheetContent,
} from './sheet-content.js';
import { toGrid } from './table-grid.js';

/**
 * Tinos (SIL OFL 1.1, assets/fonts/OFL.txt): metric-compatible with Times New
 * Roman, which is commercial and cannot be embedded. Polish letters in every PDF viewer.
 */
export const FONTS_DIR = resolve(import.meta.dirname, '../../assets/fonts');

const PAGE_WIDTH = 595.28; // A4 in points
const MARGIN = 56.69; // 2 cm, as in the DOCX
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const HEADER_FILL = '#eeeeee';
/** Left and right padding plus the border of a table cell, outside its width. */
const CELL_CHROME = 9;

const FONT_FILES = [
  'Tinos-Regular.ttf',
  'Tinos-Bold.ttf',
  'Tinos-Italic.ttf',
  'Tinos-BoldItalic.ttf',
];

let configured = false;

/**
 * pdfmake's in-memory file system (not in its types, so package.json pins the
 * exact pdfmake version; check this after an upgrade).
 */
interface VirtualFs {
  writeFileSync(name: string, data: Buffer): void;
}

/**
 * pdfmake is a module singleton: fonts are read once from assets/fonts into
 * its virtual file system; every disk and URL access is denied, so a sheet
 * can never pull in anything from the disk or the network.
 */
function configure(): void {
  if (configured) return;
  const vfs = (pdfmake as unknown as { virtualfs: VirtualFs }).virtualfs;
  for (const file of FONT_FILES) {
    vfs.writeFileSync(file, readFileSync(resolve(FONTS_DIR, file)));
  }
  pdfmake.setFonts({
    Tinos: {
      normal: 'Tinos-Regular.ttf',
      bold: 'Tinos-Bold.ttf',
      italics: 'Tinos-Italic.ttf',
      bolditalics: 'Tinos-BoldItalic.ttf',
    },
  });
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy(() => false);
  configured = true;
}

export async function renderSheetPdf(sheet: SheetContent): Promise<Buffer> {
  configure();
  const doc: TDocumentDefinitions = {
    info: { title: sheet.title, creator: 'Kompas Kompetencji' },
    pageSize: 'A4',
    pageMargins: [MARGIN, MARGIN, MARGIN, MARGIN],
    defaultStyle: { font: 'Tinos', fontSize: SIZE.body, lineHeight: 1.15 },
    header: sheet.draft
      ? {
          text: DRAFT_HEADER,
          alignment: 'center',
          bold: true,
          color: '#b00020',
          fontSize: SIZE.small,
          margin: [MARGIN, 24, MARGIN, 0],
        }
      : undefined,
    watermark: sheet.draft
      ? { text: 'WERSJA ROBOCZA', opacity: 0.08, bold: true, fontSize: 60 }
      : undefined,
    footer: (page, pages) => ({
      columns: [
        { text: sheet.footnote, fontSize: SIZE.footer, color: '#666666' },
        {
          text: `Strona ${page} z ${pages}`,
          alignment: 'right',
          fontSize: SIZE.footer,
          width: 80,
        },
      ],
      margin: [MARGIN, 20, MARGIN, 0],
    }),
    content: sheet.blocks.map(toPdf),
  };
  return pdfmake.createPdf(doc).getBuffer();
}

function inline(content: Inline) {
  if (typeof content === 'string') return content;
  return content.map((run) => ({
    text: run.text,
    bold: run.bold,
    italics: run.italic || run.muted,
    color: run.muted ? '#777777' : undefined,
    fontSize: run.muted ? SIZE.small : undefined,
  }));
}

function toPdf(block: Block): Content {
  switch (block.kind) {
    case 'annex':
      return { text: block.text, alignment: 'right', fontSize: SIZE.small };
    case 'title':
      return {
        stack: block.lines.map((line, i) => ({
          text: line,
          bold: true,
          fontSize: i === 0 ? SIZE.title : SIZE.body,
        })),
        alignment: 'center',
        margin: [0, 8, 0, 8],
      };
    case 'part':
      return {
        text: block.text,
        bold: true,
        fontSize: SIZE.title,
        alignment: 'center',
        characterSpacing: 3,
        margin: [0, 6, 0, 6],
      };
    case 'heading':
      return { text: block.text, bold: true, margin: [0, 10, 0, 4] };
    case 'paragraph':
      return {
        text: inline(block.content),
        italics: block.italic,
        alignment: block.align ?? 'left',
        fontSize: block.small ? SIZE.small : undefined,
        margin: [0, 2, 0, 2],
      };
    case 'textBox':
      return {
        table: {
          widths: [CONTENT_WIDTH - CELL_CHROME],
          body: [[{ text: block.text || ' ', margin: [2, 4, 2, 4] }]],
        },
        margin: [0, 0, 0, 6],
      };
    case 'table':
      return {
        table: {
          // The caption row stays with the next one (when it spans no rows); rows never split.
          ...(block.rows[0].some((cell) => (cell.rowSpan ?? 1) > 1)
            ? {}
            : { headerRows: 1, keepWithHeaderRows: 1 }),
          dontBreakRows: true,
          widths: block.widths.map((w) => w * CONTENT_WIDTH - CELL_CHROME),
          body: toGrid(block.rows).map((row) => row.map(toPdfCell)),
        },
        margin: [0, 4, 0, 8],
      };
    case 'signatures':
      return {
        columns: block.cells.map((cell) => ({
          stack: [
            { text: cell.value || ' ', alignment: 'center' },
            {
              canvas: [
                { type: 'line', x1: 0, y1: 2, x2: 110, y2: 2, lineWidth: 0.5 },
              ],
              alignment: 'center',
            },
            {
              text: cell.caption,
              italics: true,
              fontSize: SIZE.small,
              alignment: 'center',
            },
          ],
        })),
        columnGap: 10,
        margin: [0, 6, 0, 6],
        unbreakable: true,
      };
    case 'pageBreak':
      return { text: '', pageBreak: 'after' };
  }
}

function toPdfCell(cell: Cell | null): TableCell {
  if (!cell) return {};
  return {
    text: inline(cell.content),
    colSpan: cell.colSpan,
    rowSpan: cell.rowSpan,
    bold: cell.header,
    fillColor: cell.header ? HEADER_FILL : undefined,
    alignment: cell.align,
    fontSize: cell.small ? SIZE.small : undefined,
    lineHeight: 1, // single spacing in the form's tables, as in the template
  };
}
