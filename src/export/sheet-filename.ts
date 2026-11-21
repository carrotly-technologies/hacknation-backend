export type SheetFormat = 'pdf' | 'docx';

export const SHEET_CONTENT_TYPES: Record<SheetFormat, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export interface SheetFileNameInput {
  sheetId: string;
  lastName: string;
  firstName: string;
  /** YYYY-MM-DD: the day the file is generated. */
  date: string;
  /** Not signed by the evaluator yet. */
  draft: boolean;
  format: SheetFormat;
}

/** Letters without a decomposition in Unicode (NFD leaves "ł" as it is). */
const ASCII_LETTERS: Record<string, string> = {
  ł: 'l',
  Ł: 'L',
  đ: 'd',
  Đ: 'D',
  ø: 'o',
  Ø: 'O',
  ß: 'ss',
};

function part(text: string, ascii: boolean): string {
  let out = text.trim();
  if (ascii) {
    out = out
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[łŁđĐøØß]/g, (c) => ASCII_LETTERS[c]);
  }
  return out
    .replace(ascii ? /[^A-Za-z0-9-]+/g : /[^\p{L}\p{N}-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * "Arkusz-C-Dabrowska-Ewa-2026-11-21.pdf"; before the evaluator signs, with
 * "-wersja-robocza". `ascii` for `filename=`, `utf8` (Polish letters kept)
 * for `filename*=`.
 */
export function sheetFileName(input: SheetFileNameInput): {
  ascii: string;
  utf8: string;
} {
  const name = (ascii: boolean) =>
    [
      'Arkusz',
      input.sheetId,
      part(input.lastName, ascii),
      part(input.firstName, ascii),
      input.date,
      ...(input.draft ? ['wersja-robocza'] : []),
    ]
      .filter(Boolean)
      .join('-') + `.${input.format}`;
  return { ascii: name(true), utf8: name(false) };
}

/** `attachment` with an ASCII `filename` and the UTF-8 one (RFC 6266 / 5987). */
export function contentDisposition(name: {
  ascii: string;
  utf8: string;
}): string {
  return `attachment; filename="${name.ascii}"; filename*=UTF-8''${encodeURIComponent(name.utf8)}`;
}
