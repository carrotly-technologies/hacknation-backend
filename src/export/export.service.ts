import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CasesService } from '../cases/cases.service.js';
import { DEMO_OFFICE_PLACE } from '../cases/seed/seed.data.js';
import { CompetencyModelService } from '../competency-model/competency-model.service.js';
import { SheetsService } from '../sheets/sheets.service.js';
import { buildSheetContent } from './sheet-content.js';
import { renderSheetDocx } from './sheet-docx.js';
import {
  contentDisposition,
  SHEET_CONTENT_TYPES,
  type SheetFormat,
  sheetFileName,
} from './sheet-filename.js';
import { renderSheetPdf } from './sheet-pdf.js';

/** "WSPÓŁPRACA" -> "Współpraca", as the sheet preview in the app writes criteria. */
function sentenceCase(text: string): string {
  const lower = text.toLocaleLowerCase('pl-PL');
  return lower.charAt(0).toLocaleUpperCase('pl-PL') + lower.slice(1);
}

export interface SheetFile {
  body: Buffer;
  contentType: string;
  disposition: string;
}

const NOT_PERIODIC =
  'Plik do pobrania jest dostępny dla arkusza oceny okresowej (A, B lub C). Arkusz pierwszej oceny wydrukujesz z podglądu arkusza.';

/** The filled sheet of a case as a file (GET /api/cases/:id/sheet.pdf|docx). */
@Injectable()
export class ExportService {
  private readonly place: string;

  constructor(
    private readonly cases: CasesService,
    private readonly sheets: SheetsService,
    private readonly model: CompetencyModelService,
    config: ConfigService,
  ) {
    this.place = config.get<string>('OFFICE_PLACE') || DEMO_OFFICE_PLACE;
  }

  /** 404 for an unknown case, 403 for one the caller may not read (CasePolicy.view). */
  async sheet(id: string, format: SheetFormat): Promise<SheetFile> {
    const detail = await this.cases.view(id);
    const sheet =
      detail.path === 'PERIODIC' && detail.sheetId
        ? this.sheets.findById(detail.sheetId)
        : undefined;
    if (!sheet?.template) throw new ConflictException(NOT_PERIODIC);

    const content = buildSheetContent({
      detail,
      sheet,
      template: sheet.template,
      competencyName: (c) =>
        sentenceCase(this.model.findCompetency(c)?.name ?? c),
      scaleLabel: (points) => this.model.scaleLabel(points) ?? String(points),
      place: this.place,
    });
    const body =
      format === 'pdf'
        ? await renderSheetPdf(content)
        : await renderSheetDocx(content);
    const name = sheetFileName({
      sheetId: sheet.id,
      lastName: detail.person.lastName,
      firstName: detail.person.firstName,
      date: this.cases.today,
      draft: content.draft,
      format,
    });
    return {
      body,
      contentType: SHEET_CONTENT_TYPES[format],
      disposition: contentDisposition(name),
    };
  }
}
