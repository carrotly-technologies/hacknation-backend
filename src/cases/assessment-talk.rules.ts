import { RO_2016 } from '../assessments/assessment.format.js';
import type { AssessmentTalkTopic, CaseRecord } from './case.types.js';
import { formatDatePl } from './dates.js';

/**
 * Rozmowa oceniająca, etap III procesu oceny okresowej (Poradnik „Oceny
 * okresowe w służbie cywilnej”, Tabela nr 1 „Etapy procesu oceny okresowej
 * w służbie cywilnej”, s. 20: „przed sporządzeniem oceny na piśmie”).
 *
 * § 10 rozp. PRM z 4.04.2016 (Dz.U. 2016 poz. 470): „Przed sporządzeniem
 * oceny na piśmie oceniający przeprowadza z ocenianym rozmowę oceniającą,
 * podczas której omawia z nim: 1) …; 2) …; 3) …”. Teksty punktów niżej są
 * dosłowne (docs/tekst/ocena-okresowa/rozporzadzenie-oceny-okresowe-2016.txt).
 */
export const ASSESSMENT_TALK_LEGAL_BASIS = `§10 ${RO_2016}`;

export const ASSESSMENT_TALK_TOPICS: readonly AssessmentTalkTopic[] = [
  {
    id: 'DUTIES',
    label:
      'Główne obowiązki w okresie oceny i sposób ich realizacji, z uwzględnieniem spełniania kryteriów',
    quote:
      'główne obowiązki wykonywane przez ocenianego w okresie, w którym podlegał ocenie, oraz sposób ich realizacji, z uwzględnieniem spełniania przez ocenianego ustalonych kryteriów oceny',
    legalBasis: `§10 pkt 1 ${RO_2016}`,
  },
  {
    id: 'GOALS',
    label: 'Realizacja celów (jeśli zostały wyznaczone)',
    quote:
      'sposób realizowania przez ocenianego celów do osiągnięcia w okresie, w którym oceniany podlegał ocenie, jeżeli cele te zostały wyznaczone',
    legalBasis: `§10 pkt 2 ${RO_2016}`,
  },
  {
    id: 'DEVELOPMENT',
    label:
      'Kierunki dalszego rozwoju zawodowego i potrzeby w zakresie podnoszenia kwalifikacji',
    quote:
      'kierunki dalszego rozwoju zawodowego i potrzeby ocenianego w zakresie podnoszenia kwalifikacji i doskonalenia umiejętności',
    legalBasis: `§10 pkt 3 ${RO_2016}`,
  },
];

/** Topics of the assessment talk of a case: §10 applies to the periodic path only. */
export function assessmentTalkTopics(
  record: Pick<CaseRecord, 'path'>,
): AssessmentTalkTopic[] {
  return record.path === 'PERIODIC' ? [...ASSESSMENT_TALK_TOPICS] : [];
}

/**
 * Why `date` cannot be the date of the assessment talk (Polish), or an empty
 * list. The talk takes place in the assessment period: after the employee
 * acknowledged part I (from then the period runs, §5 ust. 3 i §6 rozp.
 * 2016), and it is recorded after it happened, so not in the future.
 */
export function assessmentTalkDateErrors(
  record: Pick<CaseRecord, 'partI'>,
  date: string,
  today: string,
): string[] {
  const errors: string[] = [];
  if (date > today) {
    errors.push(
      'Data rozmowy oceniającej nie może być z przyszłości: odnotuj rozmowę po jej przeprowadzeniu.',
    );
  }
  const from = record.partI.acknowledgedByEmployeeOn;
  if (from && date < from) {
    errors.push(
      `Data rozmowy oceniającej nie może być wcześniejsza niż zapoznanie ocenianego z częścią I (${formatDatePl(from)}): od tego dnia biegnie okres oceny.`,
    );
  }
  return errors;
}
