import { RO_2016, RP_2015 } from '../assessments/assessment.format.js';
import { analyseOsp } from '../osp/osp-analysis.rules.js';
import { findOsp } from '../osp/osp.data.js';
import { effectiveStage, STAGE_NAMES } from './case.rules.js';
import { CaseRuleError } from './case-rule.error.js';
import {
  CASE_ACTIONS,
  type CaseAction,
  type CaseRecord,
  type StageId,
} from './case.types.js';
import { formatDatePl } from './dates.js';
import {
  defaultAssessmentDue,
  defaultReportDue,
  objectionDeadline,
  openingTalkDeadline,
  reassessmentAfterNegativeDue,
  USC,
} from './deadlines.rules.js';
import { formalCheck } from './formal-check.rules.js';
import { nextCycleStart } from './stages.rules.js';

export const ACTION_LABELS: Record<CaseAction, string> = {
  ACCEPT_OSP_ANALYSIS: 'Zatwierdź analizę opisu stanowiska',
  ACCEPT_SHEET: 'Akceptuj formularz',
  CONFIRM_PART_I: 'Zatwierdź część I',
  EMPLOYEE_ACK_PART_I: 'Oceniany potwierdził zapoznanie z częścią I',
  START_ASSESSMENT: 'Rozpocznij rozmowę oceniającą',
  SIGN_ASSESSMENT: 'Zatwierdź ocenę (podpis oceniającego)',
  SEND_FOR_ACK: 'Przekaż do zapoznania',
  EMPLOYEE_ACK_ASSESSMENT: 'Oceniany zapoznał się z oceną',
  REPORT_SUBMITTED: 'Sprawozdanie złożone',
  COMPLETE_INTRO_TALK: 'Rozmowa wstępna odbyta',
};

const PART_II_STAGES: readonly StageId[] = [
  'ASSESSMENT',
  'JUSTIFICATION',
  'FIRST_ASSESSMENT',
  'FIRST_CONDITIONS',
];
const DOCUMENT_STAGES: readonly StageId[] = ['DOCUMENT', 'FIRST_DOCUMENT'];

const PERIODIC_ONLY: readonly CaseAction[] = [
  'ACCEPT_OSP_ANALYSIS',
  'ACCEPT_SHEET',
  'CONFIRM_PART_I',
  'EMPLOYEE_ACK_PART_I',
];
const FIRST_ONLY: readonly CaseAction[] = [
  'REPORT_SUBMITTED',
  'COMPLETE_INTRO_TALK',
];

/**
 * Why `action` is not allowed now (Polish), or null when it is. Formal check
 * errors of SIGN_ASSESSMENT are reported separately by `applyAction`.
 */
export function actionBlocker(
  record: CaseRecord,
  action: CaseAction,
  today: string,
): string | null {
  const stage = effectiveStage(record);
  const here = `etapie „${STAGE_NAMES[stage]}”`;

  if (record.acknowledgedOn) {
    return `Ocena jest zakończona: oceniany zapoznał się z nią ${formatDatePl(record.acknowledgedOn)}.`;
  }
  if (record.path === 'FIRST' && PERIODIC_ONLY.includes(action)) {
    return 'Ta akcja dotyczy tylko oceny okresowej. Pierwsza ocena nie ma analizy opisu stanowiska ani części I z kryteriami dodatkowymi.';
  }
  if (record.path === 'PERIODIC' && FIRST_ONLY.includes(action)) {
    return 'Ta akcja dotyczy tylko pierwszej oceny (rozp. PRM z 23.07.2015).';
  }

  switch (action) {
    case 'ACCEPT_OSP_ANALYSIS':
      if (stage !== 'OSP_ANALYSIS') {
        return `Analiza opisu stanowiska została już zatwierdzona${record.completedOn.OSP_ANALYSIS ? ` ${formatDatePl(record.completedOn.OSP_ANALYSIS)}` : ''}; sprawa jest na ${here}.`;
      }
      if (!record.sheetId) {
        const osp = findOsp(record.ospId);
        if (!osp || !analyseOsp(osp).suggestedSheet) {
          return 'Nie można ustalić arkusza z opisu stanowiska: wybierz arkusz (pole sheetId), a potem zatwierdź analizę.';
        }
      }
      return null;
    case 'ACCEPT_SHEET':
      if (stage === 'OSP_ANALYSIS') {
        return 'Najpierw zatwierdź analizę opisu stanowiska; na jej podstawie system zaproponuje formularz oceny.';
      }
      if (stage !== 'SHEET_PROPOSAL') {
        return `Formularz oceny został już zaakceptowany${record.completedOn.SHEET_PROPOSAL ? ` ${formatDatePl(record.completedOn.SHEET_PROPOSAL)}` : ''}; sprawa jest na ${here}.`;
      }
      if (!record.sheetId) {
        return 'Wybierz arkusz oceny (A, B albo C), a potem zaakceptuj formularz.';
      }
      return null;
    case 'CONFIRM_PART_I':
      if (stage === 'OSP_ANALYSIS' || stage === 'SHEET_PROPOSAL') {
        return 'Najpierw zatwierdź analizę opisu stanowiska i zaakceptuj formularz oceny; dopiero potem można zatwierdzić część I.';
      }
      if (stage !== 'OPENING_TALK') {
        return `Część I jest już zatwierdzona${record.partI.confirmedByEvaluatorOn ? ` (${formatDatePl(record.partI.confirmedByEvaluatorOn)})` : ''}; sprawa jest na ${here}.`;
      }
      if (record.partI.confirmedByEvaluatorOn) {
        return `Część I zatwierdzono ${formatDatePl(record.partI.confirmedByEvaluatorOn)}. Teraz oceniany potwierdza zapoznanie z kryteriami i terminem oceny.`;
      }
      return null;
    case 'EMPLOYEE_ACK_PART_I':
      if (stage !== 'OPENING_TALK') {
        return stage === 'OSP_ANALYSIS' || stage === 'SHEET_PROPOSAL'
          ? 'Najpierw zatwierdź analizę opisu stanowiska, zaakceptuj formularz i przeprowadź rozmowę rozpoczynającą.'
          : `Oceniany już potwierdził zapoznanie z częścią I${record.partI.acknowledgedByEmployeeOn ? ` (${formatDatePl(record.partI.acknowledgedByEmployeeOn)})` : ''}.`;
      }
      if (!record.partI.confirmedByEvaluatorOn) {
        return `Najpierw oceniający zatwierdza część I (kryteria i termin oceny), potem oceniany potwierdza zapoznanie (§5 ust. 3 ${RO_2016}).`;
      }
      return null;
    case 'START_ASSESSMENT':
      if (record.path === 'PERIODIC') {
        if (stage === 'OBSERVATION') return null;
        return PART_II_STAGES.includes(stage) || DOCUMENT_STAGES.includes(stage)
          ? `Rozmowa oceniająca została już rozpoczęta; sprawa jest na ${here}.`
          : `Rozmowę oceniającą można rozpocząć dopiero w okresie oceny, po zatwierdzeniu części I i potwierdzeniu jej przez ocenianego; sprawa jest na ${here}.`;
      }
      if (stage === 'REPORT') {
        const due = record.firstConditions?.reportDue;
        if (due && today > due) return null;
        return `Rozmowę oceniającą przeprowadza się niezwłocznie po złożeniu sprawozdania albo po upływie terminu na jego złożenie${due ? ` (${formatDatePl(due)})` : ''} (§7 pkt 1 ${RP_2015}). Gdy pracownik złoży sprawozdanie, użyj akcji „${ACTION_LABELS.REPORT_SUBMITTED}”.`;
      }
      return stage === 'INTRO_TALK'
        ? `Najpierw przeprowadź rozmowę wstępną i wyznacz termin sprawozdania (§3–§4 ${RP_2015}).`
        : `Rozmowa oceniająca została już rozpoczęta; sprawa jest na ${here}.`;
    case 'SIGN_ASSESSMENT':
      if (PART_II_STAGES.includes(stage)) return null;
      return DOCUMENT_STAGES.includes(stage)
        ? `Ocena została już zatwierdzona przez oceniającego ${formatDatePl(record.signedByEvaluatorOn!)}.`
        : `Ocenę można zatwierdzić dopiero po rozmowie oceniającej i ocenie wszystkich kryteriów; sprawa jest na ${here}.`;
    case 'SEND_FOR_ACK':
      if (!DOCUMENT_STAGES.includes(stage)) {
        return `Najpierw zatwierdź ocenę (podpis oceniającego); dopiero zatwierdzoną ocenę przekazuje się do zapoznania. Sprawa jest na ${here}.`;
      }
      if (record.sentForAckOn) {
        return `Ocenę przekazano do zapoznania ${formatDatePl(record.sentForAckOn)}; czeka na potwierdzenie ocenianego.`;
      }
      return null;
    case 'EMPLOYEE_ACK_ASSESSMENT':
      if (!DOCUMENT_STAGES.includes(stage)) {
        return `Oceniany zapoznaje się z oceną dopiero po jej zatwierdzeniu i przekazaniu; sprawa jest na ${here}.`;
      }
      if (!record.sentForAckOn) {
        return `Najpierw użyj akcji „${ACTION_LABELS.SEND_FOR_ACK}”.`;
      }
      return null;
    case 'REPORT_SUBMITTED':
      if (stage === 'REPORT') return null;
      return stage === 'INTRO_TALK'
        ? 'Najpierw przeprowadź rozmowę wstępną i wyznacz termin na złożenie sprawozdania (§3–§4 rozp. PRM z 23.07.2015).'
        : `Etap sprawozdania jest zakończony${record.firstConditions?.reportSubmittedOn ? ` (złożono ${formatDatePl(record.firstConditions.reportSubmittedOn)})` : ''}; sprawa jest na ${here}.`;
    case 'COMPLETE_INTRO_TALK':
      if (stage === 'INTRO_TALK') return null;
      return `Rozmowa wstępna już się odbyła${record.completedOn.INTRO_TALK ? ` (${formatDatePl(record.completedOn.INTRO_TALK)})` : ''}; sprawa jest na ${here}.`;
  }
}

/** Actions allowed right now (without running the formal check). */
export function availableActions(
  record: CaseRecord,
  today: string,
): CaseAction[] {
  return CASE_ACTIONS.filter((a) => actionBlocker(record, a, today) === null);
}

/**
 * The process state machine. Returns the updated copy of the record, or
 * throws CaseRuleError with a Polish explanation of why the transition is not
 * legal now.
 */
export function applyAction(
  record: CaseRecord,
  action: CaseAction,
  today: string,
): CaseRecord {
  const blocker = actionBlocker(record, action, today);
  if (blocker) {
    const allowed = availableActions(record, today).map(
      (a) => `„${ACTION_LABELS[a]}”`,
    );
    throw new CaseRuleError(
      `Akcja „${ACTION_LABELS[action]}” jest teraz niedostępna. ${blocker}${allowed.length > 0 ? ` Dostępne teraz: ${allowed.join(', ')}.` : ''}`,
    );
  }

  const next = structuredClone(record);
  const log = (text: string) => next.history.push({ date: today, text });

  switch (action) {
    case 'ACCEPT_OSP_ANALYSIS': {
      if (!next.sheetId) {
        next.sheetId = analyseOsp(findOsp(next.ospId)!).suggestedSheet!.sheetId;
      }
      next.stage = 'SHEET_PROPOSAL';
      next.completedOn.OSP_ANALYSIS = today;
      log(
        `Zatwierdzono analizę opisu stanowiska. Proponowany formularz: arkusz ${next.sheetId}${next.partI.additionalCriteria.length > 0 ? `, ${next.partI.additionalCriteria.length} kandydat(ów) na kryteria dodatkowe` : ''}.`,
      );
      break;
    }
    case 'ACCEPT_SHEET': {
      next.stage = 'OPENING_TALK';
      next.completedOn.SHEET_PROPOSAL = today;
      log(
        `Zaakceptowano formularz oceny: arkusz ${next.sheetId}, kryteria dodatkowe ${next.partI.additionalCriteria.length}/3.`,
      );
      break;
    }
    case 'CONFIRM_PART_I': {
      next.partI.confirmedByEvaluatorOn = today;
      if (!next.partI.assessmentDue) {
        next.partI.assessmentDue =
          next.cycleStart.kind === 'PREVIOUS_NEGATIVE'
            ? reassessmentAfterNegativeDue(next.cycleStart.acknowledgedOn)
            : defaultAssessmentDue(today);
      }
      log(
        `Oceniający zatwierdził część I: kryteria dodatkowe ${next.partI.additionalCriteria.length}/3, termin sporządzenia oceny ${formatDatePl(next.partI.assessmentDue)}. Kryteria są zablokowane.`,
      );
      break;
    }
    case 'EMPLOYEE_ACK_PART_I':
      next.partI.acknowledgedByEmployeeOn = today;
      next.stage = 'OBSERVATION';
      next.completedOn.OPENING_TALK = today;
      log(
        `Oceniany potwierdził rozmowę rozpoczynającą i zapoznanie z kryteriami. Od tej daty biegnie okres oceny; oryginał części I trafia do akt osobowych, kopia do ocenianego (§6 ${RO_2016}).`,
      );
      break;
    case 'START_ASSESSMENT':
      if (next.path === 'PERIODIC') {
        next.stage = 'ASSESSMENT';
        next.completedOn.OBSERVATION = today;
        log('Rozpoczęto rozmowę oceniającą i ocenę (część II arkusza).');
      } else {
        next.stage = 'FIRST_ASSESSMENT';
        next.completedOn.REPORT = today;
        log(
          `Upłynął termin na złożenie sprawozdania bez jego złożenia; rozpoczęto rozmowę oceniającą (§7 pkt 1 ${RP_2015}). Warunek z §10 ust. 1 pkt 2 nie jest spełniony.`,
        );
      }
      break;
    case 'SIGN_ASSESSMENT': {
      const errors = formalCheck(record, today).filter((item) => !item.ok);
      if (errors.length > 0) {
        throw new CaseRuleError(
          `Nie można zatwierdzić oceny: kontrola formalna wykazała ${errors.length} ${errors.length === 1 ? 'błąd' : errors.length < 5 ? 'błędy' : 'błędów'}. ${errors.map((e) => e.message).join(' ')}`,
          errors,
        );
      }
      next.signedByEvaluatorOn = today;
      if (next.path === 'PERIODIC') {
        next.completedOn.ASSESSMENT ??= today;
        next.completedOn.JUSTIFICATION = today;
        next.stage = 'DOCUMENT';
      } else {
        next.completedOn.FIRST_ASSESSMENT ??= today;
        next.completedOn.FIRST_CONDITIONS = today;
        next.stage = 'FIRST_DOCUMENT';
      }
      log('Oceniający zatwierdził ocenę na piśmie. Pola oceny są zablokowane.');
      break;
    }
    case 'SEND_FOR_ACK':
      next.sentForAckOn = today;
      log('Ocenę przekazano ocenianemu do zapoznania.');
      break;
    case 'EMPLOYEE_ACK_ASSESSMENT': {
      next.acknowledgedOn = today;
      next.completedOn[
        next.path === 'PERIODIC' ? 'DOCUMENT' : 'FIRST_DOCUMENT'
      ] = today;
      if (next.path === 'FIRST') {
        log(
          `Oceniany zapoznał się z pierwszą oceną. Oryginał arkusza wraz ze sprawozdaniem trafia do akt osobowych, kopia do ocenianego (§11 ${RP_2015}); kierujący komórką kieruje wniosek do dyrektora generalnego (art. 38 ust. 3 ${USC}).`,
        );
        break;
      }
      const objection = objectionDeadline(today);
      log(
        `Oceniany zapoznał się z oceną. Sprzeciw do dyrektora generalnego urzędu można wnieść do ${formatDatePl(objection.date!)} (art. 83 ust. 1 ${USC}).`,
      );
      const cycle = nextCycleStart(next, today);
      if (cycle) {
        const talk = openingTalkDeadline(cycle);
        log(
          cycle.kind === 'PREVIOUS_NEGATIVE'
            ? `Nowy cykl oceny (po ocenie negatywnej): rozmowa rozpoczynająca do ${formatDatePl(talk.date!)} (7 dni od sporządzenia oceny, §7 pkt 2 ${RO_2016}); ponowna ocena po upływie 6 miesięcy od zapoznania, od ${formatDatePl(reassessmentAfterNegativeDue(today))} (art. 81 ust. 9 ${USC}). Sprzeciw nie wstrzymuje nowego cyklu.`
            : `Nowy cykl oceny: rozmowa rozpoczynająca do ${formatDatePl(talk.date!)} (30 dni od sporządzenia oceny, §7 pkt 1 ${RO_2016}). Sprzeciw nie wstrzymuje nowego cyklu.`,
        );
      }
      break;
    }
    case 'REPORT_SUBMITTED': {
      const conditions = next.firstConditions ?? {
        examPassed: null,
        reportSubmittedOn: null,
        reportDue: null,
      };
      conditions.reportSubmittedOn = today;
      next.firstConditions = conditions;
      next.stage = 'FIRST_ASSESSMENT';
      next.completedOn.REPORT = today;
      const late = conditions.reportDue && today > conditions.reportDue;
      log(
        late
          ? `Pracownik złożył sprawozdanie po terminie (${formatDatePl(conditions.reportDue!)}): warunek z §10 ust. 1 pkt 2 ${RP_2015} nie jest spełniony.`
          : `Pracownik złożył sprawozdanie w terminie. Rozmowę oceniającą należy przeprowadzić niezwłocznie (§7 pkt 1 ${RP_2015}).`,
      );
      break;
    }
    case 'COMPLETE_INTRO_TALK': {
      const conditions = next.firstConditions ?? {
        examPassed: null,
        reportSubmittedOn: null,
        reportDue: null,
      };
      conditions.reportDue ??= defaultReportDue(next.person.hiredOn);
      next.firstConditions = conditions;
      next.stage = 'REPORT';
      next.completedOn.INTRO_TALK = today;
      log(
        `Odbyła się rozmowa wstępna. Termin na złożenie sprawozdania: ${formatDatePl(conditions.reportDue)} (§4 ${RP_2015}).`,
      );
      break;
    }
  }
  return next;
}
