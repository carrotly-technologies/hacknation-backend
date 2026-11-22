import { PERIODIC_BANDS } from '../assessments/evaluate.rules.js';
import type { CaseDetail } from '../cases/case.types.js';
import { formatDatePl } from '../cases/dates.js';
import type { Sheet, SheetTemplate } from '../sheets/sheet.types.js';

/**
 * A filled periodic sheet (A, B or C; załączniki nr 2–4 do rozp. PRM z
 * 4.04.2016) as a list of format-neutral blocks, rendered to PDF by
 * sheet-pdf.ts and to DOCX by sheet-docx.ts. Order, captions and data follow
 * the official template and the preview in the frontend (`SheetDocument`);
 * the fixed legal wording comes from the sheet `template` (sheets.data.ts).
 */

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** A hint printed on the template under an empty field, e.g. "(dd.mm.rrrr)". */
  muted?: boolean;
}

/** Plain text, or runs with their own style. */
export type Inline = string | Run[];

export interface Cell {
  content: Inline;
  colSpan?: number;
  rowSpan?: number;
  /** A caption cell of the template (grey background, semibold). */
  header?: boolean;
  align?: 'left' | 'center';
  small?: boolean;
}

export interface SignatureCell {
  value: string;
  caption: string;
}

export type Block =
  | { kind: 'annex'; text: string }
  | { kind: 'title'; lines: string[] }
  | { kind: 'part'; text: string }
  | { kind: 'heading'; text: string }
  | {
      kind: 'paragraph';
      content: Inline;
      italic?: boolean;
      align?: 'left' | 'center';
      small?: boolean;
    }
  /** A framed free-text field (justification, IPRZ, motivation). */
  | { kind: 'textBox'; text: string }
  /** Rows as in HTML: a cell covered by a span is left out. Widths are fractions of the page width. */
  | { kind: 'table'; widths: number[]; rows: Cell[][] }
  | { kind: 'signatures'; cells: SignatureCell[] }
  | { kind: 'pageBreak' };

export interface SheetContent {
  /** Document title for the file metadata. */
  title: string;
  /** Before the evaluator signs: "WERSJA ROBOCZA" in the header of every page. */
  draft: boolean;
  blocks: Block[];
  footnote: string;
}

export interface SheetContentInput {
  detail: CaseDetail;
  sheet: Sheet;
  template: SheetTemplate;
  competencyName: (id: string) => string;
  scaleLabel: (points: number) => string;
  /** "miejscowość" next to every signature date. */
  place: string;
}

/**
 * Font sizes in points, shared by the PDF and the DOCX, as in an official
 * letter: 12 pt text, 14 pt bold title and part headings, 10 pt notes.
 */
export const SHEET_FONT_SIZE = { body: 12, title: 14, small: 10, footer: 9 };

export const DRAFT_HEADER =
  'WERSJA ROBOCZA: ocena nie jest jeszcze podpisana przez oceniającego';

/** Marks a signature as made in the app (no qualified e-signature yet). */
export const E_SIGNED = '/podpisano elektronicznie/';

const PART = (n: string) => `CZĘŚĆ ${n}`;
const date = (iso: string | null | undefined) => (iso ? formatDatePl(iso) : '');
const hint = (text: string): Run[] => [{ text: `(${text})`, muted: true }];
/** The value, or the template's hint under an empty field. */
const valueOr = (value: string, hintText?: string): Inline =>
  value ? value : hintText ? hint(hintText) : '';
const x = (on: boolean) => (on ? 'X' : '');
const pointsWord = (n: number) =>
  n === 1 ? 'punkt' : n >= 2 && n <= 4 ? 'punkty' : 'punktów';

export function buildSheetContent(input: SheetContentInput): SheetContent {
  const {
    detail,
    sheet,
    template: t,
    competencyName,
    scaleLabel,
    place,
  } = input;
  const p = detail.person;
  const e = detail.evaluator;
  const ev = detail.evaluation;
  const mandatory = sheet.mandatoryCriteria;
  const extra = detail.partI.additionalCriteria;
  const scale = sheet.scale;
  const request = detail.promotionRequest;
  const prev = detail.previousAssessment;
  const urzednik = p.employment === 'URZEDNIK';
  const signed = detail.signedByEvaluatorOn;
  const signature = (
    on: string | null,
    caption: string,
    name?: string,
  ): SignatureCell[] => [
    { value: on ? place : '', caption: 'miejscowość' },
    { value: date(on), caption: 'data (dd.mm.rrrr)' },
    ...(name !== undefined
      ? [
          {
            value: on ? name : '',
            caption: `imię i nazwisko lub pieczątka ${caption}`,
          },
        ]
      : []),
    { value: on ? E_SIGNED : '', caption: `podpis ${caption}` },
  ];

  const blocks: Block[] = [
    { kind: 'annex', text: t.annex },
    { kind: 'title', lines: [`ARKUSZ ${sheet.id}`, t.title] },

    // ---- Part I ----
    { kind: 'part', text: PART('I') },
    {
      kind: 'table',
      widths: [0.35, 0.65],
      rows: [
        [
          { content: 'NAZWA URZĘDU', header: true },
          { content: detail.officeName },
        ],
        [{ content: 'DANE OCENIANEGO', header: true, colSpan: 2 }],
        ...personRows(p),
        [{ content: 'DANE OCENIAJĄCEGO', header: true, colSpan: 2 }],
        ...personRows(e),
      ],
    },
    {
      kind: 'table',
      widths: [0.4, 0.35, 0.25],
      rows: criteriaRows(
        mandatory.map(competencyName),
        extra.map(competencyName),
        date(detail.partI.assessmentDue),
      ),
    },
    { kind: 'paragraph', content: [{ text: 'Potwierdzamy:', italic: true }] },
    ...t.partIConfirmation.map((line): Block => ({
      kind: 'paragraph',
      content: `– ${line}`,
    })),
    {
      kind: 'signatures',
      cells: signature(detail.partI.confirmedByEvaluatorOn, 'oceniającego'),
    },
    {
      kind: 'signatures',
      cells: signature(detail.partI.acknowledgedByEmployeeOn, 'ocenianego'),
    },

    // ---- Part II ----
    { kind: 'pageBreak' },
    { kind: 'part', text: PART('II') },
    {
      kind: 'table',
      widths: [0.5, 0.25, 0.25],
      rows: [
        [
          { content: 'DATA PRZEPROWADZENIA ROZMOWY OCENIAJĄCEJ', header: true },
          {
            content: valueOr(date(detail.assessmentTalkOn), 'dd.mm.rrrr'),
            colSpan: 2,
          },
        ],
        [
          { content: 'OKRES, W KTÓRYM OCENIANY PODLEGAŁ OCENIE', header: true },
          {
            content: labelled(
              'OD: ',
              date(detail.partI.acknowledgedByEmployeeOn),
            ),
          },
          { content: labelled('DO: ', date(signed)) },
        ],
      ],
    },
    {
      kind: 'table',
      widths: [0.4, ...scale.map(() => 0.6 / scale.length)],
      rows: scoreRows(
        scale,
        scaleLabel,
        mandatory.map((id) => ({
          name: competencyName(id),
          points: detail.decisions[id],
        })),
        extra.map((id) => ({
          name: competencyName(id),
          points: detail.decisions[id],
        })),
      ),
    },
    {
      kind: 'paragraph',
      content: [
        {
          text: 'Średnia arytmetyczna z ocen cząstkowych przyznanych za poszczególne kryteria oceny: ',
        },
        { text: ev?.averageDisplay ?? '', bold: true },
      ],
    },
    {
      kind: 'table',
      widths: [0.3, 0.4, 0.3],
      rows: awardRows(detail, scaleLabel),
    },

    { kind: 'heading', text: 'UZASADNIENIE PRZYZNANEJ OCENY OKRESOWEJ' },
    { kind: 'textBox', text: detail.justification },
    {
      kind: 'heading',
      text: 'WNIOSKI DOTYCZĄCE INDYWIDUALNEGO PROGRAMU ROZWOJU ZAWODOWEGO',
    },
    { kind: 'textBox', text: detail.iprz },
    {
      kind: 'table',
      widths: [0.2, 0.17, 0.12, 0.18, 0.18, 0.15], // "Data sporządzenia" fits one line at 12 pt
      rows: [
        [
          {
            content:
              'DANE DOTYCZĄCE POPRZEDNIEJ OCENY OKRESOWEJ URZĘDNIKA SŁUŻBY CYWILNEJ',
            header: true,
            colSpan: 6,
          },
        ],
        [
          { content: 'Ocena', header: true },
          {
            content: urzednik
              ? prev?.result === 'POSITIVE'
                ? 'pozytywna'
                : prev?.result === 'NEGATIVE'
                  ? 'negatywna'
                  : ''
              : [{ text: 'nie dotyczy', muted: true }],
          },
          { content: 'Poziom', header: true },
          { content: urzednik ? (prev?.level ?? '') : '' },
          { content: 'Data sporządzenia', header: true },
          {
            content: urzednik ? valueOr(date(prev?.date), 'dd.mm.rrrr') : '',
          },
        ],
        [
          {
            content:
              'CZY DO OCENY OKRESOWEJ DOŁĄCZONO WNIOSEK O PRZYZNANIE KOLEJNEGO STOPNIA SŁUŻBOWEGO?',
            header: true,
            colSpan: 6,
          },
        ],
        [
          { content: checkbox('TAK', request.attached === 'YES'), colSpan: 2 },
          { content: checkbox('NIE', request.attached === 'NO'), colSpan: 2 },
          {
            content: checkbox(
              'NIE DOTYCZY (oceniany jest pracownikiem służby cywilnej)',
              request.attached === 'NOT_APPLICABLE',
            ),
            colSpan: 2,
          },
        ],
        [{ content: 'DANE OCENIAJĄCEGO', header: true, colSpan: 6 }],
        ...personRows(e).map(([label, value]) => [
          label,
          { ...value, colSpan: 5 },
        ]),
      ],
    },
    { kind: 'signatures', cells: signature(signed, 'oceniającego') },
    {
      kind: 'paragraph',
      content: [{ text: t.employeeAcknowledgement, italic: true }],
    },
    {
      kind: 'signatures',
      cells: signature(
        detail.acknowledgedOn,
        'ocenianego',
        `${p.firstName} ${p.lastName}`,
      ),
    },
    { kind: 'paragraph', content: [{ text: 'Pouczenie', italic: true }] },
    { kind: 'paragraph', content: t.objectionNotice },
    ...(t.objectionNoticeNote
      ? [
          {
            kind: 'paragraph',
            content: t.objectionNoticeNote,
            small: true,
          } satisfies Block,
        ]
      : []),
  ];

  // ---- Part III: printed only with the request (footnote of the template) ----
  if (request.attached === 'YES') {
    blocks.push(
      { kind: 'pageBreak' },
      { kind: 'part', text: PART('III') },
      {
        kind: 'paragraph',
        content: [{ text: t.partIIIApplicability, italic: true }],
        align: 'center',
      },
      {
        kind: 'table',
        widths: [0.4, 0.6],
        rows: [
          [
            {
              content: 'DANE URZĘDNIKA SŁUŻBY CYWILNEJ',
              header: true,
              colSpan: 2,
            },
          ],
          [{ content: 'Imię', header: true }, { content: p.firstName }],
          [{ content: 'Nazwisko', header: true }, { content: p.lastName }],
          [
            { content: 'Rok mianowania', header: true },
            { content: valueOr(String(request.appointedYear ?? ''), 'rrrr') },
          ],
          [
            { content: 'Posiadany stopień służbowy', header: true },
            { content: request.currentGrade ?? '' },
          ],
          [
            { content: 'Data przyznania stopnia służbowego', header: true },
            { content: valueOr(date(request.gradeGrantedOn), 'dd.mm.rrrr') },
          ],
        ],
      },
      {
        kind: 'heading',
        text: 'WNIOSEK O PRZYZNANIE URZĘDNIKOWI SŁUŻBY CYWILNEJ KOLEJNEGO STOPNIA SŁUŻBOWEGO',
      },
      {
        kind: 'paragraph',
        content: [
          { text: `${t.promotionRequest.beforeName} ` },
          { text: `${p.firstName} ${p.lastName}`, bold: true },
          { text: ` ${t.promotionRequest.afterName} ` },
          { text: request.requestedGrade ?? '……….', bold: true },
          { text: ` ${t.promotionRequest.afterGrade}` },
        ],
      },
      { kind: 'heading', text: 'Umotywowanie wniosku' },
      { kind: 'textBox', text: request.motivation },
      {
        kind: 'signatures',
        cells: signature(
          signed,
          'oceniającego',
          `${e.firstName} ${e.lastName}`,
        ),
      },
    );
  }

  return {
    title: `Arkusz ${sheet.id} oceny okresowej: ${p.firstName} ${p.lastName}`,
    draft: !signed,
    blocks,
    footnote: `Wygenerowano w Kompasie Kompetencji na podstawie wzoru z rozporządzenia PRM z 4.04.2016 (Dz.U. poz. 470).${ev ? ` Średnia ${ev.averageDisplay} liczona bez zaokrągleń.` : ''}`,
  };
}

function personRows(person: {
  firstName: string;
  lastName: string;
  unit: string;
  position: string;
}): [Cell, Cell][] {
  return [
    [{ content: 'Imię', header: true }, { content: person.firstName }],
    [{ content: 'Nazwisko', header: true }, { content: person.lastName }],
    [
      { content: 'Komórka organizacyjna', header: true },
      { content: person.unit },
    ],
    [
      { content: 'Stanowisko pracy', header: true },
      { content: person.position },
    ],
  ];
}

function labelled(label: string, value: string): Run[] {
  return [{ text: label }, ...(value ? [{ text: value }] : hint('dd.mm.rrrr'))];
}

function checkbox(label: string, on: boolean): Run[] {
  return [{ text: `${label}  ` }, { text: on ? '[X]' : '[  ]', bold: true }];
}

/**
 * "KRYTERIA OCENY I TERMIN SPORZĄDZENIA OCENY": mandatory criteria on the
 * left, up to 3 additional ones beside the first three rows, the due date
 * beside the remaining rows (as on the template).
 */
function criteriaRows(
  mandatory: string[],
  extra: string[],
  due: string,
): Cell[][] {
  const rows: Cell[][] = [
    [
      {
        content: 'KRYTERIA OCENY I TERMIN SPORZĄDZENIA OCENY',
        header: true,
        colSpan: 3,
      },
    ],
    [
      { content: 'Kryteria obowiązkowe', header: true, align: 'center' },
      {
        content: [
          { text: 'Kryteria dodatkowe wybrane przez oceniającego ' },
          { text: '(nie więcej niż 3)', italic: true },
        ],
        header: true,
        align: 'center',
        colSpan: 2,
      },
    ],
  ];
  const dueCells = (rowSpan: number): Cell[] => [
    { content: 'Termin sporządzenia oceny', header: true, rowSpan },
    { content: valueOr(due, 'dd.mm.rrrr'), rowSpan, align: 'center' },
  ];
  const rest = Math.max(mandatory.length - 3, 1);
  const count = Math.max(mandatory.length, 4);
  for (let i = 0; i < count; i++) {
    const row: Cell[] = [{ content: mandatory[i] ?? '' }];
    if (i < 3) row.push({ content: extra[i] ?? '', colSpan: 2 });
    else if (i === 3) row.push(...dueCells(rest));
    rows.push(row);
  }
  return rows;
}

function scoreRows(
  scale: number[],
  scaleLabel: (points: number) => string,
  mandatory: { name: string; points: number | undefined }[],
  extra: { name: string; points: number | undefined }[],
): Cell[][] {
  const row = (c: { name: string; points: number | undefined }): Cell[] => [
    { content: c.name },
    ...scale.map((s): Cell => ({
      content: x(c.points === s),
      align: 'center',
    })),
  ];
  const group = (label: string): Cell[] => [
    { content: label, header: true },
    {
      content: 'OCENA CZĄSTKOWA',
      header: true,
      align: 'center',
      colSpan: scale.length,
    },
  ];
  return [
    [
      { content: 'KRYTERIA OBOWIĄZKOWE', header: true, rowSpan: 3 },
      {
        content: 'OCENA CZĄSTKOWA',
        header: true,
        align: 'center',
        colSpan: scale.length,
      },
    ],
    scale.map((s): Cell => ({
      content: scaleLabel(s).toLowerCase(),
      header: true,
      align: 'center',
      small: true,
    })),
    scale.map((s): Cell => ({
      content: `${s} ${pointsWord(s)}`,
      header: true,
      align: 'center',
      small: true,
    })),
    ...mandatory.map(row),
    group('KRYTERIA DODATKOWE WYBRANE PRZEZ OCENIAJĄCEGO'),
    ...(extra.length
      ? extra.map(row)
      : [
          [
            { content: [{ text: 'brak', muted: true }] },
            ...scale.map((): Cell => ({ content: '' })),
          ],
        ]),
  ];
}

/** "PRZYZNANIE OCENY": one row per band of §11 ust. 1 pkt 2, then the result. */
function awardRows(
  detail: CaseDetail,
  scaleLabel: (points: number) => string,
): Cell[][] {
  const ev = detail.evaluation;
  return [
    [{ content: 'PRZYZNANIE OCENY', header: true, colSpan: 3 }],
    [
      'Należy wstawić znak „X” w odpowiednie pole',
      'Liczba punktów stanowiąca średnią arytmetyczną ze wszystkich ocen cząstkowych',
      'Ogólny poziom spełniania kryteriów oceny',
    ].map((text): Cell => ({
      content: text,
      header: true,
      align: 'center',
      small: true,
    })),
    ...PERIODIC_BANDS.map((band, i): Cell[] => {
      const label = scaleLabel(band.points);
      const from = i === 0 ? null : PERIODIC_BANDS[i - 1].max;
      return [
        { content: x(ev?.level?.label === label), align: 'center' },
        {
          content:
            from === null
              ? `od 1 punktu do ${band.max} punktów`
              : `powyżej ${from} punktów do ${band.max} punktów`,
          align: 'center',
        },
        { content: label.toLowerCase(), align: 'center' },
      ];
    }),
    [
      { content: 'OCENA OKRESOWA W SŁUŻBIE CYWILNEJ', header: true },
      { content: checkbox('POZYTYWNA', ev?.result === 'POSITIVE') },
      { content: checkbox('NEGATYWNA', ev?.result === 'NEGATIVE') },
    ],
  ];
}
