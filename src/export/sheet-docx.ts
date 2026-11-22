import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import {
  type Block,
  type Cell,
  DRAFT_HEADER,
  type Inline,
  SHEET_FONT_SIZE,
  type SheetContent,
} from './sheet-content.js';
import { cellColumns } from './table-grid.js';

/**
 * Times New Roman, as in every Polish official letter: present in Word on
 * Windows and macOS; LibreOffice on Linux uses the metric-compatible
 * Liberation Serif (or Tinos, embedded in the PDF). All have every Polish letter.
 */
const FONT = 'Times New Roman';
/** Half-points, the same sizes as in the PDF. */
const half = (pt: number) => pt * 2;
const SIZE = half(SHEET_FONT_SIZE.body);
const TITLE = half(SHEET_FONT_SIZE.title);
const SMALL = half(SHEET_FONT_SIZE.small);
const FOOTER = half(SHEET_FONT_SIZE.footer);
/** Line spacing 1.15 (240 = single). */
const LINE = 276;
// A4 in twentieths of a point, 2 cm margins.
const PAGE = { width: 11906, height: 16838, margin: 1134 };
const CONTENT_WIDTH = PAGE.width - 2 * PAGE.margin;
const HEADER_FILL = 'EEEEEE';

export function renderSheetDocx(sheet: SheetContent): Promise<Buffer> {
  const doc = new Document({
    creator: 'Kompas Kompetencji',
    title: sheet.title,
    styles: {
      default: {
        document: {
          run: { font: FONT, size: SIZE },
          paragraph: { spacing: { line: LINE } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE.width, height: PAGE.height },
            margin: {
              top: PAGE.margin,
              bottom: PAGE.margin,
              left: PAGE.margin,
              right: PAGE.margin,
            },
          },
        },
        headers: sheet.draft
          ? {
              default: new Header({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        font: FONT,
                        text: DRAFT_HEADER,
                        bold: true,
                        color: 'B00020',
                        size: SMALL,
                      }),
                    ],
                  }),
                ],
              }),
            }
          : undefined,
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    font: FONT,
                    text: sheet.footnote,
                    size: FOOTER,
                    color: '666666',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    font: FONT,
                    children: [
                      'Strona ',
                      PageNumber.CURRENT,
                      ' z ',
                      PageNumber.TOTAL_PAGES,
                    ],
                    size: FOOTER,
                  }),
                ],
              }),
            ],
          }),
        },
        children: sheet.blocks.flatMap(toDocx),
      },
    ],
  });
  return Packer.toBuffer(doc);
}

function runs(
  content: Inline,
  base: { bold?: boolean; italics?: boolean; size?: number } = {},
): TextRun[] {
  if (typeof content === 'string')
    return [
      new TextRun({
        font: FONT,
        text: content,
        ...base,
        size: base.size ?? SIZE,
      }),
    ];
  return content.map(
    (run) =>
      new TextRun({
        font: FONT,
        ...base,
        text: run.text,
        bold: run.bold ?? base.bold,
        italics: run.italic || run.muted || base.italics,
        color: run.muted ? '777777' : undefined,
        size: run.muted ? SMALL : (base.size ?? SIZE),
      }),
  );
}

function toDocx(block: Block): (Paragraph | Table)[] {
  switch (block.kind) {
    case 'annex':
      return [
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: runs(block.text, { size: SMALL }),
        }),
      ];
    case 'title':
      return block.lines.map(
        (line, i) =>
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: i === 0 ? 160 : 0, after: 160 },
            children: runs(line, { bold: true, size: i === 0 ? TITLE : SIZE }),
          }),
      );
    case 'part':
      return [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 120, after: 120 },
          children: [
            new TextRun({
              font: FONT,
              text: block.text,
              bold: true,
              size: TITLE,
              characterSpacing: 60,
            }),
          ],
        }),
      ];
    case 'heading':
      return [
        new Paragraph({
          spacing: { before: 200, after: 80 },
          keepNext: true,
          children: runs(block.text, { bold: true }),
        }),
      ];
    case 'paragraph':
      return [
        new Paragraph({
          alignment:
            block.align === 'center'
              ? AlignmentType.CENTER
              : AlignmentType.LEFT,
          spacing: { before: 40, after: 40 },
          children: runs(block.content, {
            italics: block.italic,
            size: block.small ? SMALL : undefined,
          }),
        }),
      ];
    case 'textBox':
      return [
        table([1], [[{ content: block.text || ' ' }]]),
        new Paragraph({ children: [] }),
      ];
    case 'table':
      return [table(block.widths, block.rows), new Paragraph({ children: [] })];
    case 'signatures':
      return [signatures(block.cells), new Paragraph({ children: [] })];
    case 'pageBreak':
      return [new Paragraph({ pageBreakBefore: true, children: [] })];
  }
}

function table(widths: number[], rows: Cell[][]): Table {
  const columnWidths = widths.map((w) => Math.round(w * CONTENT_WIDTH));
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths,
    rows: cellColumns(rows).map(
      (row) =>
        new TableRow({
          cantSplit: true,
          children: row.map(
            ({ cell, column }) =>
              new TableCell({
                columnSpan: cell.colSpan,
                rowSpan: cell.rowSpan,
                width: {
                  size: columnWidths
                    .slice(column, column + (cell.colSpan ?? 1))
                    .reduce((a, b) => a + b, 0),
                  type: WidthType.DXA,
                },
                shading: cell.header
                  ? {
                      type: ShadingType.CLEAR,
                      fill: HEADER_FILL,
                      color: 'auto',
                    }
                  : undefined,
                margins: { top: 40, bottom: 40, left: 80, right: 80 },
                children: [
                  new Paragraph({
                    spacing: { line: 240 }, // single spacing in the form's tables
                    alignment:
                      cell.align === 'center'
                        ? AlignmentType.CENTER
                        : AlignmentType.LEFT,
                    children: runs(cell.content, {
                      bold: cell.header,
                      size: cell.small ? SMALL : undefined,
                    }),
                  }),
                ],
              }),
          ),
        }),
    ),
  });
}

/** Value above a line, caption below, as the "miejscowość / data / podpis" boxes of the template. */
function signatures(cells: { value: string; caption: string }[]): Table {
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const width = Math.round(CONTENT_WIDTH / cells.length);
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: cells.map(() => width),
    borders: {
      top: none,
      bottom: none,
      left: none,
      right: none,
      insideHorizontal: none,
      insideVertical: none,
    },
    rows: [
      new TableRow({
        cantSplit: true,
        children: cells.map(
          (cell) =>
            new TableCell({
              width: { size: width, type: WidthType.DXA },
              margins: { top: 160, left: 120, right: 120 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  border: {
                    bottom: {
                      style: BorderStyle.SINGLE,
                      size: 4,
                      color: '000000',
                      space: 2,
                    },
                  },
                  children: runs(cell.value || ' '),
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: runs(cell.caption, { italics: true, size: SMALL }),
                }),
              ],
            }),
        ),
      }),
    ],
  });
}
