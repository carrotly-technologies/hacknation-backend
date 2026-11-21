export const SHEET_IDS = ['A', 'B', 'C', 'FIRST'] as const;
export type SheetId = (typeof SHEET_IDS)[number];

export type SheetKind = 'PERIODIC' | 'FIRST';

export interface Sheet {
  id: SheetId;
  name: string;
  appliesTo: string;
  kind: SheetKind;
  scale: number[];
  mandatoryCriteria: string[];
  maxAdditionalCriteria: number;
  legalBasis: string;
  /** Fixed texts of the official template; null for FIRST (not a periodic sheet). */
  template: SheetTemplate | null;
}

/**
 * Wording of a periodic sheet template (załączniki nr 2–4 do rozp. PRM z
 * 4.04.2016), so the UI and the printed sheet never retype legal texts.
 */
export interface SheetTemplate {
  annex: string;
  title: string;
  /** After "Potwierdzamy:" in part I. */
  partIConfirmation: string[];
  /** The assessed person's statement at the end of part II. */
  employeeAcknowledgement: string;
  /** "Pouczenie" at the end of part II (art. 83 ust. 1 ustawy). */
  objectionNotice: string;
  /** Footnote to the notice, when the template has one. */
  objectionNoticeNote: string | null;
  /** Heading note of part III (art. 89 ust. 1 ustawy). */
  partIIIApplicability: string;
  /** Footnote of part III: when it is not printed nor attached. */
  partIIINotAttached: string;
  /** The request sentence of part III, around the name and the grade. */
  promotionRequest: {
    beforeName: string;
    afterName: string;
    afterGrade: string;
  };
}
