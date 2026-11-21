/**
 * Abbreviations and synonyms used in the civil service, for query expansion in
 * the assistant's search (`query-expansion.rules.ts`). Each entry lists only
 * wordings found in the documents of the knowledge base (`docs/`), plus the
 * abbreviations and everyday words people type instead of them.
 *
 * - `phrases`: wordings that mean the same thing; a question with one of them
 *   is also searched (with a lower weight) for the others.
 * - `aliases`: query-only forms (abbreviations, colloquial words) that are
 *   expanded to `phrases`, but never added to a question themselves.
 *
 * Inflection does not matter (phrases are stemmed like the documents), but
 * word order does.
 */
export interface SynonymEntry {
  phrases: string[];
  aliases?: string[];
  /** Where the wording comes from. */
  source: string;
}

export const SYNONYMS: SynonymEntry[] = [
  {
    phrases: ['indywidualny program rozwoju zawodowego', 'IPRZ'],
    source:
      'art. 81 ust. 5, art. 108 ustawy o służbie cywilnej; Poradnik „Oceny okresowe w służbie cywilnej”, s. 29 (skrót IPRZ)',
  },
  {
    phrases: ['opis stanowiska pracy'],
    aliases: ['OSP'],
    source:
      '§ 5 ust. 1 pkt 1 rozp. PRM z 4.04.2016 (Dz.U. 2016 poz. 470); § 3 pkt 2 rozp. PRM z 23.07.2015 (Dz.U. 2015 poz. 1144)',
  },
  {
    phrases: ['zarządzanie zasobami ludzkimi'],
    aliases: ['ZZL'],
    source:
      'art. 15 ust. 9 ustawy o służbie cywilnej (standardy zarządzania zasobami ludzkimi)',
  },
  {
    phrases: ['dyrektor generalny'],
    aliases: ['DG'],
    source: 'art. 25 ustawy o służbie cywilnej (dyrektor generalny urzędu)',
  },
  {
    phrases: ['Szef Służby Cywilnej'],
    aliases: ['SSC'],
    source: 'art. 14 ustawy o służbie cywilnej',
  },
  {
    phrases: ['służba cywilna'],
    aliases: ['SC'],
    source: 'art. 1 ustawy o służbie cywilnej',
  },
  {
    phrases: ['Kancelaria Prezesa Rady Ministrów', 'KPRM'],
    source:
      'art. 2 ust. 1 pkt 1 ustawy o służbie cywilnej; poradniki KPRM (wydawca)',
  },
  {
    // The re-assessment 6 months after a negative periodic assessment.
    phrases: ['ponowna ocena', 'nowa ocena okresowa'],
    aliases: [
      'powtórna ocena',
      'ocena po negatywnej',
      'ocena po ocenie negatywnej',
    ],
    source:
      'art. 81 ust. 9 ustawy o służbie cywilnej; § 7 pkt 2 rozp. PRM z 4.04.2016 (Dz.U. 2016 poz. 470); Poradnik „Oceny okresowe w służbie cywilnej”, s. 13, 23',
  },
  {
    phrases: ['sprzeciw'],
    aliases: ['odwołanie od oceny', 'odwołać się'],
    source: 'art. 83 ust. 1 ustawy o służbie cywilnej (sprzeciw od oceny)',
  },
  {
    // In the application the sheets are called "formularz".
    phrases: ['arkusz oceny'],
    aliases: ['formularz oceny', 'formularz pierwszej oceny'],
    source:
      '§ 1 rozp. PRM z 4.04.2016 (Dz.U. 2016 poz. 470) (wzory arkuszy oceny okresowej); § 1 pkt 3 rozp. PRM z 23.07.2015 (Dz.U. 2015 poz. 1144) (wzór arkusza pierwszej oceny)',
  },
  {
    // First assessment: the talk at the start, rozmowa wstępna.
    phrases: ['rozmowa wstępna'],
    aliases: ['rozmowa wprowadzająca'],
    source: '§ 3 rozp. PRM z 23.07.2015 (Dz.U. 2015 poz. 1144)',
  },
  {
    // Periodic assessment: the talk that starts the cycle.
    phrases: ['rozmowa rozpoczynająca proces oceny'],
    aliases: ['rozmowa rozpoczynająca', 'rozmowa otwierająca'],
    source:
      '§ 5 ust. 1 rozp. PRM z 4.04.2016 (Dz.U. 2016 poz. 470); Poradnik „Oceny okresowe w służbie cywilnej”, s. 20',
  },
  {
    // Both assessments: the talk before the assessment is written.
    phrases: ['rozmowa oceniająca'],
    aliases: ['rozmowa końcowa', 'rozmowa podsumowująca'],
    source:
      '§ 10 rozp. PRM z 4.04.2016 (Dz.U. 2016 poz. 470); § 8 rozp. PRM z 23.07.2015 (Dz.U. 2015 poz. 1144)',
  },
  {
    phrases: ['pierwsza ocena'],
    aliases: ['ocena nowego pracownika', 'ocena nowo zatrudnionego'],
    source: 'art. 38 ustawy o służbie cywilnej; rozp. PRM z 23.07.2015',
  },
  {
    phrases: ['ocena okresowa'],
    aliases: ['ocena dwuletnia'],
    source:
      'art. 81 ust. 1 i 4 ustawy o służbie cywilnej (co 24 miesiące); rozp. PRM z 4.04.2016',
  },
  {
    phrases: ['usprawiedliwiona nieobecność'],
    aliases: ['zwolnienie lekarskie', 'zwolnienie chorobowe'],
    source:
      'art. 81 ust. 7 ustawy o służbie cywilnej; Poradnik „Oceny okresowe w służbie cywilnej”, s. 12',
  },
  {
    // Periodic assessment: the supervisor who assesses.
    phrases: ['bezpośredni przełożony', 'oceniający'],
    aliases: ['przełożony'],
    source:
      '§ 2 ust. 1 rozp. PRM z 4.04.2016 (Dz.U. 2016 poz. 470) („bezpośredni przełożony ocenianego, zwany dalej oceniającym”); art. 81 ust. 1 ustawy o służbie cywilnej',
  },
  {
    phrases: ['okres podlegający ocenie'],
    aliases: ['okres oceny', 'okres oceniania'],
    source:
      'art. 81 ust. 6 ustawy o służbie cywilnej; Poradnik „Oceny okresowe w służbie cywilnej”, s. 23',
  },
  {
    phrases: ['zmiana terminu', 'zmienić termin'],
    // "przesunięcie terminu" stems the same as "przesunąć termin".
    aliases: ['przesunąć termin', 'przesunąć ocenę', 'przełożyć ocenę'],
    source:
      'art. 81 ust. 8 ustawy o służbie cywilnej („może zmienić termin oceny”)',
  },
];
