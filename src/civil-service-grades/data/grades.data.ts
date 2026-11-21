/** One civil-service grade (stopień służbowy urzędnika służby cywilnej). */
export interface CivilServiceGrade {
  /** Roman numeral; it also fills the request of part III ("przyznanie II stopnia służbowego"). */
  id: GradeId;
  label: string;
}

/**
 * art. 86 ust. 1 ustawy z dnia 21 listopada 2008 r. o służbie cywilnej:
 * "Ustanawia się dziewięć stopni służbowych urzędników służby cywilnej."
 * The act fixes only their number, so they are numbered; the list goes from
 * the lowest (granted on appointment, art. 51 ust. 1) to the highest, and the
 * "kolejny stopień" of art. 89 ust. 1 is the next one on the list.
 */
export const GRADE_IDS = [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
] as const;
export type GradeId = (typeof GRADE_IDS)[number];

export const CIVIL_SERVICE_GRADES: readonly CivilServiceGrade[] = GRADE_IDS.map(
  (id) => ({ id, label: `${id} stopień służbowy` }),
);

export const GRADES_LEGAL_BASIS =
  'art. 86 ust. 1 ustawy o służbie cywilnej (dziewięć stopni służbowych); kolejny stopień: art. 89 ust. 1';
